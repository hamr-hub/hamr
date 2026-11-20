#!/usr/bin/env bash
# 用法（仓库根目录）: bash scripts/check-port-consistency.sh
set -euo pipefail

repos_root="$(cd "$(dirname "$0")/../repos" && pwd)"
backend_env_files=(
    hamr-account/backend/.env.example
    hamr-app/backend/.env.example
    hamr-demo/backend/.env.example
    hamr-jiabu/backend/.env.example
    hamr-api/.env.example
)

# Infra 允许单仓运行并跳过缺失输入。根仓 checkout 包含完整的端口契约。
missing_input=0
for file in "${backend_env_files[@]}"; do
    path="$repos_root/$file"
    if [[ ! -f "$path" || ! -r "$path" ]]; then
        printf 'FAIL: repos/%s 缺失或无法读取\n' "$file" >&2
        missing_input=1
    elif ! port_line="$(grep '^PORT=' "$path")" ||
         [[ ! "$port_line" =~ ^PORT=[[:blank:]]*[0-9]+[[:space:]]*$ ]]; then
        printf 'FAIL: repos/%s 必须包含一条有效的数字 PORT= 声明\n' "$file" >&2
        missing_input=1
    fi
done
if [[ "$missing_input" -ne 0 ]]; then
    exit 1
fi

HAMR_REPOS_ROOT="$repos_root" exec bash "$repos_root/hamr-infra/scripts/check-port-consistency.sh"
