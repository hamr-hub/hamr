# 🚀 HamR 项目推送到 GitHub 指南

## 📋 需要完成的步骤

### 步骤 1: 在 GitHub 创建仓库

#### 选项 A: 批量创建（最快）

访问 GitHub，使用以下命令（需要 `gh` CLI）：

```bash
# 安装 GitHub CLI（如未安装）
brew install gh

# 登录
gh auth login

# 运行自动创建脚本
cd /Users/hyx/codespace/hamr/repos
bash create-github-repos.sh
```

#### 选项 B: 手动创建（推荐如果没有 gh CLI）

访问 https://github.com/organizations/hamr-hub/repositories/new

创建以下 **12 个空仓库**（不要添加 README、.gitignore 或 License）：

1. ✅ `hamr-website` - HamR 官网 (hamr.store)
2. ✅ `hamr-account` - HamR 账号中心 (account.hamr.store)
3. ✅ `hamr-help` - HamR 帮助中心 (help.hamr.store)
4. ✅ `hamr-app` - HamR 管家应用 (app.hamr.store)
5. ✅ `hamr-developer` - HamR 开发者门户 (hamr.top)
6. ✅ `hamr-docs` - HamR 技术文档站 (docs.hamr.top)
7. ✅ `hamr-api` - HamR API 网关 (api.hamr.top)
8. ✅ `hamr-deploy` - HamR 部署指南站 (deploy.hamr.top)
9. ✅ `hamr-demo` - HamR 在线演示环境 (demo.hamr.top)
10. ✅ `hamr-status` - HamR 服务监控 (status.hamr.top)
11. ✅ `hamr-jiabu` - JiaBu 决策系统 (jiabu.hamr.store)
12. ✅ `hamr-infra` - HamR 基础设施运维

**重要**：创建时选择 **Public** 可见性，**不要**勾选任何初始化选项。

### 步骤 2: 推送所有项目

仓库创建完成后，运行：

```bash
cd /Users/hyx/codespace/hamr/repos

# 方式 1: 自动推送所有项目（推荐）
bash push-to-github.sh

# 方式 2: 手动推送单个项目
cd hamr-website
git remote add origin git@github.com:hamr-hub/hamr-website.git
git push -u origin main
```

### 步骤 3: 验证推送

访问仓库确认代码已推送：
- https://github.com/hamr-hub

## 🔑 SSH 密钥配置

如果遇到权限问题，请确保：

```bash
# 检查 SSH 密钥
ls -la ~/.ssh/id_*.pub

# 如果没有，生成新密钥
ssh-keygen -t ed25519 -C "your_email@example.com"

# 添加到 ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# 复制公钥
cat ~/.ssh/id_ed25519.pub

# 添加到 GitHub: https://github.com/settings/keys
```

## 📝 推送脚本说明

已创建 3 个辅助脚本：

1. **`create-github-repos.sh`** - 使用 GitHub CLI 自动创建仓库
2. **`push-to-github.sh`** - 批量推送所有项目
3. **`deploy-all.sh`** - 一键创建 + 推送（推荐）

## ⚠️ 常见问题

### Q1: 推送失败 "Repository not found"
**A**: 仓库未创建或名称不匹配，请检查仓库是否存在于 `hamr-hub` 组织下。

### Q2: 推送失败 "Permission denied"
**A**: SSH 密钥未配置或无权限，请按上述步骤配置 SSH 密钥。

### Q3: 推送失败 "rejected"
**A**: 远程仓库有内容，使用 `git push --force` 强制推送（谨慎使用）。

## 📞 需要帮助？

查看日志文件：
```bash
cd /Users/hyx/codespace/hamr/repos
cat push-to-github.log  # 如果脚本生成了日志
```

或手动测试单个仓库：
```bash
cd hamr-website
git remote -v
git push -v origin main
```
