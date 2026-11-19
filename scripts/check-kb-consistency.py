#!/usr/bin/env python3
"""知识库一致性检查器

验证 AGENTS.md「文档质量检查清单」中的可自动化项：
- JSON 注册表格式可解析、必填字段完整
- 项目 ID 唯一
- documents.* 路径真实存在
- Markdown 与 JSON 的状态/名称一致
- updated_date 与文件最后修改时间的关系
- 子模块**索引指针**相对 origin/main 的新鲜度（落后 > 20 提交即失败），
  以及工作区↔索引漂移、指针领先上游（疑似子仓库提交未推送）

用法: python3 scripts/check-kb-consistency.py
退出码: 0 = 全部通过, 1 = 存在 FAIL
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "projects" / "registry"

REQUIRED_FIELDS = ("id", "name", "status", "priority", "created_date", "updated_date", "owner")
VALID_STATUS = {"active", "completed", "cancelled", "paused"}
VALID_PRIORITY = {"high", "medium", "low"}

STATUS_EMOJI = {
    "active": "🟢",
    "completed": "✅",
    "paused": "⏸️",
    "cancelled": "🔴",
}

errors: list[str] = []
warnings: list[str] = []
notes: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def git_output(args: list[str], cwd: Path) -> str | None:
    """运行只读 git 命令，返回去空白后的 stdout；失败返回 None。"""
    try:
        result = subprocess.run(
            ["git", *args], cwd=str(cwd), capture_output=True, text=True, timeout=30
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


TABLE_KEY_MAP = {
    "项目名称": "标题",
    "标题": "标题",
    "当前状态": "状态",
    "状态": "状态",
    "创建时间": "创建时间",
    "项目负责人": "负责人",
}


def parse_front_matter(path: Path) -> dict:
    """解析项目文档元信息。

    支持两种写法（项目文档中两种并存）：
    1. YAML front matter —— ``标题/创建时间/负责人/状态``
    2. Markdown 表格 —— ``| **当前状态** | 🟢 进行中 |``
    """
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        return {"__error__": str(exc)}

    meta: dict = {}

    # --- 1. YAML front matter ---
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            for line in text[3:end].splitlines():
                line = line.strip()
                if not line or line.startswith("#") or ":" not in line:
                    continue
                key, _, val = line.partition(":")
                meta[key.strip()] = val.strip().strip("'\"")

    # --- 2. 项目信息表格 ---
    for line in text.splitlines():
        row = line.strip()
        if not (row.startswith("|") and row.endswith("|")):
            continue
        cells = [c.strip() for c in row.strip("|").split("|")]
        if len(cells) != 2:
            continue
        key = cells[0].strip("*").strip()
        if key in TABLE_KEY_MAP:
            meta.setdefault(TABLE_KEY_MAP[key], cells[1].strip())

    # --- 3. 残留的模板占位 front matter ---
    if "模板名称" in meta or "适用场景" in meta:
        meta["__template_leftover__"] = meta.get("模板名称", "未知模板")

    return meta


def main() -> int:
    registry_files = sorted(REGISTRY.glob("PROJ-*.json"))
    if not registry_files:
        print("FAIL: 未找到任何注册表文件")
        return 1

    id_to_files: dict[str, list[str]] = defaultdict(list)
    name_to_files: dict[str, list[str]] = defaultdict(list)
    registry: dict[str, dict] = {}

    # ---------- 1. 注册表逐项检查 ----------
    for rf in registry_files:
        rel = rf.relative_to(ROOT)
        try:
            data = json.loads(rf.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            fail(f"{rel}: JSON 解析失败 — {exc}")
            continue

        is_template = rf.name.startswith("PROJ-000")
        registry[rf.name] = data

        # 必填字段
        for field in REQUIRED_FIELDS:
            if field not in data or data[field] in ("", None):
                if is_template and field in ("owner", "created_date", "updated_date"):
                    continue  # 模板允许占位
                fail(f"{rel}: 缺少必填字段 `{field}`")

        pid = str(data.get("id", ""))
        if pid:
            id_to_files[pid].append(rf.name)
        nm = str(data.get("name", ""))
        if nm:
            name_to_files[nm].append(rf.name)

        # 枚举值
        if data.get("status") and data["status"] not in VALID_STATUS:
            if is_template:
                pass  # 模板使用 status="template" 占位
            else:
                fail(f"{rel}: status=`{data['status']}` 不在 {sorted(VALID_STATUS)} 内")
        if data.get("priority") and data["priority"] not in VALID_PRIORITY:
            if not is_template:
                fail(f"{rel}: priority=`{data['priority']}` 不在 {sorted(VALID_PRIORITY)} 内")

        # 日期格式
        for field in ("created_date", "updated_date"):
            val = str(data.get(field, ""))
            if not val:
                continue
            if val in ("YYYY-MM-DD", "TBD", "待定"):
                if not is_template:
                    warn(f"{rel}: {field} 仍是占位符 `{val}`")
                continue
            try:
                datetime.strptime(val, "%Y-%m-%d")
            except ValueError:
                fail(f"{rel}: {field}=`{val}` 不是 YYYY-MM-DD 格式")

        # documents 路径存在性
        docs = data.get("documents") or {}
        for key, value in docs.items():
            if not value or not isinstance(value, str):
                continue
            if is_template and ("YYYYMMDD" in value or "名称" in value):
                continue  # 模板中的占位路径不算断链
            target = ROOT / value
            if not target.exists():
                fail(f"{rel}: documents.{key} 指向的文件不存在 — {value}")

        # 里程碑日期顺序
        milestones = data.get("milestones") or []
        dates = [m.get("due_date") for m in milestones if m.get("due_date")]
        try:
            parsed = [datetime.strptime(d, "%Y-%m-%d").date() for d in dates]
        except ValueError:
            parsed = []
        if parsed and parsed != sorted(parsed):
            warn(f"{rel}: 里程碑 due_date 非时间升序")

        # Markdown / JSON 状态一致性
        proj_path = docs.get("project")
        if proj_path:
            mp = ROOT / proj_path
            if mp.exists():
                fm = parse_front_matter(mp)
                if fm and not fm.get("__error__"):
                    if fm.get("__template_leftover__"):
                        fail(
                            f"{proj_path}: 残留模板 front matter "
                            f"(`模板名称: {fm['__template_leftover__']}`) — 未替换为真实项目元信息"
                        )
                    md_status = fm.get("状态", "")
                    json_status = data.get("status", "")
                    emoji = STATUS_EMOJI.get(json_status, "")
                    if not md_status:
                        fail(f"{rel} ↔ {proj_path}: Markdown 缺少可解析的状态字段")
                    elif emoji and emoji not in md_status and json_status not in md_status:
                        fail(
                            f"{rel} ↔ {proj_path}: 状态不一致 "
                            f"(JSON=`{json_status}`, Markdown=`{md_status}`)"
                        )
                    md_title = fm.get("标题", "")
                    if md_title and nm and md_title.strip() != nm.strip():
                        notes.append(
                            f"{rel} ↔ {proj_path}: 标题略有差异 "
                            f"(JSON=`{nm}` / Markdown=`{md_title}`)"
                        )

    # ---------- 2. ID 唯一性 ----------
    for pid, files in sorted(id_to_files.items()):
        if len(files) > 1:
            fail(f"项目 ID 重复 `{pid}`: {', '.join(files)}")

    # ---------- 3. updated_date 与文件 mtime ----------
    for rf_name, data in registry.items():
        upd = data.get("updated_date")
        if not upd or upd in ("YYYY-MM-DD",):
            continue
        try:
            d = datetime.strptime(upd, "%Y-%m-%d").date()
        except ValueError:
            continue
        for key, value in (data.get("documents") or {}).items():
            if not value or not isinstance(value, str):
                continue
            target = ROOT / value
            if not target.exists():
                continue
            mtime = datetime.fromtimestamp(target.stat().st_mtime).date()
            if mtime > d:
                warn(
                    f"{rf_name}: documents.{key} 文件最后修改 {mtime} "
                    f"晚于 updated_date {d} — 注册表未同步"
                )

    # ---------- 4. projects/active 目录卫生 ----------
    active_dir = ROOT / "projects" / "active"
    for md in sorted(active_dir.glob("*.md")):
        if md.name == "README.md":
            continue
        if re.search(r"(报告|report)", md.name):
            warn(f"projects/active/{md.name}: 报告类文档应归档到 execution/reports/")

    # ---------- 5. 子模块指针新鲜度 ----------
    # 子模块指针长期不更新，会让"仓库里看到的代码"与上游实际代码相差数月，
    # 任何基于仓库现状的分析结论都因此失真（2026-10-20 审计的关键发现）。
    gitmodules = ROOT / ".gitmodules"
    if gitmodules.exists():
        submodules = gitmodules.read_text(encoding="utf-8")
        paths = re.findall(r'path\s*=\s*(\S+)', submodules)
        max_lag = 20  # 允许的落后提交数
        for rel in paths:
            sm = ROOT / rel
            if not (sm / ".git").exists():
                fail(f"子模块 {rel} 未初始化（缺少 .git）")
                continue

            # 比对对象必须是索引记录的 gitlink SHA（CI 全新 checkout、他人 clone
            # 实际拿到的提交），而不是子模块工作区当前的 HEAD —— 后者可能已被
            # 手动切到新提交却忘记 git add 回超级项目（2026-11-19 在
            # hamr-mood-calender 上实际发生，旧版检查器因此漏报）。
            recorded_sha = ""
            ls = git_output(["ls-files", "-s", rel], ROOT)
            if ls:
                parts = ls.split()
                if len(parts) >= 2 and parts[0] == "160000":
                    recorded_sha = parts[1]

            worktree_head = git_output(["rev-parse", "HEAD"], sm)
            upstream = git_output(["rev-parse", "origin/main"], sm)

            if not upstream:
                warn(f"子模块 {rel}: 缺少 origin/main，跳过新鲜度检查")
                continue
            if not recorded_sha:
                warn(f"子模块 {rel}: 超级项目索引中无 gitlink 记录，跳过")
                continue

            # 工作区 ↔ 索引漂移：本地 checkout 了别的提交，可能忘记 bump 指针
            if worktree_head and worktree_head != recorded_sha:
                warn(
                    f"子模块 {rel}: 工作区 HEAD {worktree_head[:7]} 与索引记录的指针 "
                    f"{recorded_sha[:7]} 不一致 —— 若要更新指针请 `git add {rel}`"
                )

            if recorded_sha == upstream:
                lag, ahead = 0, 0
            else:
                behind_s = git_output(["rev-list", "--count", f"{recorded_sha}..{upstream}"], sm)
                ahead_s = git_output(["rev-list", "--count", f"{upstream}..{recorded_sha}"], sm)
                if behind_s is None or ahead_s is None:
                    warn(f"子模块 {rel}: 无法比较索引指针与 origin/main（记录 {recorded_sha[:7]}）")
                    continue
                lag, ahead = int(behind_s), int(ahead_s)

            if lag > max_lag:
                fail(
                    f"子模块 {rel}: 索引指针落后 origin/main {lag} 个提交"
                    f"（阈值 {max_lag}）—— 请同步并 bump 指针"
                )
            elif lag > 0:
                notes.append(f"子模块 {rel}: 索引指针落后 origin/main {lag} 个提交")

            # 指针领先上游 = 子仓库本地提交尚未推送；此时超级项目若已推送，
            # 他人 clone 会因取不到该 gitlink 对象而失败。
            if ahead > 0:
                warn(
                    f"子模块 {rel}: 索引指针领先 origin/main {ahead} 个提交 —— "
                    f"疑似子仓库本地提交尚未推送；请先推送子仓库，再推送超级项目"
                )

    # ---------- 输出 ----------
    print("=" * 68)
    print("HamR 知识库一致性检查")
    print("=" * 68)
    print(f"注册表条目: {len(registry_files)}")
    print()
    if notes:
        print(f"ℹ️  {len(notes)} 条提示:")
        for n in notes:
            print(f"   - {n}")
        print()
    if warnings:
        print(f"⚠️  {len(warnings)} 条警告:")
        for w in warnings:
            print(f"   - {w}")
        print()
    if errors:
        print(f"❌ {len(errors)} 条错误:")
        for e in errors:
            print(f"   - {e}")
        print()
        print("结果: FAIL")
        return 1

    print("✅ 结果: PASS — 未发现一致性问题")
    return 0


if __name__ == "__main__":
    sys.exit(main())
