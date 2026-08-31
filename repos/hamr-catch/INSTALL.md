# 📱 HamR Catch 安装与使用指南

本指南详细说明如何在不同设备上部署与使用 HamR Catch。

## 🎯 三种部署模式

### 模式 A：电脑上跑服务，手机 / iPad 访问（推荐家用）

**适用场景**：家里有一台常用电脑（Mac / Windows / Linux），希望所有手机 / iPad 都通过它同步。

**步骤**：

#### 1. 编译（在电脑上）

```bash
git clone <repo> hamr-catch
cd hamr-catch
cargo build --release
```

> 如果没有 Rust 环境，可直接从 [Releases](#) 下载预编译二进制。

#### 2. 启动服务（在电脑上）

```bash
./target/release/hamr-catch
```

看到类似输出：

```
📱 局域网访问地址（同一 WiFi 下的设备任选其一）:
   http://192.168.1.100:8080

💡 首次使用：
   1. 手机 / iPad 连接同一 WiFi
   2. 浏览器打开上面任一地址
   ...
```

**记住这个 IP 地址**（如 `192.168.1.100`）。

> ⚠️ 如果电脑有多个网卡（如同时连 WiFi 和有线），服务会列出所有可用的 IP，选择手机能访问的那个。

#### 3. 手机 / iPad 访问

1. 手机 / iPad 连接**同一 WiFi**
2. 打开 Safari 或 Chrome
3. 浏览器输入 `http://192.168.1.100:8080`（替换成你电脑的 IP）
4. 第一次会显示警告"此连接不是私密连接"，点击"仍然访问"（LAN 服务没有 HTTPS）

#### 4. 安装到主屏幕

**iOS (Safari)**：
1. 点击底部"分享"按钮（方框带箭头）
2. 滑到底部，点"添加到主屏幕"
3. 名称改为"HamR Catch"，点"添加"
4. 主屏幕出现图标，之后像 App 一样打开（无浏览器地址栏）

**Android (Chrome)**：
1. Chrome 自动弹出"添加到主屏幕"提示
2. 或菜单 → "添加到主屏幕"
3. 名称"HamR Catch"，确认
4. 主屏幕出现图标

#### 5. 配对第二台设备

- 第一台设备：底部"🔗 设备" → "📤 生成我的二维码"
- 第二台设备：底部"🔗 设备" → "📷 扫码加入家庭" → 扫描二维码
- 自动建立 P2P 连接 ✓

之后两台设备的资产会自动同步！

---

### 模式 B：闲置手机上跑服务

**适用场景**：没有电脑，或想完全用手机搞定。

**步骤**：

#### iOS (推荐用 "a-Shell" 或 "iSH")

1. App Store 安装 [a-Shell](https://apps.apple.com/app/a-shell/id1473806598)（免费的本地终端）
2. 在 a-Shell 中：
   ```bash
   # 下载预编译二进制（或自己编译）
   curl -L -o hamr-catch https://your-host/hamr-catch-ios
   chmod +x hamr-catch
   ./hamr-catch --port 8080
   ```
3. 同一 WiFi 下其他设备访问 iPhone 的 IP

#### Android (推荐 Termux)

1. Google Play 安装 [Termux](https://termux.com/)
2. 在 Termux 中：
   ```bash
   pkg install rust
   git clone <repo>
   cd hamr-catch
   cargo build --release
   ./target/release/hamr-catch
   ```
3. 其他设备访问 Android 手机的 IP

---

### 模式 C：开发模式

**适用场景**：开发者想改前端代码。

```bash
# 一个终端跑 Rust 服务
cd hamr-catch
cargo run

# 浏览器访问 http://localhost:8080
# 修改 web/ 下文件后，刷新浏览器即可（Service Worker 缓存可能要刷新两次）
```

---

## 🔧 常见问题

### Q1: 手机无法访问电脑的 IP？
- 确认电脑和手机连接**同一 WiFi**（不是 5G 频段切换导致分网）
- 确认电脑防火墙允许 8080 端口
  - macOS: 系统设置 → 网络 → 防火墙 → 允许
  - Windows: 控制面板 → Windows Defender 防火墙 → 高级设置 → 入站规则
  - Linux: `sudo ufw allow 8080/tcp`
- 路由器开启了"AP 隔离" / "客户端隔离" → 关闭它

### Q2: 浏览器提示"此连接不是私密连接"
- 因为是 LAN HTTP 不是 HTTPS，浏览器会警告
- 点击"高级" → "继续访问"（仅在可信的局域网内这样做）

### Q3: iOS 无法调用摄像头？
- iOS 14+ 支持 WebRTC 摄像头
- 必须用 HTTPS 或 localhost 才能调用摄像头（LAN HTTP 在 iOS 会被限制）
- **解决**：用 Safari 直接打开，不安装 PWA；或在 macOS 上启用本地 HTTPS
- 折中：iOS 上用"🖼 相册"代替"📷 拍照"（相册选择不受 HTTPS 限制）

### Q4: 配对后看不到对方的资产？
- 检查两台设备都显示"在线"状态
- 点"🔄 立即同步"手动触发
- 查看"同步日志"排查错误
- 确认 Service Worker 已注册（DevTools → Application → Service Workers）

### Q5: 数据丢失怎么办？
- ⚠️ 数据只在设备本地，损坏将永久丢失
- **必须定期导出备份**：
  - "💾 备份" → "📄 导出为 JSON"
  - 保存到 iCloud / OneDrive / 网盘
- 建议每月一次

### Q6: 缩略图能看到但原图点击没反应？
- 原图只在拍照设备
- 点"请求原图"按钮，设备 B 会通过 P2P 向拍照设备 A 请求
- 需要拍照设备同时在线

---

## 🛠 路由器兼容性

部分家用路由器的特殊设置可能影响 WebRTC 直连：

| 设置 | 影响 | 建议 |
|------|------|------|
| AP 隔离 / 客户端隔离 | 阻止设备间通信 | **关闭** |
| IGMP Snooping | 可能影响组播 | 一般无影响 |
| UPnP | 用于打洞，本服务不需要 | 可关 |
| mDNS 反射 | 阻止 .local 域名解析 | 无影响（不用 mDNS） |
| IPv6 | 优先 IPv6 可能导致直连失败 | 可暂时关闭 IPv6 |

---

## 🔐 安全提示

1. **仅在可信局域网内使用**：服务没有鉴权，局域网内任何人都能访问你的资产数据
2. **定期备份**：避免设备损坏丢失数据
3. **离开家庭时关闭服务**：防止外人接入
4. **不要用于敏感资产**：本工具不是金融级别的安全方案

---

## 🆘 获取帮助

- GitHub Issues: <repo>/issues
- 项目主页：<repo>
- 关联文档：[HamR 主项目](../../projects/active/hamr-catch-20260831.md)