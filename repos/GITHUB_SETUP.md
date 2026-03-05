# HamR 项目 GitHub 仓库创建指南

## 需要创建的仓库

请在 GitHub hamr-hub 组织下创建以下 **12 个仓库**：

### 方法一：使用 GitHub Web 界面

访问 https://github.com/organizations/hamr-hub/repositories/new 创建以下仓库：

| 序号 | 仓库名称 | 描述 | 可见性 |
|------|---------|------|--------|
| 1 | `hamr-website` | HamR 官网 (hamr.store) | Public |
| 2 | `hamr-account` | HamR 账号中心 (account.hamr.store) | Public |
| 3 | `hamr-help` | HamR 帮助中心 (help.hamr.store) | Public |
| 4 | `hamr-app` | HamR 管家应用 (app.hamr.store) | Public |
| 5 | `hamr-developer` | HamR 开发者门户 (hamr.top) | Public |
| 6 | `hamr-docs` | HamR 技术文档站 (docs.hamr.top) | Public |
| 7 | `hamr-api` | HamR API 网关 (api.hamr.top) | Public |
| 8 | `hamr-deploy` | HamR 部署指南站 (deploy.hamr.top) | Public |
| 9 | `hamr-demo` | HamR 在线演示环境 (demo.hamr.top) | Public |
| 10 | `hamr-status` | HamR 服务监控 (status.hamr.top) | Public |
| 11 | `hamr-jiabu` | JiaBu 决策系统 (jiabu.hamr.store) | Public |
| 12 | `hamr-infra` | HamR 基础设施运维 | Public |

**创建时选项**：
- ❌ 不要添加 README.md（本地已有）
- ❌ 不要添加 .gitignore（本地已有）
- ❌ 不要添加 License（可选）
- ✅ 创建为**空仓库**

### 方法二：使用 GitHub CLI（推荐）

如果你安装了 GitHub CLI (`gh`)，可以运行：

```bash
# 登录 GitHub CLI
gh auth login

# 运行自动创建脚本
cd /Users/hyx/codespace/hamr/repos
bash create-github-repos.sh
```

### 方法三：手动使用 curl + GitHub API

需要 Personal Access Token，见 `create-github-repos-api.sh`

## 创建完成后

仓库创建完成后，运行推送脚本：

```bash
cd /Users/hyx/codespace/hamr/repos
bash push-to-github.sh
```

## 仓库 URL 列表

创建完成后，仓库地址为：

- https://github.com/hamr-hub/hamr-website
- https://github.com/hamr-hub/hamr-account
- https://github.com/hamr-hub/hamr-help
- https://github.com/hamr-hub/hamr-app
- https://github.com/hamr-hub/hamr-developer
- https://github.com/hamr-hub/hamr-docs
- https://github.com/hamr-hub/hamr-api
- https://github.com/hamr-hub/hamr-deploy
- https://github.com/hamr-hub/hamr-demo
- https://github.com/hamr-hub/hamr-status
- https://github.com/hamr-hub/hamr-jiabu
- https://github.com/hamr-hub/hamr-infra
