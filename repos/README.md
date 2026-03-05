# HamR 项目仓库总览

> HamR (Home Assistant Manager & Reasoner) - 数据主权的家庭智能助理

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![GitHub Organization](https://img.shields.io/badge/org-hamr--hub-orange)](https://github.com/hamr-hub)

## 📋 项目简介

HamR 是一个开源的家庭智能助理平台，致力于帮助家庭管理五维数据（人/时/事/物/境），并通过 AI 决策引擎提供智能建议。

**核心理念**：
- 🔐 **数据主权**: 用户拥有完整数据控制权
- 🏠 **私有部署**: 支持本地部署，保护隐私
- 🌍 **开源透明**: 核心代码开源，社区驱动
- 🤖 **智能决策**: AI 辅助决策，提升幸福感

## 🏗️ 项目架构

本仓库使用 **Git 子模块** 管理所有项目，每个服务独立仓库，便于独立开发和部署。

### 📦 项目清单（12 个）

| # | 项目 | 域名 | 描述 | 仓库 |
|---|------|------|------|------|
| 1 | **官网建设** | [hamr.store](https://hamr.store) | 品牌展示门户 | [hamr-website](https://github.com/hamr-hub/hamr-website) |
| 2 | **账号中心** | [account.hamr.store](https://account.hamr.store) | 身份认证与家庭管理 | [hamr-account](https://github.com/hamr-hub/hamr-account) |
| 3 | **帮助中心** | [help.hamr.store](https://help.hamr.store) | 用户自助服务 | [hamr-help](https://github.com/hamr-hub/hamr-help) |
| 4 | **HamR 管家** | [app.hamr.store](https://app.hamr.store) | 五维数据管理核心应用 | [hamr-app](https://github.com/hamr-hub/hamr-app) |
| 5 | **开发者门户** | [hamr.top](https://hamr.top) | 技术品牌入口 | [hamr-developer](https://github.com/hamr-hub/hamr-developer) |
| 6 | **技术文档站** | [docs.hamr.top](https://docs.hamr.top) | API 参考与架构文档 | [hamr-docs](https://github.com/hamr-hub/hamr-docs) |
| 7 | **API 服务** | [api.hamr.top](https://api.hamr.top) | 统一 API 网关 | [hamr-api](https://github.com/hamr-hub/hamr-api) |
| 8 | **部署指南站** | [deploy.hamr.top](https://deploy.hamr.top) | 私有部署支持 | [hamr-deploy](https://github.com/hamr-hub/hamr-deploy) |
| 9 | **在线演示** | [demo.hamr.top](https://demo.hamr.top) | 零门槛体验环境 | [hamr-demo](https://github.com/hamr-hub/hamr-demo) |
| 10 | **服务监控** | [status.hamr.top](https://status.hamr.top) | 服务状态透明页面 | [hamr-status](https://github.com/hamr-hub/hamr-status) |
| 11 | **JiaBu 决策** | [jiabu.hamr.store](https://jiabu.hamr.store) | 智能决策引擎 | [hamr-jiabu](https://github.com/hamr-hub/hamr-jiabu) |
| 12 | **基础设施** | - | DNS/监控/备份/安全 | [hamr-infra](https://github.com/hamr-hub/hamr-infra) |

## 🎯 五维管理体系

HamR 管家提供五维家庭数据管理：

1. **人（Person）**: 成员档案、关系图谱、重要日期
2. **时（Time）**: 家庭日历、日程管理、时间统计
3. **事（Task）**: 待办清单、大事记、决策记录
4. **物（Item）**: 家庭资产、物品分类、消耗品管理
5. **境（Environment）**: 环境监测、场景管理、空间管理

## 🚀 快速开始

### 克隆项目（含子模块）

```bash
# 克隆主仓库和所有子模块
git clone --recursive https://github.com/hamr-hub/hamr.git
cd hamr

# 或者先克隆主仓库，再初始化子模块
git clone https://github.com/hamr-hub/hamr.git
cd hamr
git submodule update --init --recursive
```

### 本地开发

每个子项目都有独立的 README，参考各项目文档：

```bash
# 进入具体项目
cd repos/hamr-website

# 查看 README
cat README.md

# 启动开发环境
npm install
npm run dev
```

### 私有部署

```bash
# 使用 Docker Compose 一键部署
cd repos/hamr-deploy
./scripts/install.sh
```

详见 [部署指南](https://deploy.hamr.top)

## 🛠️ 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **样式**: Tailwind CSS
- **状态**: TanStack Query
- **图表**: Recharts

### 后端
- **语言**: Rust
- **框架**: Axum
- **数据库**: PostgreSQL + MongoDB + Redis
- **ORM**: SQLx

### 基础设施
- **容器**: Docker + Kubernetes
- **CI/CD**: GitHub Actions
- **监控**: Prometheus + Grafana
- **日志**: ELK Stack
- **CDN**: Cloudflare

## 📊 项目状态

| 阶段 | 时间 | 内容 | 状态 |
|-----|------|------|------|
| **Phase 1** | 2026 Q1-Q2 | 核心服务上线 | 🚧 进行中 |
| **Phase 2** | 2026 Q3 | JiaBu 决策系统 | ⏳ 待开始 |
| **Phase 3** | 2026 Q4 | 机器学习优化 | ⏳ 待开始 |

### 里程碑

- [x] **2026-03-04**: 域名规划完成
- [x] **2026-03-05**: 项目仓库创建
- [x] **2026-03-05**: README 文档完善
- [ ] **2026-03-15**: DNS 配置完成
- [ ] **2026-04-15**: 官网与文档站上线
- [ ] **2026-05-30**: 核心应用上线

## 🤝 贡献指南

欢迎所有形式的贡献！

### 如何参与

1. Fork 对应项目仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 贡献方向

- 🐛 修复 Bug
- ✨ 添加新功能
- 📝 改进文档
- 🎨 优化 UI/UX
- 🧪 编写测试
- 🌐 翻译内容

## 📄 许可证

本项目采用 [MIT License](LICENSE)

所有子项目同样采用 MIT License，详见各项目 LICENSE 文件。

## 🔗 相关链接

### 用户端
- [官网](https://hamr.store) - 产品介绍
- [账号中心](https://account.hamr.store) - 注册登录
- [HamR 管家](https://app.hamr.store) - 核心应用
- [帮助中心](https://help.hamr.store) - 使用文档
- [在线演示](https://demo.hamr.top) - 快速体验

### 开发者
- [开发者门户](https://hamr.top) - 技术社区
- [技术文档](https://docs.hamr.top) - API 参考
- [部署指南](https://deploy.hamr.top) - 私有部署
- [服务状态](https://status.hamr.top) - 监控面板
- [GitHub 组织](https://github.com/hamr-hub) - 源代码

## 👥 团队

**HamR Team** - [GitHub Organization](https://github.com/hamr-hub)

## 📞 联系我们

- **问题反馈**: [GitHub Issues](https://github.com/hamr-hub/hamr/issues)
- **功能建议**: [GitHub Discussions](https://github.com/hamr-hub/hamr/discussions)
- **邮箱**: support@hamr.store

---

**最后更新**: 2026-03-05  
**项目状态**: 开发中  
**版本**: v0.1.0 (Alpha)

---

⭐ 如果这个项目对你有帮助，欢迎 Star！
