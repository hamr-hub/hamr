---
模板名称: 技术提案模板
适用场景: HamR 管家 P2P 本地化架构设计
最后更新: 2026-03-18
---

# HamR 管家 P2P 本地化架构技术提案

## 📋 提案信息

| 信息 | 内容 |
|-----|------|
| **提案标题** | HamR 管家 P2P 本地化架构设计 |
| **提案人** | AI |
| **创建时间** | 2026-03-18 |
| **最后更新** | 2026-03-18 |
| **状态** | 草稿 |
| **优先级** | 🔴 高 |
| **影响范围** | HamR 管家核心架构 |
| **决策截止日期** | 2026-03-25 |

## 📌 摘要 (Executive Summary)

**TL;DR**：将 HamR 管家从云端 SaaS 架构重构为 P2P 本地化架构，使用 Web3 DID 身份认证，数据存储在用户本地设备（SQLite），局域网内多设备通过 libp2p 同步。核心价值：**数据完全私有化**、**零服务器成本**、**用户拥有数据主权**。

## 🎯 背景与问题

### 业务背景
HamR 管家作为家庭数据管理系统，存储的是高度敏感的家庭隐私数据（成员信息、日程、资产等）。用户对数据隐私的关注度日益提升，同时云端服务器的持续成本也是负担。

### 当前现状
- 架构：云端 SaaS（app.hamr.store）
- 数据库：PostgreSQL + MongoDB（云服务器）
- 身份认证：JWT（依赖账号中心）
- 成本：¥31,200/年（服务器+数据库+存储+带宽）

### 存在的问题
1. **数据隐私风险**
   - 影响：用户数据上传到云端，存在泄露风险
   - 用户信任度降低

2. **持续运营成本**
   - 影响：每年 ¥31,200 服务器成本
   - 无收入来源（纯 C2C 应用）

3. **账号系统依赖**
   - 影响：依赖 account.hamr.store 服务
   - 单点故障风险

### 不解决的后果
- 用户因隐私担忧放弃使用
- 持续亏损（服务器成本无收入覆盖）
- 与"隐私保护"产品定位矛盾

## 🎯 目标与非目标

### 目标 (Goals)
- ✅ 数据完全本地化，不上传云端
- ✅ 零服务器成本（P2P 架构）
- ✅ Web3 身份认证，无需账号系统
- ✅ 局域网内多设备同步（3-5 台设备）
- ✅ 端到端加密通信

### 非目标 (Non-Goals)
- ❌ 不支持公网直接访问（仅局域网或内网穿透）
- ❌ 不支持大规模并发（面向 3-5 人家庭）
- ❌ 不提供云端备份服务

## 🔍 方案对比

### 方案一：P2P 本地化架构（推荐）

**概述**：
数据存储在用户本地设备，使用 SQLite 嵌入式数据库。通过 libp2p 实现局域网内设备发现和 P2P 同步。Web3 DID 作为身份认证，无需中心化账号系统。

**技术栈**：
- **后端**：Rust + Axum + SQLx + SQLite
- **P2P 网络**：libp2p（Rust 实现）
- **身份认证**：Web3 DID（Ed25519）
- **加密**：X25519 + ChaCha20-Poly1305
- **同步协议**：CRDT（无冲突复制数据类型）
- **前端**：Electron（桌面端） + React Native（移动端）

**优点**：
- ✅ 数据完全私有化，用户拥有数据主权
- ✅ 零服务器成本（年度节省 ¥31,200）
- ✅ 无需账号系统，Web3 身份认证
- ✅ 端到端加密，隐私保护
- ✅ 适合家庭场景（3-5 人小规模）

**缺点**：
- ❌ P2P 同步复杂度高
- ❌ 用户需要自己维护设备
- ❌ 仅支持局域网访问（或需内网穿透）
- ❌ 开发周期较长（42 人周）

**成本估算**：
- 开发成本：42 人周
- 维护成本：¥0（无服务器）
- 基础设施成本：¥0

**风险**：
- P2P 同步复杂度 | 高 | 使用成熟 libp2p 库，CRDT 数据结构
- 设备发现可靠性 | 中 | mDNS + 手动 IP 连接双重方案
- 数据冲突 | 中 | CRDT 自动解决冲突

---

### 方案二：混合架构（本地存储 + 可选云同步）

**概述**：
数据默认存储在本地（SQLite），提供可选的云端同步服务（需付费）。用户可选择完全本地化，或开启云同步。

**技术栈**：
- **本地**：Rust + SQLite + libp2p
- **云同步**：可选的云服务器（自托管或 SaaS）

**优点**：
- ✅ 兼顾隐私与便利性
- ✅ 用户可选择是否云同步
- ✅ 云同步可产生收入

**缺点**：
- ❌ 需要维护两套架构
- ❌ 云同步仍有隐私风险
- ❌ 开发成本更高

**成本估算**：
- 开发成本：60 人周
- 维护成本：¥15,600/年（可选云服务）
- 基础设施成本：¥0 ~ ¥15,600/年

---

### 方案三：纯本地单机版

**概述**：
完全本地单机应用，不支持多设备同步。数据存储在本地，适合个人使用。

**技术栈**：
- **后端**：Rust + SQLite
- **前端**：Electron（桌面端）

**优点**：
- ✅ 架构最简单
- ✅ 开发周期短（20 人周）
- ✅ 零服务器成本

**缺点**：
- ❌ 不支持多设备同步
- ❌ 家庭场景体验差（多人无法共享数据）
- ❌ 数据无法备份到其他设备

**成本估算**：
- 开发成本：20 人周
- 维护成本：¥0
- 基础设施成本：¥0

---

### 对比矩阵

| 维度 | 方案一：P2P 本地化 | 方案二：混合架构 | 方案三：单机版 |
|-----|------------------|----------------|--------------|
| **技术成熟度** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **开发效率** | 中 | 低 | 高 |
| **隐私保护** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **用户体验** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **维护成本** | ¥0 | ¥15,600/年 | ¥0 |
| **开发周期** | 42 人周 | 60 人周 | 20 人周 |
| **多设备同步** | ✅ | ✅ | ❌ |
| **家庭适用性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |

## 🏆 推荐方案

**选择**：方案一 - P2P 本地化架构

**理由**：
1. **核心价值对齐**：完全符合"隐私保护"和"数据主权"的产品定位
2. **成本优势**：零服务器成本，可持续运营
3. **技术可行**：libp2p 是成熟的 P2P 库，Rust 生态完善
4. **场景适配**：3-5 人家庭场景，P2P 架构足够

**权衡说明**：
- 接受开发周期较长（42 人周），换取零服务器成本
- 接受仅支持局域网访问，换取完全隐私保护
- 用户需自行维护设备，但换取数据完全控制权

## 🛠 详细设计（推荐方案）

### 架构设计

```
【P2P 网络拓扑】
┌─────────────────────────────────────────────────────────────┐
│                    家庭局域网（P2P 网络）                     │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   设备 A     │◄───────►│   设备 B     │                 │
│  │  (主节点)    │  P2P    │  (客户端)    │                 │
│  │  - 存储节点  │  同步   │  - 数据访问  │                 │
│  │  - 同步服务  │  QUIC   │  - 数据编辑  │                 │
│  │  - Web UI    │         │              │                 │
│  └──────────────┘         └──────────────┘                 │
│         ▲                        ▲                          │
│         │                        │                          │
│         │      ┌──────────────┐ │                          │
│         └──────┤   设备 C     ├─┘                          │
│          P2P   │  (客户端)    │                            │
│          同步  │  - 移动端    │                            │
│                └──────────────┘                            │
│                                                              │
│  【核心技术】                                                │
│  - mDNS：局域网设备自动发现                                   │
│  - libp2p：P2P 网络层                                        │
│  - QUIC：加密传输协议                                        │
│  - CRDT：无冲突数据同步                                      │
└─────────────────────────────────────────────────────────────┘

【单设备架构】
┌─────────────────────────────────────────────────────────────┐
│                      用户设备                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  前端 UI     │  │  本地服务    │  │  数据层      │      │
│  │  Electron    │  │  Rust/Axum   │  │  SQLite      │      │
│  │  React App   │  │  - HTTP API  │  │  - 五维数据   │      │
│  │  - Dashboard │  │  - P2P 同步  │  │  - 同步日志   │      │
│  │  - 五维页面  │  │  - DID 认证  │  │  - 配置      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                 ↓                 ↓               │
│    用户交互 ←───────→ 业务逻辑 ←───────→ 数据持久化         │
└─────────────────────────────────────────────────────────────┘

【P2P 同步流程】
┌──────────────┐                                    ┌──────────────┐
│   设备 A     │                                    │   设备 B     │
│  (写入数据)  │                                    │  (接收同步)  │
└──────┬───────┘                                    └──────┬───────┘
       │                                                   │
       │ 1. 数据变更 → 本地 SQLite                         │
       │ 2. 生成 CRDT 更新日志                             │
       │ 3. 签名（DID）                                    │
       ├──────────────── mDNS 发现 ────────────────────────►│
       │                                                   │
       ├────────────── QUIC 加密传输 ───────────────────────►│
       │                                                   │
       │                      4. 验证签名                   │
       │                      5. 应用 CRDT 更新             │
       │                      6. 冲突检测与解决             │
       │                                                   │
```

### 关键技术点

#### 技术点1：Web3 DID 身份认证

**实现方式**：
每台设备生成唯一的去中心化身份（DID），使用 Ed25519 密钥对。

**关键代码**：
```rust
use ed25519_dalek::{Keypair, PublicKey, Signature, Signer};

struct DeviceIdentity {
    did: String,           // did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
    keypair: Keypair,
}

impl DeviceIdentity {
    fn generate() -> Self {
        let mut csprng = rand::rngs::OsRng {};
        let keypair = Keypair::generate(&mut csprng);
        let did = format!("did:key:{}", multibase::encode(Base::Base58Btc, keypair.public.as_bytes()));
        Self { did, keypair }
    }
    
    fn sign(&self, data: &[u8]) -> Signature {
        self.keypair.sign(data)
    }
    
    fn verify(public_key: &PublicKey, data: &[u8], signature: &Signature) -> bool {
        public_key.verify(data, signature).is_ok()
    }
}
```

**注意事项**：
- 私钥存储在本地 Keychain/Keystore
- 首次连接需扫码确认（防止中间人攻击）

---

#### 技术点2：libp2p P2P 网络

**实现方式**：
使用 libp2p 实现设备发现、连接建立、数据传输。

**关键代码**：
```rust
use libp2p::{
    identity, noise, tcp, yamux, SwarmBuilder,
    gossipsub, mdns, kad, PeerId, Swarm,
};

async fn setup_p2p_network() -> Result<Swarm<MyBehaviour>> {
    let local_key = identity::Keypair::generate_ed25519();
    let peer_id = PeerId::from(local_key.public());
    
    let swarm = SwarmBuilder::with_new_identity()
        .with_tokio()
        .with_tcp(tcp::Config::default(), noise::Config::new, yamux::Config::default)?
        .with_quic()
        .with_behaviour(|key| MyBehaviour {
            mdns: mdns::tokio::Behaviour::new(mdns::Config::default())?,
            gossipsub: gossipsub::Behaviour::new(
                gossipsub::MessageId::random,
                gossipsub::Config::default(),
                key.public(),
            )?,
            kademlia: kad::Behaviour::new(peer_id, kad::store::MemoryStore::new(peer_id)),
        })?
        .build();
    
    Ok(swarm)
}
```

**注意事项**：
- 使用 mDNS 进行局域网设备发现
- 使用 QUIC 协议进行加密传输
- 使用 Gossipsub 进行数据广播

---

#### 技术点3：CRDT 数据同步

**实现方式**：
使用 CRDT（Conflict-free Replicated Data Types）实现无冲突数据同步。

**关键代码**：
```rust
use automerge::Automerge;

struct FamilyData {
    doc: Automerge,
}

impl FamilyData {
    fn apply_change(&mut self, change: &[u8]) {
        self.doc.load_incremental(change).unwrap();
    }
    
    fn get_people(&self) -> Vec<Person> {
        self.doc.query(|doc| {
            doc.map("people")?.iter().map(|(_, obj)| {
                Person {
                    id: obj.get("id")?.to_string(),
                    name: obj.get("name")?.to_string(),
                }
            }).collect()
        })
    }
    
    fn add_person(&mut self, person: Person) -> Vec<u8> {
        self.doc.change(|doc| {
            let people = doc.map("people")?;
            let person_obj = people.insert_map()?;
            person_obj.put("id", &person.id)?;
            person_obj.put("name", &person.name)?;
        })
    }
}
```

**注意事项**：
- 使用 Automerge 库（Rust 实现）
- 自动解决冲突（最终一致性）
- 增量同步减少网络开销

---

#### 技术点4：端到端加密

**实现方式**：
使用 X25519 进行密钥交换，ChaCha20-Poly1305 进行数据加密。

**关键代码**：
```rust
use x25519_dalek::{EphemeralSecret, PublicKey};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce, aead::{Aead, NewAead}};

fn encrypt_data(peer_public_key: &PublicKey, data: &[u8]) -> Vec<u8> {
    let secret = EphemeralSecret::random();
    let public_key = PublicKey::from(&secret);
    let shared_secret = secret.diffie_hellman(peer_public_key);
    
    let cipher = ChaCha20Poly1305::new(Key::from_slice(shared_secret.as_bytes()));
    let nonce = Nonce::default();
    
    cipher.encrypt(&nonce, data).unwrap()
}
```

**注意事项**：
- 每次会话生成新的临时密钥对
- 使用 HKDF 派生加密密钥

### 数据模型

```sql
-- SQLite 数据库设计

-- 家庭成员
CREATE TABLE people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT,
    birthday TEXT,
    phone TEXT,
    email TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    device_id TEXT NOT NULL,  -- 创建设备 ID
    version INTEGER NOT NULL   -- CRDT 版本号
);

-- 日程事件
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    location TEXT,
    participant_ids TEXT,  -- JSON array
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    version INTEGER NOT NULL
);

-- 待办任务
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
    status TEXT CHECK(status IN ('pending', 'in_progress', 'completed')),
    due_date INTEGER,
    assignee_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    version INTEGER NOT NULL
);

-- 家庭物品
CREATE TABLE things (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    location TEXT,
    purchase_date INTEGER,
    warranty_end_date INTEGER,
    photo_path TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    version INTEGER NOT NULL
);

-- 生活空间
CREATE TABLE spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    version INTEGER NOT NULL
);

-- 同步日志（CRDT）
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT CHECK(operation IN ('insert', 'update', 'delete')),
    data TEXT NOT NULL,  -- JSON
    version INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    signature TEXT NOT NULL
);

-- 设备信息
CREATE TABLE devices (
    did TEXT PRIMARY KEY,
    name TEXT,
    public_key TEXT NOT NULL,
    last_seen INTEGER,
    is_trusted INTEGER DEFAULT 0
);
```

### 接口设计

**HTTP API（本地服务）**：
```
GET    /api/health                 # 健康检查
GET    /api/devices                # 获取已连接设备列表
POST   /api/devices/trust          # 信任新设备

GET    /api/people                 # 获取家庭成员列表
POST   /api/people                 # 添加成员
PUT    /api/people/:id             # 更新成员
DELETE /api/people/:id             # 删除成员

GET    /api/events                 # 获取日程列表
POST   /api/events                 # 创建日程
PUT    /api/events/:id             # 更新日程
DELETE /api/events/:id             # 删除日程

# 同样的接口模式适用于 tasks, things, spaces
```

**P2P 消息协议**：
```json
{
  "type": "sync",
  "device_id": "did:key:z6Mk...",
  "timestamp": 1710748800,
  "payload": {
    "table": "people",
    "operation": "insert",
    "data": {...},
    "version": 1
  },
  "signature": "..."
}
```

### 性能考虑
- **预期数据量**：3-5 人家庭，约 1000 条记录/年
- **响应时间**：< 50ms（本地 SQLite）
- **同步延迟**：< 1s（局域网）
- **优化策略**：
  - SQLite WAL 模式提升写入性能
  - 增量同步减少网络开销
  - 索引优化查询性能

### 安全性考虑
- **认证**：Web3 DID 签名验证
- **加密**：端到端加密（X25519 + ChaCha20-Poly1305）
- **信任机制**：首次连接扫码确认
- **数据备份**：支持本地加密备份

## 📅 实施计划

### 实施阶段

**阶段1：基础架构搭建** (2周)
- [ ] 项目初始化（Rust + Axum + SQLite）
- [ ] Web3 DID 身份认证实现
- [ ] SQLite 数据模型设计与迁移
- [ ] 本地 HTTP API 开发

**阶段2：P2P 网络开发** (3周)
- [ ] libp2p 集成（设备发现 + QUIC 传输）
- [ ] CRDT 数据同步实现
- [ ] 端到端加密通信
- [ ] 冲突解决机制

**阶段3：桌面端开发** (3周)
- [ ] Electron 应用开发
- [ ] React 前端 UI（Dashboard + 五维页面）
- [ ] 本地服务集成
- [ ] 测试与优化

**阶段4：移动端开发** (2周)
- [ ] React Native 应用开发
- [ ] 移动端适配
- [ ] P2P 网络集成
- [ ] 测试与优化

### 里程碑

| 里程碑 | 交付物 | 计划时间 | 负责人 |
|-------|--------|----------|--------|
| 架构设计完成 | 技术提案 | 2026-03-25 | AI |
| 基础架构搭建 | 本地服务 + DID 认证 | 2026-04-08 | AI |
| P2P 同步原型 | 设备发现 + 数据同步 | 2026-04-29 | AI |
| 桌面端 MVP | Electron 应用 | 2026-05-20 | AI |
| 移动端 MVP | React Native 应用 | 2026-06-03 | AI |

### 资源需求
- **人力**：
  - 后端开发：10 人周（Rust + libp2p + CRDT）
  - 前端开发：8 人周（Electron + React）
  - 移动端开发：6 人周（React Native）
  - 测试：4 人周
  - **总计**：28 人周
  
- **基础设施**：
  - 开发设备：2-3 台测试设备
  - 树莓派/NAS：用于家庭服务器部署测试
  - **预算**：¥0

## ⚠️ 风险与应对

### 技术风险
| 风险 | 概率 | 影响 | 应对措施 | 负责人 |
|-----|------|------|---------|-------|
| P2P 同步复杂度 | 高 | 高 | 使用成熟 libp2p 库，参考 Syncthing 实现 | AI |
| CRDT 冲突解决 | 中 | 高 | 使用 Automerge 库，充分测试边界情况 | AI |
| libp2p 学习曲线 | 中 | 中 | 阅读官方文档，参考示例代码 | AI |
| 移动端性能 | 低 | 中 | SQLite WAL 模式，增量同步 | AI |

### 进度风险
| 风险 | 概率 | 影响 | 应对措施 | 负责人 |
|-----|------|------|---------|-------|
| 技术调研时间超预期 | 中 | 中 | 预留 20% 缓冲时间 | AI |
| 多设备测试困难 | 中 | 中 | 使用模拟器 + 真机测试 | AI |

### 回滚方案
- **触发条件**：P2P 同步无法稳定工作
- **回滚步骤**：
  1. 降级为单机版应用
  2. 手动导出/导入数据
  3. 后续版本重新实现 P2P 同步

## 📊 成功指标

### 技术指标
- **同步延迟**：< 1s（局域网内）
- **数据一致性**：100%（CRDT 保证）
- **加密强度**：256 位

### 用户指标
- **数据隐私**：100% 本地化
- **零服务器成本**：¥0/年
- **家庭场景适配**：3-5 台设备同步

## 🔄 后续维护

### 文档
- [ ] 技术架构文档
- [ ] API 文档
- [ ] 部署指南
- [ ] 故障排查手册

### 监控
- 本地日志收集
- 性能指标监控
- 同步状态监控

## 💬 开放问题

1. **内网穿透方案**：
   - 现状：默认仅支持局域网访问
   - 待定：是否提供可选的内网穿透方案（如 Tailscale、frp）

2. **数据备份策略**：
   - 现状：本地 SQLite 存储
   - 待定：是否支持加密备份到外部存储（如 USB、NAS）

## 🔗 参考资料

- [libp2p 官方文档](https://docs.libp2p.io/)
- [Automerge CRDT 库](https://automerge.org/)
- [Web3 DID 规范](https://www.w3.org/TR/did-core/)
- [Syncthing P2P 同步实现](https://syncthing.net/)
- [SQLite WAL 模式](https://www.sqlite.org/wal.html)

---

## 附录

### A. 术语表
- **DID**：Decentralized Identifier，去中心化身份
- **CRDT**：Conflict-free Replicated Data Types，无冲突复制数据类型
- **libp2p**：模块化的 P2P 网络栈
- **mDNS**：Multicast DNS，局域网设备发现协议
- **QUIC**：基于 UDP 的加密传输协议

### B. 技术选型依据

**为什么选择 Rust？**
- 内存安全，无 GC 停顿
- 高性能，适合 P2P 网络
- libp2p 有官方 Rust 实现
- SQLite 有成熟的 Rust 绑定（SQLx）

**为什么选择 SQLite？**
- 嵌入式数据库，无需独立服务器
- 跨平台（桌面/移动端）
- 性能足够（家庭数据量小）
- 支持 WAL 模式提升并发性能

**为什么选择 libp2p？**
- IPFS 的底层网络层，成熟稳定
- 模块化设计，灵活组合
- 支持 QUIC、mDNS、Gossipsub 等关键协议
- 活跃的社区和文档

### C. 成本对比（vs 云端 SaaS）

| 项目 | 云端 SaaS | P2P 本地化 | 节省 |
|-----|----------|------------|------|
| 云服务器 | ¥1,200/月 | ¥0 | 100% |
| 数据库 | ¥800/月 | ¥0 | 100% |
| 对象存储 | ¥100/月 | ¥0 | 100% |
| 带宽/CDN | ¥500/月 | ¥0 | 100% |
| **年度成本** | ¥31,200 | ¥0 | ¥31,200 |
| **开发成本** | 34 人周 | 42 人周 | -8 人周 |
| **维护成本** | 持续投入 | ¥0 | 100% |
