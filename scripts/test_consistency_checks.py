import json
import os
import shutil
import subprocess
import sys
import unittest
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory


SCRIPTS = Path(__file__).resolve().parent


class CheckerFixture(unittest.TestCase):
    def setUp(self):
        workspace = TemporaryDirectory()
        self.addCleanup(workspace.cleanup)
        self.root = Path(workspace.name).resolve()
        self.scripts = self.root / "scripts"
        self.scripts.mkdir()

    def write_file(self, relative_path, text):
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path


class KnowledgeBaseCheckTests(CheckerFixture):
    def check_registry(self, *, template=False, **fields):
        project_id = "PROJ-000" if template else "PROJ-019"
        data = {
            "id": project_id,
            "name": "Fixture",
            "status": "active",
            "priority": "medium",
            "created_date": "2026-01-01",
            "updated_date": "2026-02-01",
            "owner": "Fixture owner",
        }
        data.update(fields)
        self.write_file(f"projects/registry/{project_id}-fixture.json", json.dumps(data))
        script = self.scripts / "check-kb-consistency.py"
        shutil.copyfile(SCRIPTS / script.name, script)
        return subprocess.run([sys.executable, str(script)], capture_output=True, text=True)

    def document(self, path, day=1):
        target = self.write_file(path, "# Fixture\n")
        timestamp = datetime(2026, 2, day, 12).timestamp()
        os.utime(target, (timestamp, timestamp))
        return target

    def test_missing_second_proposal_fails(self):
        first = "planning/proposals/first.md"
        missing = "planning/proposals/missing.md"
        self.document(first)
        result = self.check_registry(documents={"proposal": [first, missing]})
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(f"documents.proposal[1] 指向的文件不存在 — {missing}", result.stdout)
        self.assertNotIn("documents.proposal[0]", result.stdout)

    def test_newer_list_document_warns(self):
        first = "planning/proposals/first.md"
        second = "planning/proposals/second.md"
        self.document(first)
        self.document(second, day=2)
        result = self.check_registry(documents={"proposal": [first, second]})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("documents.proposal[1] 文件最后修改 2026-02-02", result.stdout)
        self.assertNotIn("documents.proposal[0]", result.stdout)

    def test_optional_refs_and_report_directory_pass(self):
        report = self.document(".iter-skill/runs/report.md")
        timestamp = report.stat().st_mtime
        os.utime(report.parent, (timestamp, timestamp))
        result = self.check_registry(documents={
            "proposal": None,
            "review": "",
            "sprint": [],
            "report": ".iter-skill/runs/report.md",
            "reports_dir": ".iter-skill/runs/",
        })
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("条警告", result.stdout)

    def test_template_placeholders_pass(self):
        result = self.check_registry(
            template=True,
            status="template",
            created_date="YYYY-MM-DD",
            updated_date="YYYY-MM-DD",
            documents={
                "project": "projects/active/项目名称-YYYYMMDD.md",
                "proposal": ["planning/proposals/提案名称-YYYYMMDD.md"],
            },
            milestones=[{"date": "YYYY-MM-DD"}],
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("条警告", result.stdout)

    def test_historical_milestone_dates_warn_without_failing(self):
        result = self.check_registry(milestones=[
            {"date": "2026-02-02", "due_date": "2026-02-01"},
            {"date": "待定"},
            {"date": "2026-02-01", "due_date": "2026-02-02"},
        ])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("里程碑日期非时间升序", result.stdout)

    def test_alternate_milestone_dates_participate_in_ordering(self):
        for due_date, should_warn in [("2026-02-01", True), ("2026-02-03", False)]:
            with self.subTest(due_date=due_date):
                result = self.check_registry(milestones=[
                    {"date": "2026-02-02"},
                    {"due_date": due_date},
                ])
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual("里程碑日期非时间升序" in result.stdout, should_warn)


class SubmoduleCheckTests(CheckerFixture):
    """私有子模块跳过清单的行为（CI 里 GITHUB_TOKEN 克隆不到私有仓库）。"""

    def setUp(self):
        super().setUp()
        self.write_file(
            "projects/registry/PROJ-019-fixture.json",
            json.dumps({
                "id": "PROJ-019",
                "name": "Fixture",
                "status": "active",
                "priority": "medium",
                "created_date": "2026-01-01",
                "updated_date": "2026-02-01",
                "owner": "Fixture owner",
            }),
        )
        script = self.scripts / "check-kb-consistency.py"
        shutil.copyfile(SCRIPTS / script.name, script)

    def write_gitmodules(self, path="repos/hamr-demo"):
        self.write_file(
            ".gitmodules",
            f'[submodule "hamr-demo"]\n\tpath = {path}\n'
            f"\turl = https://example.invalid/hamr-demo.git\n",
        )

    def run_check(self):
        return subprocess.run(
            [sys.executable, str(self.scripts / "check-kb-consistency.py")],
            capture_output=True, text=True,
        )

    def test_uninitialized_submodule_fails(self):
        self.write_gitmodules()
        result = self.run_check()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("子模块 repos/hamr-demo 未初始化（缺少 .git）", result.stdout)

    def test_private_submodule_warns_instead_of_failing(self):
        self.write_gitmodules()
        self.write_file("scripts/private-submodules.txt", "repos/hamr-demo # 私有仓库\n")
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("已按 scripts/private-submodules.txt 跳过指针新鲜度检查", result.stdout)

    def test_stale_exclusion_entry_is_reported(self):
        self.write_gitmodules()
        self.write_file("scripts/private-submodules.txt", "repos/hamr-gone # 私有仓库\n")
        result = self.run_check()
        self.assertIn("清单已过期", result.stdout)
        self.assertIn("子模块 repos/hamr-demo 未初始化（缺少 .git）", result.stdout)


class PortCheckTests(CheckerFixture):
    def setUp(self):
        super().setUp()
        self.script = self.scripts / "check-port-consistency.sh"
        shutil.copyfile(SCRIPTS / self.script.name, self.script)
        self.infra_checker = self.write_file(
            "repos/hamr-infra/scripts/check-port-consistency.sh",
            '[[ "$HAMR_REPOS_ROOT" == "$(cd "$(dirname "$0")/../.." && pwd)" ]] || exit 8\n'
            "printf 'infra checker ran\\n'\n",
        )
        self.inputs = [
            self.write_file(f"repos/hamr-{service}/backend/.env.example", "PORT=3000\n")
            for service in ("account", "app", "demo", "jiabu")
        ]
        self.inputs.append(self.write_file("repos/hamr-api/.env.example", "PORT=3000\n"))

    def check_ports(self):
        return subprocess.run(
            ["bash", str(self.script)], cwd=self.scripts, capture_output=True, text=True,
            env={**os.environ, "HAMR_REPOS_ROOT": "/wrong-sibling-root"},
        )

    def test_complete_inputs_run_infra_checker_and_propagate_failure(self):
        result = self.check_ports()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("infra checker ran", result.stdout)
        self.infra_checker.write_text("exit 7\n", encoding="utf-8")
        result = self.check_ports()
        self.assertEqual(result.returncode, 7, result.stdout + result.stderr)

    def test_each_sibling_input_is_required(self):
        for path in self.inputs:
            with self.subTest(path=path.relative_to(self.root)):
                path.unlink()
                result = self.check_ports()
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn(str(path.relative_to(self.root)), result.stderr)
                self.assertNotIn("infra checker ran", result.stdout)
                path.write_text("PORT=3000\n", encoding="utf-8")

    def test_unusable_port_declarations_fail(self):
        path = self.inputs[-1]
        for declaration in ("# PORT=3000\n", "PORT= \n", "PORT=TBD\n", "PORT=3000\nPORT=3001\n"):
            with self.subTest(declaration=declaration):
                path.write_text(declaration, encoding="utf-8")
                result = self.check_ports()
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn(str(path.relative_to(self.root)), result.stderr)
                self.assertNotIn("infra checker ran", result.stdout)
