#!/usr/bin/env bash
# 在 CI 中初始化子模块。
#
# 为什么不用 actions/checkout 的 `submodules: recursive`：任何一个私有仓库
# 克隆失败都会让整个 job 失败（2026-11-20 根仓 CI 就是这样挂掉的）。
# 这里改成显式初始化：跳过 scripts/private-submodules.txt 里列出的私有路径，
# 其余子模块照常初始化并补齐 origin/main 引用，好让知识库检查器真的能比较
# 「索引指针 vs 上游最新提交」，而不是因为缺少 origin/main 而静默跳过。
#
# 可选：设置 HAMR_CROSS_REPO_TOKEN（有权限访问私有仓库的令牌）后，清单里的
# 子模块也会被克隆，CI 恢复完整的新鲜度校验。
#
# 用法（仓库根目录）: bash scripts/ci-init-submodules.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIST="scripts/private-submodules.txt"

is_skipped() {
  candidate="$1"
  [[ -f "$LIST" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(printf '%s' "$line" | tr -d '[:space:]')"
    [[ -z "$line" ]] && continue
    if [[ "$line" == "$candidate" ]]; then
      return 0
    fi
  done < "$LIST"
  return 1
}

all_paths=()
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  all_paths+=("$path")
done < <(git config -f .gitmodules --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}')

if [[ ${#all_paths[@]} -eq 0 ]]; then
  echo "没有登记任何子模块，跳过初始化"
  exit 0
fi

git submodule sync --recursive

wanted=()
skipped=()
for path in "${all_paths[@]}"; do
  if is_skipped "$path"; then
    skipped+=("$path")
  else
    wanted+=("$path")
  fi
done

if [[ ${#wanted[@]} -gt 0 ]]; then
  echo "初始化子模块: ${wanted[*]}"
  git submodule update --init --force --recursive -- "${wanted[@]}"
else
  echo "没有需要初始化的公开子模块"
fi

# 补齐 origin/main 引用：否则检查器只能发出「缺少 origin/main」的警告，
# 指针新鲜度实际上没有被比较。
if [[ ${#wanted[@]} -gt 0 ]]; then
  for path in "${wanted[@]}"; do
    git -C "$path" fetch --quiet origin '+refs/heads/*:refs/remotes/origin/*' 2>/dev/null \
      || echo "警告: ${path} 未能获取 origin/main，跳过该子模块的新鲜度比较" >&2
  done
fi

if [[ ${#skipped[@]} -eq 0 ]]; then
  exit 0
fi

for path in "${skipped[@]}"; do
  if [[ -n "${HAMR_CROSS_REPO_TOKEN:-}" ]]; then
    echo "使用 HAMR_CROSS_REPO_TOKEN 尝试克隆私有子模块 $path"
    header="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$HAMR_CROSS_REPO_TOKEN" | base64 | tr -d '\n')"
    if git -c "http.https://github.com/.extraheader=$header" \
         submodule update --init --force --recursive -- "$path"; then
      echo "私有子模块 $path 克隆成功，恢复完整新鲜度校验"
      continue
    fi
    echo "私有子模块 $path 克隆失败（令牌权限不足），按清单跳过" >&2
  else
    echo "跳过私有子模块 ${path}（未提供 HAMR_CROSS_REPO_TOKEN，见 scripts/private-submodules.txt）" >&2
  fi
done
