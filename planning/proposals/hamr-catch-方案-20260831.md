---
模板名称: 技术提案模板
适用场景: 技术方案选型、架构设计决策
最后更新: 2026-08-31
---

# hamr-catch P2P 家庭资产盘点平台技术方案

## 📋 提案信息

| 信息 | 内容 |
|-----|------|
| **提案标题** | hamr-catch：纯局域网 P2P 家庭资产盘点平台 |
| **提案人** | HamR 团队 |
| **创建时间** | 2026-08-31 |
| **最后更新** | 2026-08-31 |
| **状态** | 已批准 |
| **优先级** | 🟡 中 |
| **影响范围** | HamR 家庭应用矩阵、新建独立仓库 `repos/hamr-catch` |
| **决策截止日期** | 2026-09-15 |

## 📌 摘要 (Executive Summary)

**TL;DR**：用 PWA（HTML+JS+IndexedDB）+ WebRTC 局域网直连 + Rust 极简静态服务，搭建一个零公网服务器、零订阅费、数据 100% 本地化的家庭资产盘点平台。

## 🎯 背景与问题

### 业务背景
家庭场景的资产管理长期缺少轻量级方案：纸质记录容易丢失、商业 SaaS 涉及隐私外泄和订阅费用、自建 NAS 又过于重型。需要一个"零服务器、强隐私、多设备同步"的折中方案。

### 当前现状
HamR 已有 webapp（hamr-app）、心情日历（hamr-mood-calender）等纯前端项目，但尚未尝试 P2P 架构。本提案是 HamR 在"离线优先 + 多端同步"方向的首个探索。

### 存在的问题
1. **隐私风险**：云端 SaaS 资产信息对外上传
2. **网络依赖**：无网时多数 App 完全不可用
3. **多设备同步**：家庭场景下手机 ↔ iPad 数据割裂
4. **运维成本**：自建服务器需公网 IP、固定带宽、SSL 证书续签

## 💡 推荐方案

### 整体架构
```
[设备 A 手机]                [设备 B iPad]
   Rust 服务 (分发页面)            ↗
       ↑                          |
   http://192.168.x.x:8080         |
       |                          |
       +--- WebRTC 直连 <---------+
                ↓
           DataChannel
           资产记录/缩略图 双向同步
                ↓
         IndexedDB (本机)
         原图 (拍照设备)
```

### 技术选型
| 模块 | 选型 | 理由 |
|------|------|------|
| 前端 | HTML + 原生 JS + Tailwind (CDN) | 零构建、零打包、手机直接打开 |
| 本地服务 | Rust (stdlib only) | 0 依赖、家庭受限网络下可编译 |
| 存储 | IndexedDB | 浏览器原生、含二进制支持 |
| P2P | WebRTC DataChannel | 浏览器原生、局域网直连 |
| 发现 | QR 码 | mDNS 在浏览器不可用，QR 是零依赖最优解 |
| 离线 | Service Worker | PWA 离线核心 |
| 导出 | SheetJS | Excel 导出标准方案 |

### 关键工程决策

#### 决策 1：QR 握手而非 mDNS/Bonjour
- **方案 A（推荐）**：QR 码 + 局域网 IP，设备 A 显示 QR，设备 B 扫码
- **方案 B**：mDNS，浏览器 API 限制，WebRTC 无法获取 mDNS 解析的 IP，**不可行**
- **结论**：方案 A，零依赖体验最佳

#### 决策 2：缩略图同步而非原图同步
- 缩略图 ≈ 10 KB/张，原图 ≈ 3 MB/张
- 家庭 100 件物品，原图同步 ≈ 300 MB，缩略图 ≈ 1 MB
- **结论**：P2P 只传缩略图，原图永远只在拍照设备，需查看原图时手动触发点对点传输

#### 决策 3：Rust 用 stdlib 而非 tiny_http
- crates.io 在某些受限网络下不可达
- stdlib `TcpListener` + 手写 HTTP 解析 ≈ 150 行
- **结论**：一次 `rustc` 编译永久运行，零网络依赖

#### 决策 4：LWW（Last-Write-Wins）冲突解决
- 同一资产多设备修改时，时间戳较新者胜出
- 旧版本存入 `conflicts` 表，便于人工追溯
- **结论**：家庭场景 LWW 足够，避免引入 CRDT 等重型方案

### 同步协议设计

#### 资产记录
```json
{
  "id": "uuid",
  "name": "索尼耳机",
  "category": "数码",
  "location": "客厅电视柜",
  "buyDate": "2024-05-12",
  "price": 2299,
  "note": "",
  "photos": [
    {
      "localId": "img-xxxx",
      "thumbnailBase64": "data:image/jpeg;base64,...",
      "originalAvailable": true
    }
  ],
  "updatedAt": 1703001234567,
  "syncVersion": 7,
  "originDevice": "iPhone-Alice"
}
```

#### 同步消息类型
| type | 方向 | payload |
|------|------|---------|
| `hello` | 双 | `{deviceId, deviceName}` |
| `sync-request` | 双向 | `{since: timestamp}` |
| `sync-push` | 双向 | `{assets: [...]}` |
| `sync-ack` | 双向 | `{receivedIds: [...]}` |
| `conflict` | 双向 | `{assetId, snapshot: oldRecord}` |
| `photo-request` | 双向 | `{assetId, photoLocalId}` |
| `photo-response` | 双向 | `{photoLocalId, originalBase64}` |
| `ping/pong` | 双 | `{ts}` |

## 📊 替代方案对比

| 方案 | 隐私 | 成本 | 多端同步 | 复杂度 | 评分 |
|------|------|------|---------|-------|------|
| **本方案 P2P** | ⭐⭐⭐⭐⭐ | 0 | ✅ | 中 | **推荐** |
| 自建服务器 | ⭐⭐ | 中 | ✅ | 高 | 备选 |
| 第三方 SaaS | ⭐ | 高 | ✅ | 低 | 不推荐 |
| 仅本机单端 | ⭐⭐⭐⭐⭐ | 0 | ❌ | 低 | 不满足需求 |

## ⚠️ 风险与缓解

| 风险 | 缓解 |
|------|------|
| 路由器 AP 隔离阻断 WebRTC | 文档提示；UI 提示用户检查路由器设置 |
| 设备损坏原图丢失 | 显眼位置提示定期全量导出 |
| Tailwind CDN 受限 | 内联关键样式到 style.css fallback |
| 端口被占用 | 服务自动尝试 8080→8081→8082 |
| 多设备版本冲突 | LWW + conflicts 表，旧版本可恢复 |

## 📅 实施计划

| 阶段 | 时间 | 交付物 |
|------|------|--------|
| 基础设施 | 2026-08-31 ~ 09-02 | Rust 服务 + 项目骨架 |
| PWA 核心 | 2026-09-03 ~ 09-05 | 资产 CRUD + IndexedDB + 拍照 |
| P2P 同步 | 2026-09-06 ~ 09-08 | WebRTC + QR 握手 + 缩略图同步 |
| 完善功能 | 2026-09-09 ~ 09-10 | 设备管理 / 同步日志 / 导出 |
| PWA 离线 | 2026-09-11 ~ 09-12 | manifest + Service Worker |
| 文档 | 2026-09-13 ~ 09-14 | README + INSTALL |
| 联调 | 2026-09-15 | 真实手机 / iPad 双设备验证 |

## 🎯 验收标准

- [ ] Rust 服务在 macOS / Linux / Windows 三平台编译通过
- [ ] 启动后显示局域网 IP（如 `http://192.168.1.100:8080`）
- [ ] 手机 / iPad 浏览器访问该地址可正常使用
- [ ] 添加资产 + 拍照功能正常
- [ ] 两台设备 QR 配对成功，P2P 同步可见
- [ ] 缩略图跨设备可见，原图保留在拍照设备
- [ ] JSON / Excel 导出正常
- [ ] PWA 可安装到 iOS / Android 桌面，离线可启动
- [ ] 真实两台设备（手机 + iPad）联调通过

## 🔗 相关文档

- [项目主文档](../../projects/active/hamr-catch-20260831.md)
- [代码仓库 README](../../repos/hamr-catch/README.md)
- [CLAUDE.md 项目规则](../../.claude/rules/00-overview.md)