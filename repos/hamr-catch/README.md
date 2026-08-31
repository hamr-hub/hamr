# 📦 HamR Catch — 家庭资产盘点 P2P 平台

> **纯局域网 P2P · 数据完全本地化 · 零服务器 · 零订阅费**

家庭场景下的轻量级资产管理工具。所有数据只在你的手机 / iPad 本地，设备之间通过 WebRTC 局域网直连同步，**不需要任何公网服务器**。

![架构](docs/architecture.svg)

## ✨ 核心特性

| 能力 | 说明 |
|------|------|
| 📦 资产台账 | 名称 / 分类 / 购买时间 / 价格 / 位置 / 备注 |
| 📷 拍照留档 | 直接调用摄像头，图片只存在本机 |
| 🔗 局域网 P2P 同步 | 手机 ↔ iPad ↔ 手机在同一 WiFi 下互相同步 |
| 📡 离线可用 | 断网也能录入，回到 WiFi 自动同步 |
| 💾 备份导出 | JSON / Excel / 原图 ZIP 一键导出 |
| 🔒 强隐私 | 零外网上传，缩略图跨设备同步，原图永远在拍照设备 |
| 📱 PWA 安装 | 添加到手机桌面，像 App 一样打开 |

## 🛠 技术栈

```
┌──────────────────────────┐
│  📱 浏览器 (PWA)         │
│  HTML + JS + Tailwind    │
│  + IndexedDB (本地存储)   │
│  + WebRTC (P2P 数据)     │
└──────────┬───────────────┘
           │ WebRTC DataChannel (LAN)
┌──────────┴───────────────┐
│  🦀 Rust 服务 (stdlib)   │
│  0 依赖，0.3 MB 二进制   │
│  仅分发静态资源 + 信令  │
└──────────────────────────┘
```

- **Rust 服务**：纯 stdlib 实现，无任何外部 crate
- **PWA 前端**：HTML + 原生 JS + Tailwind CDN
- **存储**：IndexedDB（含图片 blob）
- **P2P**：WebRTC DataChannel + ICE 直连
- **设备配对**：QR 码（qrcode-generator + jsQR）
- **导出**：SheetJS (xlsx) + JSZip

## 🚀 快速开始

### 1. 编译

```bash
cd hamr-catch
cargo build --release
```

### 2. 启动

```bash
./target/release/hamr-catch
# 或指定端口
./target/release/hamr-catch --port 9000
```

启动后会显示：

```
📱 局域网访问地址（同一 WiFi 下的设备任选其一）:
   http://192.168.1.100:8080
   http://192.168.x.x:8080

💡 首次使用：
   1. 手机 / iPad 连接同一 WiFi
   2. 浏览器打开上面任一地址
   3. 在 PWA 中点"我是新设备"生成二维码
   4. 用另一台设备"扫码加入"完成配对
```

### 3. 访问

- 手机 / iPad 连接同一 WiFi
- 浏览器（Safari / Chrome）打开上面任一地址
- 首次访问会自动提示"添加到主屏幕"

### 4. 配对设备

- 设备 A：底部"🔗 设备" → "📤 生成我的二维码"
- 设备 B：底部"🔗 设备" → "📷 扫码加入家庭"
- B 扫码后自动建立 P2P 连接
- 之后两台设备的资产会自动同步

## 📱 安装到手机桌面

### iOS (Safari)
1. 用 Safari 打开 `http://你的电脑IP:8080`
2. 点击底部的"分享"按钮
3. 选择"添加到主屏幕"
4. 名称"HamR Catch"，点"添加"
5. 主屏幕会出现图标，像 App 一样打开

### Android (Chrome)
1. 用 Chrome 打开 `http://你的电脑IP:8080`
2. 浏览器会自动提示"添加到主屏幕"
3. 或菜单 → "添加到主屏幕"
4. 主屏幕出现图标

## 🧩 功能详解

### 资产管理
- 主界面卡片网格展示
- 按分类 / 名称 / 位置筛选、搜索
- 点击任意资产查看详情 / 编辑
- 删除资产有确认提示

### 拍照
- 编辑表单中点"📷 拍照"调用后置摄像头
- 点"🖼 相册"从相册选图（可多选）
- 图片自动生成 480px 缩略图
- 缩略图跨设备同步，原图留在拍照设备

### P2P 同步
- 同一 WiFi 下的设备可互相发现并同步
- 同步策略：LWW（Last-Write-Wins），时间较新者胜出
- 冲突时旧版本存入"冲突快照"表
- 缩略图自动同步，原图需手动点对点请求

### 备份导出
- **JSON**：完整数据 + 缩略图 + 原图 base64，可在另一台设备导入恢复
- **Excel**：仅资产清单（不含照片），方便查看编辑
- **ZIP**：所有原图打包，便于单独备份

## 🏗 架构细节

### 为什么用 Rust stdlib？
- 0 外部依赖 → 一次编译永久运行
- 适应受限网络环境（家庭路由器 / 防火墙）
- 二进制只有 327 KB，启动 < 50ms

### 为什么 QR 配对？
- 浏览器 WebRTC 无法使用 mDNS / Bonjour 获取 IP
- QR 是真正的零依赖方案
- 一次扫码终身自动重连

### 信令原理
虽然不需要中心服务器，但 WebRTC 仍需交换 SDP/ICE。本服务的 `/api/signals/{deviceId}` 端点：
- 仅在内存中保留 16 条最新消息
- 重启即清空，**永远不落盘业务数据**
- WebRTC 通道建立后，所有业务数据 P2P 直连

### 数据流
```
设备 A 拍照 → IndexedDB (本机)
  ↓
生成缩略图（10 KB）
  ↓
WebRTC 通道推送到设备 B
  ↓
设备 B IndexedDB (含缩略图)
  ↓
设备 B 用户可点击"请求原图"
  ↓
A 通过 WebRTC 发送原图（数 MB）
  ↓
B 保存到本地 IndexedDB
```

## ⚠️ 局限与风险

| 风险 | 缓解 |
|------|------|
| 路由器 AP 隔离阻断 WebRTC | 关闭路由器"AP 隔离"设置 |
| 设备损坏导致独有原图丢失 | 每月导出 ZIP 备份到网盘 |
| 设备不在同一 WiFi | 无法自动同步，需在同一局域网下完成 |
| 缩略图同步缺失某张 | UI 提示"请求原图"，手动点对点传输 |
| iOS Safari IndexedDB 配额 | 限制单设备约 50MB，照片多了导出 ZIP |

## 🧪 测试

```bash
cargo test --release
```

## 📂 项目结构

```
hamr-catch/
├── Cargo.toml              # Rust 配置（0 依赖）
├── src/main.rs             # HTTP 静态服务 + 信令端点
├── web/                    # PWA 前端
│   ├── index.html          # 主页面
│   ├── manifest.json       # PWA 清单
│   ├── sw.js               # Service Worker
│   ├── css/style.css       # 自定义样式
│   ├── js/
│   │   ├── db.js           # IndexedDB 封装
│   │   ├── camera.js       # 拍照 / 缩略图
│   │   ├── qr.js           # QR 生成与扫描
│   │   ├── p2p.js          # WebRTC P2P
│   │   ├── sync.js         # 同步协议
│   │   ├── app.js          # 主应用入口
│   │   └── sw-register.js  # SW 注册
│   └── icons/              # PWA 图标
├── README.md               # 本文件
├── INSTALL.md              # 详细安装指南
└── LICENSE                 # MIT
```

## 🔗 关联文档

- [完整方案 PRD](../../projects/active/hamr-catch-20260831.md)
- [技术方案提案](../../planning/proposals/hamr-catch-方案-20260831.md)
- [HamR 主项目](https://github.com/heyongxian/hamr)

## 📝 License

MIT © HamR 团队