// ============================================================
// p2p.js - WebRTC P2P 通信 + 信令
// ============================================================
// 设计：
//   - 通过本地 Rust 服务 /api/signals/{deviceId} 中继 SDP/ICE（仅信令，无业务数据）
//   - WebRTC DataChannel 承载实际数据 P2P 同步
//   - 多 peer 支持，每个 peer 一个 RTCPeerConnection
// ============================================================

const P2P = {
  myDeviceId: null,
  myDeviceName: null,
  signalingUrl: null, // 当前 Rust 服务的 base URL（自动检测）
  peers: new Map(), // deviceId -> {pc, channel, name, lastSeen}
  listeners: new Set(), // (event, data) => void
  pollTimer: null,

  async init() {
    this.myDeviceId = await DB.getSetting('deviceId');
    if (!this.myDeviceId) {
      this.myDeviceId = uuid();
      await DB.setSetting('deviceId', this.myDeviceId);
    }
    let name = await DB.getSetting('deviceName');
    if (!name) {
      name = await this.promptDeviceName();
      await DB.setSetting('deviceName', name);
    }
    this.myDeviceName = name;

    // 自动检测信令 URL：当前页面的 base URL
    this.signalingUrl = `${location.protocol}//${location.host}`;
    DB.logSync('info', `本设备 ID: ${this.myDeviceId.slice(0, 8)}...`);

    // 恢复已配对设备并尝试重连
    const stored = await DB.allPeers();
    for (const p of stored) {
      DB.logSync('info', `恢复配对: ${p.deviceName}`);
    }

    // 启动信令轮询
    this.startSignalingPoll();

    // 监听 beforeunload，关闭所有连接
    window.addEventListener('beforeunload', () => this.closeAll());
  },

  async promptDeviceName() {
    const def = `设备-${(navigator.userAgent.match(/iPhone|iPad|Android|Mac/) || ['设备'])[0].slice(0, 8)}`;
    try {
      const name = prompt('给这台设备起个名字（家人能识别的）：', def);
      return name || def;
    } catch {
      return def;
    }
  },

  on(event, handler) {
    this.listeners.add({ event, handler });
    return () => this.listeners.delete({ event, handler });
  },

  emit(event, data) {
    for (const l of this.listeners) {
      if (l.event === event) {
        try { l.handler(data); } catch (e) { console.error(e); }
      }
    }
  },

  /**
    * 启动信令轮询（每 1.5 秒 GET /api/signals/{myId}）
    */
  startSignalingPoll() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.pollSignals().catch(() => {}), 1500);
    // 立即拉一次
    this.pollSignals().catch(() => {});
  },

  async pollSignals() {
    if (!this.signalingUrl) return;
    try {
      const resp = await fetch(`${this.signalingUrl}/api/signals/${this.myDeviceId}`);
      if (!resp.ok) return;
      const msgs = await resp.json();
      for (const msg of msgs) {
        await this.handleSignal(msg.from, msg.payload);
      }
    } catch (e) {
      // 网络错误静默（离线正常）
    }
  },

  async sendSignal(toDeviceId, payload) {
    const resp = await fetch(`${this.signalingUrl}/api/signals/${toDeviceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.myDeviceId, payload }),
    });
    return resp.ok;
  },

  async handleSignal(fromDeviceId, payloadStr) {
    let msg;
    try { msg = JSON.parse(payloadStr); } catch { return; }

    if (msg.type === 'offer') {
      // 收到对方的 offer，创建 answer
      DB.logSync('in', `来自 ${msg.fromName?.slice(0, 8) || fromDeviceId.slice(0, 8)} 的连接请求`);
      await this.respondToOffer(fromDeviceId, msg);
    } else if (msg.type === 'answer') {
      // 收到对方的 answer
      const peer = this.peers.get(fromDeviceId);
      if (peer && peer.pc) {
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
        DB.logSync('in', `已接受 ${msg.fromName?.slice(0, 8) || fromDeviceId.slice(0, 8)} 的应答`);
      }
    } else if (msg.type === 'ice') {
      // ICE 候选
      const peer = this.peers.get(fromDeviceId);
      if (peer && peer.pc) {
        try {
          await peer.pc.addIceCandidate({ candidate: msg.candidate, sdpMid: msg.sdpMid, sdpMLineIndex: msg.sdpMLineIndex });
        } catch (e) {
          // 偶尔失败不影响
        }
      }
    } else if (msg.type === 'hello') {
      // 对方打了个招呼，主动回个 hello 并发起 offer（如果还没连接）
      DB.logSync('in', `收到 hello: ${msg.fromName}`);
      await this.sendSignal(fromDeviceId, JSON.stringify({
        type: 'hello-reply',
        fromName: this.myDeviceName,
      }));
      // 如果还没建立连接，主动建
      if (!this.peers.has(fromDeviceId)) {
        await this.connectTo(fromDeviceId, msg.fromName);
      }
    } else if (msg.type === 'hello-reply') {
      DB.logSync('in', `对方已收到我的 hello: ${msg.fromName}`);
    }
  },

  /**
    * 生成我的"加入二维码"信息：包含我的 deviceId + 当前 Rust 服务 URL
    */
  getJoinPayload() {
    return {
      type: 'join',
      deviceId: this.myDeviceId,
      deviceName: this.myDeviceName,
      signalingUrl: this.signalingUrl,
    };
  },

  /**
    * 扫码得到对端的 join 信息，发起 WebRTC 连接
    */
  async connectTo(peerDeviceId, peerName) {
    if (this.peers.has(peerDeviceId)) {
      DB.logSync('info', `已连接: ${peerName}`);
      return;
    }
    DB.logSync('out', `→ 发起连接到 ${peerName}`);
    const pc = new RTCPeerConnection({
      iceServers: [], // 局域网直连，不需要 STUN
    });
    const peer = {
      pc,
      channel: null,
      deviceId: peerDeviceId,
      name: peerName || peerDeviceId.slice(0, 8),
      lastSeen: Date.now(),
    };
    this.peers.set(peerDeviceId, peer);

    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await this.sendSignal(peerDeviceId, JSON.stringify({
          type: 'ice',
          candidate: e.candidate.candidate,
          sdpMid: e.candidate.sdpMid,
          sdpMLineIndex: e.candidate.sdpMLineIndex,
        }));
      }
    };
    pc.ondatachannel = (e) => {
      this.setupChannel(peer, e.channel);
    };
    pc.onconnectionstatechange = () => {
      DB.logSync('info', `${peerName} 连接状态: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        DB.putPeer({ deviceId: peerDeviceId, deviceName: peer.name, lastSeen: Date.now() });
        this.emit('peer-connected', { deviceId: peerDeviceId, name: peer.name });
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.peers.delete(peerDeviceId);
        this.emit('peer-disconnected', { deviceId: peerDeviceId });
      }
    };

    // 创建 DataChannel，主动方负责建
    const channel = pc.createDataChannel('hamr-catch', { ordered: true });
    this.setupChannel(peer, channel);

    // 创建 offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await this.sendSignal(peerDeviceId, JSON.stringify({
      type: 'offer',
      sdp: offer.sdp,
      fromName: this.myDeviceName,
    }));
    DB.logSync('out', `→ offer 已发送给 ${peerName}`);
  },

  /**
    * 收到 offer，应答
    */
  async respondToOffer(fromDeviceId, offerMsg) {
    if (!this.peers.has(fromDeviceId)) {
      // 首次连接，建 peer
      const pc = new RTCPeerConnection({ iceServers: [] });
      const peer = {
        pc,
        channel: null,
        deviceId: fromDeviceId,
        name: offerMsg.fromName || fromDeviceId.slice(0, 8),
        lastSeen: Date.now(),
      };
      this.peers.set(fromDeviceId, peer);
      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          await this.sendSignal(fromDeviceId, JSON.stringify({
            type: 'ice',
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex,
          }));
        }
      };
      pc.ondatachannel = (e) => this.setupChannel(peer, e.channel);
      pc.onconnectionstatechange = () => {
        DB.logSync('info', `${peer.name} 连接状态: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          DB.putPeer({ deviceId: fromDeviceId, deviceName: peer.name, lastSeen: Date.now() });
          this.emit('peer-connected', { deviceId: fromDeviceId, name: peer.name });
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          this.peers.delete(fromDeviceId);
          this.emit('peer-disconnected', { deviceId: fromDeviceId });
        }
      };

      await pc.setRemoteDescription({ type: 'offer', sdp: offerMsg.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal(fromDeviceId, JSON.stringify({
        type: 'answer',
        sdp: answer.sdp,
        fromName: this.myDeviceName,
      }));
      DB.logSync('out', `→ answer 已发送`);
    } else {
      // 已存在，更新 remote desc
      const peer = this.peers.get(fromDeviceId);
      await peer.pc.setRemoteDescription({ type: 'offer', sdp: offerMsg.sdp });
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      await this.sendSignal(fromDeviceId, JSON.stringify({
        type: 'answer',
        sdp: answer.sdp,
        fromName: this.myDeviceName,
      }));
    }
  },

  setupChannel(peer, channel) {
    peer.channel = channel;
    channel.onopen = () => {
      DB.logSync('info', `📡 DataChannel 已打开: ${peer.name}`);
      this.emit('channel-open', { deviceId: peer.deviceId });
      // 主动打个招呼
      this.sendTo(peer.deviceId, { type: 'hello', fromName: this.myDeviceName });
    };
    channel.onclose = () => {
      DB.logSync('info', `DataChannel 关闭: ${peer.name}`);
      this.emit('channel-close', { deviceId: peer.deviceId });
    };
    channel.onerror = (e) => {
      DB.logSync('error', `DataChannel 错误 ${peer.name}: ${e.message || e}`);
    };
    channel.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.emit('message', { from: peer.deviceId, fromName: peer.name, msg });
      } catch (err) {
        DB.logSync('error', `消息解析失败: ${err}`);
      }
    };
  },

  /**
    * 向某个 peer 发消息
    */
  sendTo(deviceId, msg) {
    const peer = this.peers.get(deviceId);
    if (!peer || !peer.channel || peer.channel.readyState !== 'open') {
      DB.logSync('warn', `无法发送到 ${deviceId}: 通道未开`);
      return false;
    }
    try {
      peer.channel.send(JSON.stringify(msg));
      return true;
    } catch (e) {
      DB.logSync('error', `发送失败: ${e.message}`);
      return false;
    }
  },

  /**
    * 广播到所有在线 peer
    */
  broadcast(msg) {
    let ok = 0;
    for (const [id] of this.peers) {
      if (this.sendTo(id, msg)) ok++;
    }
    return ok;
  },

  async broadcastHello() {
    return this.broadcast({ type: 'hello', fromName: this.myDeviceName });
  },

  async listPeers() {
    const all = await DB.allPeers();
    return all.map((p) => ({
      ...p,
      online: this.peers.has(p.deviceId) && this.peers.get(p.deviceId).channel?.readyState === 'open',
    }));
  },

  closeAll() {
    for (const [, peer] of this.peers) {
      try { peer.channel?.close(); } catch {}
      try { peer.pc?.close(); } catch {}
    }
    this.peers.clear();
  },
};

window.P2P = P2P;