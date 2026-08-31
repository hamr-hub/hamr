# 🎉 hamr-catch v0.1.0 — 首次发布

> **纯局域网 P2P 家庭资产盘点平台 · 零服务器 · 强隐私 · 多端同步**

## 📦 下载

| 文件 | 平台 | 大小 | 用途 |
|------|------|------|------|
| `hamr-catch-x86_64-apple-darwin` | macOS (Intel) | 340 KB | 直接运行二进制 |
| `hamr-catch-v0.1.0-src.tar.gz` | 任意平台 | 44 KB | 源码包（Linux/Windows/Apple Silicon 用户编译） |
| `hamr-catch-v0.1.0-src.zip` | 任意平台 | 51 KB | Windows 友好的源码包 |
| `SHA256SUMS` | — | — | 校验和 |

## ✨ 核心特性

- 📦 **资产台账**：名称 / 分类 / 购买时间 / 价格 / 位置 / 备注 / 照片
- 🔗 **局域网 P2P 同步**：WebRTC DataChannel，同 WiFi 下手机 ↔ iPad 直连
- 📡 **离线优先**：断网可录入，回到局域网自动同步
- 📷 **拍照本地化**：图片只存本机，缩略图跨设备同步，原图按需传输
- 💾 **导出备份**：JSON / Excel / 原图 ZIP 一键导出
- 📱 **PWA 安装**：添加到手机桌面，像 App 一样打开
- 🔒 **强隐私**：零外网上传，数据完全本地化

## 🛠 技术栈

- **Rust 服务**：stdlib 0 依赖，二进制 340 KB
- **前端**：HTML + JS + Tailwind CDN（无构建步骤）
- **存储**：IndexedDB
- **P2P**：WebRTC ICE 直连（无 STUN 依赖）
- **设备配对**：QR 码

## 🚀 快速开始

### 方式 1：下载二进制（仅 macOS Intel）

```bash
curl -L -o hamr-catch https://github.com/hamr-hub/hamr-catch/releases/download/v0.1.0/hamr-catch-x86_64-apple-darwin
chmod +x hamr-catch
./hamr-catch
```

启动后浏览器访问显示的 `http://192.168.x.x:8080`。

### 方式 2：从源码编译（任意平台）

需要 Rust 1.70+：

```bash
tar -xzf hamr-catch-v0.1.0-src.tar.gz
cd hamr-catch
cargo build --release
./target/release/hamr-catch
```

跨平台编译说明：
- **macOS Apple Silicon**：`cargo build --release --target aarch64-apple-darwin`
- **Linux**：`cargo build --release --target x86_64-unknown-linux-gnu`
- **Windows**：`cargo build --release --target x86_64-pc-windows-msvc`

## 📱 安装到手机桌面

1. 手机 / iPad 连接电脑**同一 WiFi**
2. 浏览器打开电脑显示的 `http://192.168.x.x:8080`
3. iOS: Safari → 分享 → 添加到主屏幕
4. Android: Chrome → 添加到主屏幕

详见 [INSTALL.md](https://github.com/hamr-hub/hamr-catch/blob/main/INSTALL.md)。

## ⚠️ 已知局限

- 路由器 AP 隔离会阻断 WebRTC（需关闭路由器设置）
- 设备损坏时该设备独有的原图会丢失（建议定期导出 ZIP 备份）
- iOS Safari HTTPS 限制下需用 Safari 直接打开（非 PWA）才能调起摄像头
- WebRTC ICE 直连在某些企业路由器下可能不通

## 📊 验证

- 单元测试：5/5 通过
- HTTP 资源服务：7/7 smoke test 通过
- 信令 API：POST/GET/DELETE 全部正常

## 📝 完整文档

- [README](https://github.com/hamr-hub/hamr-catch)
- [安装指南](https://github.com/hamr-hub/hamr-catch/blob/main/INSTALL.md)
- [项目 PRD](https://github.com/hamr-hub/hamr/blob/main/projects/active/hamr-catch-20260831.md)
- [技术方案](https://github.com/hamr-hub/hamr/blob/main/planning/proposals/hamr-catch-方案-20260831.md)

## 🙏 反馈

GitHub Issues: <https://github.com/hamr-hub/hamr-catch/issues>

## 📜 License

MIT © HamR 团队