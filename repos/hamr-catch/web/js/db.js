// ============================================================
// db.js - IndexedDB 封装
// ============================================================
// 数据库: hamr-catch
// 表:
//   - assets       资产记录
//   - photos       图片（原图 blob）
//   - peers        已配对设备
//   - conflicts    冲突快照
//   - settings     设置（设备名等）
//   - syncLog      同步日志（最近 200 条）
// ============================================================

const DB_NAME = 'hamr-catch';
const DB_VERSION = 1;

const DB = {
  db: null,

  async open() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('assets')) {
          const s = db.createObjectStore('assets', { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt');
          s.createIndex('category', 'category');
          s.createIndex('location', 'location');
        }
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'localId' });
        }
        if (!db.objectStoreNames.contains('peers')) {
          db.createObjectStore('peers', { keyPath: 'deviceId' });
        }
        if (!db.objectStoreNames.contains('conflicts')) {
          db.createObjectStore('conflicts', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('syncLog')) {
          const s = db.createObjectStore('syncLog', { keyPath: 'id', autoIncrement: true });
          s.createIndex('ts', 'ts');
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => reject(req.error);
    });
  },

  async tx(store, mode = 'readonly') {
    const db = await this.open();
    return db.transaction(store, mode).objectStore(store);
  },

  // ---------- 资产 ----------
  async putAsset(asset) {
    const store = await this.tx('assets', 'readwrite');
    return new Promise((res, rej) => {
      const r = store.put(asset);
      r.onsuccess = () => res(asset);
      r.onerror = () => rej(r.error);
    });
  },

  async getAsset(id) {
    const store = await this.tx('assets');
    return new Promise((res, rej) => {
      const r = store.get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },

  async deleteAsset(id) {
    const store = await this.tx('assets', 'readwrite');
    return new Promise((res, rej) => {
      const r = store.delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  async allAssets() {
    const store = await this.tx('assets');
    return new Promise((res, rej) => {
      const r = store.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },

  async updatedSince(ts) {
    const all = await this.allAssets();
    return all.filter(a => (a.updatedAt || 0) > ts);
  },

  // ---------- 照片 ----------
  async putPhoto(localId, blob, meta = {}) {
    const store = await this.tx('photos', 'readwrite');
    return new Promise((res, rej) => {
      const r = store.put({ localId, blob, ...meta, createdAt: Date.now() });
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  async getPhoto(localId) {
    const store = await this.tx('photos');
    return new Promise((res, rej) => {
      const r = store.get(localId);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },

  async allPhotos() {
    const store = await this.tx('photos');
    return new Promise((res, rej) => {
      const r = store.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },

  async deletePhoto(localId) {
    const store = await this.tx('photos', 'readwrite');
    return new Promise((res, rej) => {
      const r = store.delete(localId);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  // ---------- 设备 ----------
  async putPeer(peer) {
    const store = await this.tx('peers', 'readwrite');
    return new Promise((res, rej) => {
      const r = store.put(peer);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  async allPeers() {
    const store = await this.tx('peers');
    return new Promise((res, rej) => {
      const r = store.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },

  async deletePeer(deviceId) {
    const store = await this.tx('peers', 'readwrite');
    return new Promise((res, rej) => {
      const r = store.delete(deviceId);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  // ---------- 冲突 ----------
  async putConflict(snapshot) {
    const store = await this.tx('conflicts', 'readwrite');
    return new Promise((res, rej) => {
      const r = store.put({ ...snapshot, ts: Date.now() });
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  async allConflicts() {
    const store = await this.tx('conflicts');
    return new Promise((res, rej) => {
      const r = store.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },

  // ---------- 设置 ----------
  async getSetting(key, def = null) {
    const store = await this.tx('settings');
    return new Promise((res, rej) => {
      const r = store.get(key);
      r.onsuccess = () => res(r.result ? r.result.value : def);
      r.onerror = () => rej(r.error);
    });
  },

  async setSetting(key, value) {
    const store = await this.tx('settings', 'readwrite');
    return new Promise((res, rej) => {
      const r = store.put({ key, value });
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  // ---------- 同步日志 ----------
  async logSync(level, message) {
    try {
      const store = await this.tx('syncLog', 'readwrite');
      const entry = { ts: Date.now(), level, message };
      store.add(entry);
      // 保留最近 200 条
      const all = await new Promise((res) => {
        const r = store.openCursor(null, 'prev');
        const out = [];
        r.onsuccess = () => {
          const cur = r.result;
          if (cur && out.length < 200) {
            out.push(cur.value);
            cur.continue();
          } else res(out);
        };
      });
      // 简单清理：超出 200 条的删除
      const delStore = await this.tx('syncLog', 'readwrite');
      const cntReq = delStore.count();
      cntReq.onsuccess = () => {
        const total = cntReq.result;
        if (total > 250) {
          // 按 ts 升序遍历，删多余的
          const cReq = delStore.openCursor();
          let toDelete = total - 200;
          cReq.onsuccess = () => {
            const cur = cReq.result;
            if (cur && toDelete > 0) {
              cur.delete();
              toDelete--;
              cur.continue();
            }
          };
        }
      };
    } catch (e) {
      console.warn('[syncLog]', err);
    }
  },

  async getSyncLog(limit = 50) {
    const store = await this.tx('syncLog');
    return new Promise((res, rej) => {
      const r = store.openCursor(null, 'prev');
      const out = [];
      r.onsuccess = () => {
        const cur = r.result;
        if (cur && out.length < limit) {
          out.push(cur.value);
          cur.continue();
        } else res(out);
      };
      r.onerror = () => rej(r.error);
    });
  },

  async clearSyncLog() {
    const store = await this.tx('syncLog', 'readwrite');
    return new Promise((res, rej) => {
      const r = store.clear();
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  // ---------- 导入 / 导出 ----------
  async exportAll() {
    const [assets, photos] = await Promise.all([this.allAssets(), this.allPhotos()]);
    const photosPayload = [];
    for (const p of photos) {
      photosPayload.push({
        localId: p.localId,
        // 将 blob 转为 base64
        base64: await blobToBase64(p.blob),
        createdAt: p.createdAt,
      });
    }
    return {
      version: 1,
      exportedAt: Date.now(),
      exportedFrom: await this.getSetting('deviceId'),
      assets,
      photos: photosPayload,
    };
  },

  async importAll(payload) {
    if (!payload || payload.version !== 1) {
      throw new Error('备份格式不兼容');
    }
    let imported = 0, conflicts = 0;
    for (const asset of (payload.assets || [])) {
      const existing = await this.getAsset(asset.id);
      if (existing && existing.updatedAt > asset.updatedAt) {
        // 旧版本作为冲突快照
        await this.putConflict({
          assetId: asset.id,
          reason: 'import-older-version',
          older: existing,
          newer: asset,
        });
        conflicts++;
        continue;
      }
      await this.putAsset(asset);
      imported++;
    }
    for (const photo of (payload.photos || [])) {
      try {
        const blob = base64ToBlob(photo.base64);
        await this.putPhoto(photo.localId, blob);
      } catch (e) {
        console.warn('导入照片失败', photo.localId, e);
      }
    }
    return { imported, conflicts };
  },
};

// ---------- 工具 ----------
function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 暴露到全局
window.DB = DB;
window.uuid = uuid;
window.blobToBase64 = blobToBase64;
window.base64ToBlob = base64ToBlob;