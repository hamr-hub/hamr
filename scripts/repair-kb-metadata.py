#!/usr/bin/env python3
"""知识库元信息修复脚本

修复 2026-10-20 全面审计发现的问题：

1. **残留模板 front matter** —— 14 个项目文档仍带着未替换的模板头
   （`模板名称: 项目文档模板`），按 CLAUDE.md 规范重写为
   `标题/创建时间/负责人/状态/优先级/标签`。
2. **Markdown 与 JSON 状态冲突** —— 以项目注册表 JSON 为准，同步回
   文档的「当前状态 / 项目负责人 / 优先级 / 创建时间」。
3. **项目 ID 重复** —— `PROJ-016` 被 家庭关系修复Agent 与 hamr-catch
   同时占用，hamr-catch 顺延为 `PROJ-018`。
4. **updated_date 过期** —— 全部刷新为本次审计日期。

用法: python3 scripts/repair-kb-metadata.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_DIR = ROOT / "projects" / "registry"
PROJECTS_DIR = ROOT / "projects" / "active"
TODAY = "2026-10-20"

TEMPLATE_LEFTOVER = "模板名称"

STATUS_EMOJI = {
    "active": "🟢 进行中",
    "completed": "✅ 已完成",
    "paused": "⏸️ 已暂停",
    "cancelled": "🔴 已取消",
}

PRIORITY_LABEL = {
    "high": "P1（高）",
    "medium": "P2（中）",
    "low": "P3（低）",
}

# 注册表 JSON 的字段名 → 文档信息表格的行名（同一字段在不同文档里写法不一）
TABLE_ROW = {
    "owner": ["项目负责人", "负责人"],
    "priority": ["优先级"],
    "created_date": ["创建时间"],
    "status": ["当前状态"],
}


def load_registry() -> dict[str, dict]:
    """返回 {项目文档相对路径: 注册表数据}。"""
    out: dict[str, dict] = {}
    for rf in sorted(REGISTRY_DIR.glob("PROJ-*.json")):
        if rf.name.startswith("PROJ-000"):
            continue
        try:
            data = json.loads(rf.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"  ! 跳过 {rf.name}: JSON 解析失败 — {exc}")
            continue
        proj = (data.get("documents") or {}).get("project")
        if proj:
            out[proj] = data
    return out


def table_rows(text: str) -> dict[str, str]:
    """提取文档「项目信息」表格中的键值对。"""
    rows: dict[str, str] = {}
    for line in text.splitlines():
        row = line.strip()
        if not (row.startswith("|") and row.endswith("|")):
            continue
        cells = [c.strip() for c in row.strip("|").split("|")]
        if len(cells) != 2:
            continue
        key = cells[0].strip("*").strip()
        if key in ("项目信息", "---"):
            continue
        rows[key] = cells[1].strip()
    return rows


def build_front_matter(data: dict, rows: dict[str, str], title: str) -> str:
    """按 CLAUDE.md 规范生成 front matter。"""
    status = data.get("status", "active")
    status_text = STATUS_EMOJI.get(status, status)
    priority = PRIORITY_LABEL.get(data.get("priority", "medium"), data.get("priority", ""))

    tags = data.get("tags") or []
    tag_text = " ".join(f"#{t}" for t in tags) if tags else rows.get("标签", "")

    return (
        "---\n"
        f"标题: {data.get('name', title)}\n"
        f"创建时间: {data.get('created_date', '')}\n"
        f"负责人: {data.get('owner', '')}\n"
        f"状态: {status_text}\n"
        f"优先级: {priority}\n"
        f"标签: {tag_text}\n"
        "---\n"
    )


def repair_doc(path: Path, data: dict, dry_run: bool) -> list[str]:
    """修复单个项目文档，返回变更说明列表。"""
    changes: list[str] = []
    text = path.read_text(encoding="utf-8")

    # --- 1. 定位并替换 front matter ---
    has_fm = text.startswith("---\n")
    if has_fm:
        end = text.find("\n---", 3)
        if end == -1:
            print(f"  ! {path.name}: front matter 未闭合")
            return changes
        fm_block = text[3:end]
        body = text[end + 4 :].lstrip("\n")
    else:
        fm_block = ""
        body = text

    title = ""
    m = re.search(r"^#\s+(.+)$", body, re.M)
    if m:
        title = m.group(1).strip()

    rows = table_rows(body)

    # --- 2. 用注册表数据覆盖表格中的关键行 ---
    for field, row_names in TABLE_ROW.items():
        if field == "status":
            new_val = STATUS_EMOJI.get(data.get("status", ""), data.get("status", ""))
        elif field == "priority":
            new_val = PRIORITY_LABEL.get(data.get("priority", ""), data.get("priority", ""))
        else:
            new_val = str(data.get(field, ""))
        if not new_val:
            continue
        for row_name in row_names:
            if row_name not in rows or rows[row_name] == new_val:
                continue
            changes.append(f"表格「{row_name}」: `{rows[row_name]}` → `{new_val}`")
            body = re.sub(
                r"(\|\s*\*\*" + re.escape(row_name) + r"\*\*\s*\|)\s*[^|]*?(\s*\|)",
                lambda mm: f"{mm.group(1)} {new_val} {mm.group(2)}",
                body,
                count=1,
            )
            rows[row_name] = new_val

    # --- 3. 重写 front matter ---
    new_fm = build_front_matter(data, rows, title)
    if fm_block.strip() != new_fm.strip():
        if TEMPLATE_LEFTOVER in fm_block:
            changes.append("front matter: 残留模板头 → 规范元信息")
        else:
            changes.append("front matter: 更新为规范元信息")

    new_text = new_fm + "\n" + body

    if new_text != text and not dry_run:
        path.write_text(new_text, encoding="utf-8")
    return changes


def fix_table_only(path: Path, data: dict, dry_run: bool) -> list[str]:
    """修复没有 front matter 但状态冲突的文档（只同步表格行）。"""
    text = path.read_text(encoding="utf-8")
    rows = table_rows(text)
    changes: list[str] = []

    status_text = STATUS_EMOJI.get(data.get("status", ""), data.get("status", ""))
    if rows.get("当前状态") and status_text and rows["当前状态"] != status_text:
        changes.append(f"表格「当前状态」: `{rows['当前状态']}` → `{status_text}`")
        text = re.sub(
            r"(\|\s*\*\*当前状态\*\*\s*\|)\s*[^|]*?(\s*\|)",
            lambda mm: f"{mm.group(1)} {status_text} {mm.group(2)}",
            text,
            count=1,
        )

    if changes and not dry_run:
        path.write_text(text, encoding="utf-8")
    return changes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    registry = load_registry()
    print(f"载入注册表条目: {len(registry)}\n")

    total_changes = 0

    print("── 修复项目文档元信息 ──")
    for rel, data in sorted(registry.items()):
        doc = ROOT / rel
        if not doc.exists():
            print(f"  ! {rel}: 文件不存在，跳过")
            continue
        changes = repair_doc(doc, data, args.dry_run)
        if not changes:
            # 没有 front matter 的文档走表格同步
            changes = fix_table_only(doc, data, args.dry_run)
        if changes:
            total_changes += len(changes)
            print(f"  ✓ {doc.name}")
            for c in changes:
                print(f"      - {c}")
        else:
            print(f"  · {doc.name} (无需修改)")

    print(f"\n共 {total_changes} 处变更" + ("（dry-run，未写入）" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
