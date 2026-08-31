// ============================================================
// sync.js - 同步协议：资产/缩略图 双向同步、冲突处理
// ============================================================
// 协议消息：
//   hello               打招呼
//   sync-request {since} 请求 since 时间戳之后的变更
//   sync-push {assets}  推送资产（含缩略图）
//   conflict {snapshot} 冲突时附带旧版本快照
//   photo-request {localId}    请求原图
//   photo-response {localId, base64}  返回原图
// ============================================================

const Sync = {
  init() {
    P2P.on('message', ({ from, msg }) => this.handleMessage(from, msg));
    P2P.on('peer-connected', () => this.refreshStatus());
    P2P.on('peer-disconnected', () => this.refreshStatus());
    P2P.on('channel-open', () => this.refreshStatus());
    P2P.on('channel-close', () => this.refreshStatus());
  },

  handleMessage(from, msg) {
    switch (msg.type) {
      case 'hello':
        // 收到 hello：触发一次全量推送
        DB.logSync('in', `收到 hello @ ${Date.now()}`);
        this.pushAll(from);
        break;
      case 'sync-request':
        // 对方请求 since 之后的变更
        this.pushSince(from, msg.since || 0);
        break;
      case 'sync-push':
        // 接收对方推送的资产
        this.applyAssets(from, msg.assets || []);
        break;
      case 'photo-request':
        this.sendOriginal(from, msg.localId);
        break;
      case 'photo-response':
        this.receiveOriginal(from, msg.localId, msg.base64);
        break;
      default:
        break;
    }
  },

  refreshStatus() {
    const badge = document.getElementById('net-badge');
    if (!badge) return;
    let online = 0;
    for (const [, peer] of P2P.peers) {
      if (peer.channel?.readyState === 'open') online++;
    }
    if (online > 0) {
      badge.textContent = `${online} 设备在线`;
      badge.className = 'px-2 py-1 text-xs rounded-full online';
    } else {
      badge.textContent = '离线';
      badge.className = 'px-2 py-1 text-xs rounded-full offline';
    }
  },

  /**
    * 全量推送我的所有资产（首次握手）
    */
  async pushAll(toDeviceId) {
    const assets = await DB.allAssets();
    DB.logSync('out', `→ 推送 ${assets.length} 条资产到 ${toDeviceId.slice(0, 8)}`);
    return P2P.sendTo(toDeviceId, {
      type: 'sync-push',
      assets,
    });
  },

  async pushSince(toDeviceId, since) {
    const assets = await DB.updatedSince(since);
    if (!assets.length) return;
    DB.logSync('out', `→ 增量推送 ${assets.length} 条 (since ${new Date(since).toLocaleTimeString()})`);
    return P2P.sendTo(toDeviceId, {
      type: 'sync-push',
      assets,
    });
  },

  /**
    * 主动触发同步：向所有 peer 发 sync-request 并接收推送
    */
  async syncNow() {
    const lastSync = (await DB.getSetting('lastSyncTs')) || 0;
    DB.logSync('info', `手动同步请求 (since ${new Date(lastSync).toLocaleTimeString()})`);
    let sent = 0;
    for (const [id] of P2P.peers) {
      if (P2P.sendTo(id, { type: 'sync-request', since: lastSync })) sent++;
      if (P2P.sendTo(id, { type: 'hello' })) sent++;
    }
    await DB.setSetting('lastSyncTs', Date.now());
    return sent;
  },

  /**
    * 接收并合并对方推送的资产（LWW 冲突解决）
    */
  async applyAssets(fromDeviceId, remoteAssets) {
    let applied = 0, conflicts = 0;
    for (const remote of remoteAssets) {
      const local = await DB.getAsset(remote.id);
      if (!local) {
        await DB.putAsset(remote);
        applied++;
        continue;
      }
      const remoteTs = remote.updatedAt || 0;
      const localTs = local.updatedAt || 0;
      if (remoteTs > localTs) {
        // 远端新：保留本地为快照，应用远端
        if (Math.abs(remoteTs - localTs) > 1000) {
          await DB.putConflict({
            assetId: local.id,
            reason: 'remote-newer',
            older: local,
            newer: remote,
            fromDevice: fromDeviceId,
          });
          conflicts++;
        }
        // 合并 photos：合并缩略图
        const localThumbs = new Set((local.photos || []).map(p => p.localId));
        const mergedPhotos = [...(local.photos || [])];
        for (const rp of (remote.photos || [])) {
          if (!localThumbs.has(rp.localId)) mergedPhotos.push(rp);
        }
        await DB.putAsset({ ...remote, photos: mergedPhotos });
        applied++;
      } else if (remoteTs < localTs) {
        // 本地新：远端落后，忽略（如果差异大记录冲突）
        if (Math.abs(remoteTs - localTs) > 5000) {
          await DB.putConflict({
            assetId: remote.id,
            reason: 'local-newer',
            older: remote,
            newer: local,
            fromDevice: fromDeviceId,
          });
          conflicts++;
        }
      } else {
        // 时间戳完全一致，跳过
      }
    }
    DB.logSync('in', `← 接收 ${applied} 条新数据，${conflicts} 冲突`);
    if (applied > 0) {
      this.refreshStatus();
      // 通知 UI 刷新
      window.dispatchEvent(new CustomEvent('assets-updated'));
    }
    return { applied, conflicts };
  },

  async sendOriginal(toDeviceId, localId) {
    const photo = await DB.getPhoto(localId);
    if (!photo) {
      DB.logSync('warn', `请求原图 ${localId} 但本地不存在`);
      return;
    }
    const base64 = await blobToBase64(photo.blob);
    DB.logSync('out', `→ 发送原图 ${localId}`);
    P2P.sendTo(toDeviceId, {
      type: 'photo-response',
      localId,
      base64,
    });
  },

  async receiveOriginal(fromDeviceId, localId, base64) {
    try {
      const blob = base64ToBlob(base64);
      await DB.putPhoto(localId, blob);
      DB.logSync('in', `← 收到原图 ${localId}`);
      window.dispatchEvent(new CustomEvent('photo-received', { detail: { localId } }));
    } catch (e) {
      DB.logSync('error', `接收原图失败: ${e.message}`);
    }
  },

  async requestOriginal(assetId, photoLocalId) {
    let sent = 0;
    for (const [id] of P2P.peers) {
      if (P2P.sendTo(id, { type: 'photo-request', assetId, localId: photoLocalId })) sent++;
    }
    return sent;
  },
};

window.Sync = Sync;