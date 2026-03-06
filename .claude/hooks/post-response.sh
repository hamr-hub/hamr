#!/bin/bash
# HamR 对话结束 Hook
# 触发时机: Claude 完成每次响应后 (Stop 事件)
# 功能: 分析 git 变更 -> 自动 review -> 提交推送

set -e

INPUT=$(cat)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

cd "$CWD" 2>/dev/null || exit 0

if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  exit 0
fi

STAGED=$(git diff --cached --name-only 2>/dev/null)
UNSTAGED=$(git diff --name-only 2>/dev/null)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)
CHANGED_FILES="${STAGED}${UNSTAGED}${UNTRACKED}"

if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

CHANGED_COUNT=$(echo "$CHANGED_FILES" | grep -c . 2>/dev/null || echo 0)
DIFF_SUMMARY=$(git diff --stat HEAD 2>/dev/null | tail -1 || echo "")
if [ -z "$DIFF_SUMMARY" ]; then
  DIFF_SUMMARY=$(git status --short 2>/dev/null | head -10)
fi

DATE=$(date '+%Y-%m-%d')
TIME=$(date '+%H:%M')

MD_CHANGES=$(echo "$CHANGED_FILES" | grep -E '\.(md|json)$' | head -5)
SCRIPT_CHANGES=$(echo "$CHANGED_FILES" | grep -E '\.(sh|py|js|ts|rs)$' | head -5)
DOC_CHANGES=$(echo "$CHANGED_FILES" | grep -v -E '\.(sh|py|js|ts|rs|json)$' | head -5)

REVIEW_ISSUES=""

if echo "$CHANGED_FILES" | grep -q '\.json$'; then
  for f in $(echo "$CHANGED_FILES" | grep '\.json$'); do
    if [ -f "$f" ]; then
      if ! jq empty "$f" 2>/dev/null; then
        REVIEW_ISSUES="${REVIEW_ISSUES}\n- JSON 格式错误: $f"
      fi
    fi
  done
fi

if echo "$CHANGED_FILES" | grep -q '\.sh$'; then
  for f in $(echo "$CHANGED_FILES" | grep '\.sh$'); do
    if [ -f "$f" ] && command -v bash &>/dev/null; then
      if ! bash -n "$f" 2>/dev/null; then
        REVIEW_ISSUES="${REVIEW_ISSUES}\n- Shell 语法错误: $f"
      fi
    fi
  done
fi

if [ -n "$REVIEW_ISSUES" ]; then
  echo "发现问题，暂不提交：$REVIEW_ISSUES" >&2
  exit 0
fi

if echo "$CHANGED_FILES" | grep -qE '\.(sh)$'; then
  for f in $(echo "$CHANGED_FILES" | grep '\.sh$'); do
    if [ -f "$f" ] && [ ! -x "$f" ]; then
      chmod +x "$f"
    fi
  done
fi

COMMIT_TYPE="update"
if echo "$CHANGED_FILES" | grep -q 'projects/registry/PROJ-'; then
  if git diff HEAD -- $(echo "$CHANGED_FILES" | grep 'projects/registry/PROJ-' | head -1) 2>/dev/null | grep -q '"status": "completed"'; then
    COMMIT_TYPE="update"
  fi
fi
if echo "$CHANGED_FILES" | grep -qE 'projects/active/.*\.md$' && ! git ls-files --error-unmatch $(echo "$CHANGED_FILES" | grep -E 'projects/active/.*\.md$' | head -1) 2>/dev/null; then
  COMMIT_TYPE="feat"
fi
if echo "$CHANGED_FILES" | grep -q 'projects/archived/'; then
  COMMIT_TYPE="archive"
fi
if echo "$CHANGED_FILES" | grep -qE '\.(sh|py)$' && [ -z "$(echo "$CHANGED_FILES" | grep -vE '\.(sh|py)$')" ]; then
  COMMIT_TYPE="feat"
fi

if [ -n "$SCRIPT_CHANGES" ]; then
  MAIN_CHANGE=$(echo "$SCRIPT_CHANGES" | head -1 | xargs basename 2>/dev/null)
  COMMIT_MSG="${COMMIT_TYPE}: 添加/更新脚本 ${MAIN_CHANGE} [${DATE}]"
elif [ -n "$MD_CHANGES" ]; then
  MAIN_CHANGE=$(echo "$MD_CHANGES" | head -1 | xargs basename 2>/dev/null | sed 's/\.md$//')
  COMMIT_MSG="${COMMIT_TYPE}: 更新文档 ${MAIN_CHANGE} [${DATE}]"
else
  COMMIT_MSG="${COMMIT_TYPE}: 更新 ${CHANGED_COUNT} 个文件 [${DATE}]"
fi

git add -A 2>/dev/null

if git diff --cached --quiet 2>/dev/null; then
  exit 0
fi

git commit -m "$COMMIT_MSG" 2>/dev/null

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if git remote get-url origin > /dev/null 2>&1; then
  git push origin "$CURRENT_BRANCH" 2>/dev/null || true
fi

SYSTEM_MSG="已自动提交并推送变更：\"${COMMIT_MSG}\"（${CHANGED_COUNT} 个文件，${DATE} ${TIME}）"
echo "{\"systemMessage\": \"${SYSTEM_MSG}\"}"
