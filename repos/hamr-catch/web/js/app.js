// ============================================================
// app.js - 主应用入口
// ============================================================

const App = {
  state: {
    currentView: 'list',
    filterCat: '',
    search: '',
    sort: 'updated-desc',
    editingAsset: null,
    editingPhotos: [], // 编辑中的图片（含 thumbnailBase64 + blob）
  },

  async init() {
    // 初始化 DB、P2P、同步
    await DB.open();
    await P2P.init();
    Sync.init();

    // 绑定全局事件
    this.bindGlobal();
    this.bindListView();
    this.bindEditView();
    this.bindDevicesView();
    this.bindBackupView();
    this.bindModal();

    // 显示设备 ID
    document.getElementById('my-device-id').textContent = P2P.myDeviceId.slice(0, 12) + '...';
    document.getElementById('my-device-name').textContent = P2P.myDeviceName;

    // 启动渲染
    await this.refreshList();
    await this.refreshPeerList();
    await this.refreshSyncLog();

    // 监听资产更新事件
    window.addEventListener('assets-updated', () => this.refreshList());

    // 启动定时刷新同步日志
    setInterval(() => this.refreshSyncLog(), 3000);
  },

  // ---------- 导航 ----------
  switchView(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    const target = document.getElementById(`view-${name}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach((b) => {
      if (b.dataset.view === name) {
        b.classList.add('text-slate-900', 'border-accent');
        b.classList.remove('text-slate-400', 'border-transparent');
      } else {
        b.classList.remove('text-slate-900', 'border-accent');
        b.classList.add('text-slate-400', 'border-transparent');
      }
    });
    this.state.currentView = name;
    window.scrollTo(0, 0);
  },

  bindGlobal() {
    document.querySelectorAll('.nav-btn').forEach((b) => {
      b.addEventListener('click', () => this.switchView(b.dataset.view));
    });
    document.getElementById('btn-add').addEventListener('click', () => this.openEditor(null));

    // Toast 工具
    window.toast = (msg, type = 'info') => {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.className = `fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm shadow-lg z-50 toast-${type}`;
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 2500);
    };
  },

  // ---------- 列表 ----------
  bindListView() {
    document.getElementById('search').addEventListener('input', (e) => {
      this.state.search = e.target.value;
      this.refreshList();
    });
    document.getElementById('sort').addEventListener('change', (e) => {
      this.state.sort = e.target.value;
      this.refreshList();
    });
    document.querySelectorAll('.cat-btn').forEach((b) => {
      b.addEventListener('click', () => {
        this.state.filterCat = b.dataset.filterCat;
        document.querySelectorAll('.cat-btn').forEach((x) => {
          x.classList.remove('bg-slate-900', 'text-white');
          x.classList.add('bg-slate-100');
        });
        b.classList.remove('bg-slate-100');
        b.classList.add('bg-slate-900', 'text-white');
        this.refreshList();
      });
    });
  },

  async refreshList() {
    const all = await DB.allAssets();
    const list = document.getElementById('asset-list');
    const empty = document.getElementById('empty-state');
    document.getElementById('stat').textContent = `共 ${all.length} 件资产`;

    let filtered = all;
    if (this.state.filterCat) {
      filtered = filtered.filter((a) => a.category === this.state.filterCat);
    }
    if (this.state.search) {
      const q = this.state.search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          (a.name || '').toLowerCase().includes(q) ||
          (a.location || '').toLowerCase().includes(q) ||
          (a.note || '').toLowerCase().includes(q)
      );
    }
    filtered = this.sortAssets(filtered);

    list.innerHTML = '';
    if (filtered.length === 0) {
      empty.classList.remove('hidden');
      list.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    list.classList.remove('hidden');

    for (const a of filtered) {
      const card = this.renderAssetCard(a);
      list.appendChild(card);
    }
  },

  sortAssets(arr) {
    const s = this.state.sort;
    return [...arr].sort((x, y) => {
      switch (s) {
        case 'updated-desc': return (y.updatedAt || 0) - (x.updatedAt || 0);
        case 'buyDate-desc': return (y.buyDate || '').localeCompare(x.buyDate || '');
        case 'price-desc': return (y.price || 0) - (x.price || 0);
        case 'name-asc': return (x.name || '').localeCompare(y.name || '');
        default: return 0;
      }
    });
  },

  renderAssetCard(a) {
    const div = document.createElement('div');
    div.className = 'asset-card bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md';
    div.innerHTML = `
      <div class="flex gap-3">
        ${a.photos && a.photos[0]
          ? `<img src="${a.photos[0].thumbnailBase64}" class="w-20 h-20 object-cover rounded-lg flex-shrink-0" />`
          : `<div class="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">${this.categoryEmoji(a.category)}</div>`
        }
        <div class="flex-1 min-w-0">
          <div class="font-medium text-slate-900 truncate">${this.esc(a.name)}</div>
          <div class="text-xs text-slate-500 mt-0.5">${this.esc(a.category || '')} · ${this.esc(a.location || '未分类位置')}</div>
          <div class="flex items-center gap-2 mt-1">
            ${a.price ? `<span class="text-sm font-semibold text-cyan-600">¥${Number(a.price).toLocaleString()}</span>` : ''}
            ${a.buyDate ? `<span class="text-xs text-slate-400">${this.esc(a.buyDate)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
    div.addEventListener('click', () => this.openEditor(a));
    return div;
  },

  categoryEmoji(cat) {
    return { 数码: '📱', 家电: '🔌', 家具: '🛋', 收藏: '💎', 服饰: '👕', 证件: '📄' }[cat] || '📦';
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // ---------- 编辑 ----------
  bindEditView() {
    document.getElementById('btn-cancel').addEventListener('click', () => {
      this.state.editingAsset = null;
      this.state.editingPhotos = [];
      this.switchView('list');
    });
    document.getElementById('btn-camera').addEventListener('click', () => {
      document.getElementById('camera-input').click();
    });
    document.getElementById('btn-gallery').addEventListener('click', () => {
      document.getElementById('gallery-input').click();
    });
    document.getElementById('camera-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) await this.addPhoto(file);
      e.target.value = '';
    });
    document.getElementById('gallery-input').addEventListener('change', async (e) => {
      for (const file of e.target.files) await this.addPhoto(file);
      e.target.value = '';
    });
    document.getElementById('asset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveAsset();
    });
  },

  async addPhoto(file) {
    const meta = await Camera.process(file);
    this.state.editingPhotos.push(meta);
    // 持久化原图到本机
    await DB.putPhoto(meta.localId, meta.blob);
    this.renderPhotoPreview();
  },

  renderPhotoPreview() {
    const c = document.getElementById('photos-preview');
    c.innerHTML = '';
    for (const p of this.state.editingPhotos) {
      const div = document.createElement('div');
      div.className = 'relative';
      div.innerHTML = `
        <img src="${p.thumbnailBase64}" class="w-20 h-20 object-cover rounded-lg" />
        <button type="button" data-id="${p.localId}" class="rm-photo absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs">×</button>
      `;
      div.querySelector('.rm-photo').addEventListener('click', async () => {
        this.state.editingPhotos = this.state.editingPhotos.filter((x) => x.localId !== p.localId);
        await DB.deletePhoto(p.localId);
        this.renderPhotoPreview();
      });
      c.appendChild(div);
    }
  },

  async openEditor(asset) {
    this.state.editingAsset = asset;
    this.state.editingPhotos = asset ? [...(asset.photos || [])] : [];
    document.getElementById('edit-title').textContent = asset ? '编辑资产' : '新增资产';
    const form = document.getElementById('asset-form');
    form.reset();
    if (asset) {
      form.id.value = asset.id;
      form.name.value = asset.name || '';
      form.category.value = asset.category || '其他';
      form.price.value = asset.price || '';
      form.buyDate.value = asset.buyDate || '';
      form.location.value = asset.location || '';
      form.note.value = asset.note || '';
    } else {
      form.id.value = '';
    }
    this.renderPhotoPreview();
    this.switchView('edit');
  },

  async saveAsset() {
    const form = document.getElementById('asset-form');
    const data = {
      id: form.id.value || uuid(),
      name: form.name.value.trim(),
      category: form.category.value,
      price: parseFloat(form.price.value) || 0,
      buyDate: form.buyDate.value,
      location: form.location.value.trim(),
      note: form.note.value.trim(),
      photos: this.state.editingPhotos.map((p) => ({
        localId: p.localId,
        thumbnailBase64: p.thumbnailBase64,
        originalAvailable: p.originalAvailable !== false,
      })),
      updatedAt: Date.now(),
      syncVersion: 1,
      originDevice: P2P.myDeviceName,
    };
    if (!data.name) {
      toast('请填写资产名称');
      return;
    }
    // LWW：如果原版本更新，递增 syncVersion
    const old = await DB.getAsset(data.id);
    if (old) data.syncVersion = (old.syncVersion || 0) + 1;
    await DB.putAsset(data);
    toast('✅ 已保存');
    this.state.editingAsset = null;
    this.state.editingPhotos = [];
    await this.refreshList();
    this.switchView('list');
    // 主动推送一次
    Sync.syncNow();
  },

  async deleteAsset(id) {
    if (!confirm('确认删除此资产？')) return;
    await DB.deleteAsset(id);
    toast('已删除');
    await this.refreshList();
    this.switchView('list');
  },

  // ---------- 设备 ----------
  bindDevicesView() {
    document.getElementById('btn-show-qr').addEventListener('click', () => this.showMyQR());
    document.getElementById('btn-scan-qr').addEventListener('click', () => this.startScan());
    document.getElementById('btn-sync-now').addEventListener('click', async () => {
      const n = await Sync.syncNow();
      toast(n > 0 ? `已发送 ${n} 个同步请求` : '暂无在线设备');
      setTimeout(() => this.refreshSyncLog(), 500);
    });
    document.getElementById('btn-clear-log').addEventListener('click', async () => {
      await DB.clearSyncLog();
      this.refreshSyncLog();
    });
  },

  async refreshPeerList() {
    const peers = await P2P.listPeers();
    const c = document.getElementById('peer-list');
    if (peers.length === 0) {
      c.innerHTML = '<div class="text-sm text-slate-400 text-center py-3">还没有配对设备</div>';
      return;
    }
    c.innerHTML = '';
    for (const p of peers) {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-3 bg-slate-50 rounded-lg';
      div.innerHTML = `
        <div>
          <div class="font-medium">${this.esc(p.deviceName)}</div>
          <div class="text-xs text-slate-500">${p.deviceId.slice(0, 8)}... · ${p.online ? '🟢 在线' : '⚫ 离线'}</div>
        </div>
        <div class="flex gap-1">
          ${p.online ? '<button class="reconnect-btn text-xs px-2 py-1 bg-cyan-600 text-white rounded">同步</button>' : ''}
          <button class="forget-btn text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded">移除</button>
        </div>
      `;
      const reconnect = div.querySelector('.reconnect-btn');
      if (reconnect) {
        reconnect.addEventListener('click', () => P2P.connectTo(p.deviceId, p.deviceName));
      }
      div.querySelector('.forget-btn').addEventListener('click', async () => {
        if (confirm(`移除配对 ${p.deviceName}？`)) {
          await DB.deletePeer(p.deviceId);
          this.refreshPeerList();
        }
      });
      c.appendChild(div);
    }
  },

  async refreshSyncLog() {
    const log = await DB.getSyncLog(50);
    const el = document.getElementById('sync-log');
    if (!el) return;
    if (log.length === 0) {
      el.innerHTML = '<div class="text-slate-400">暂无日志</div>';
      return;
    }
    el.innerHTML = log.map((l) => {
      const t = new Date(l.ts).toLocaleTimeString();
      const color = l.level === 'error' ? 'text-red-600' :
                    l.level === 'warn' ? 'text-amber-600' :
                    l.level === 'in' ? 'text-cyan-700' :
                    l.level === 'out' ? 'text-green-700' : 'text-slate-600';
      return `<div class="${color}"><span class="text-slate-400">${t}</span> ${this.esc(l.message)}</div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  },

  showMyQR() {
    const payload = P2P.getJoinPayload();
    const url = QR.generate(payload, 320);
    this.openModal(`
      <div class="text-center">
        <h3 class="text-lg font-bold mb-2">📱 让家人扫码加入</h3>
        <p class="text-sm text-slate-600 mb-3">用另一台设备打开 HamR Catch，点"扫码加入家庭"</p>
        <div id="qr-display" class="flex justify-center my-3">
          <img src="${url}" />
        </div>
        <div class="text-xs text-slate-500 mt-2">
          <div>本机: <strong>${this.esc(P2P.myDeviceName)}</strong></div>
          <div class="mt-1 break-all">ID: ${P2P.myDeviceId.slice(0, 8)}...</div>
        </div>
        <button id="btn-copy-ip" class="mt-4 px-4 py-2 bg-slate-100 rounded-lg text-sm w-full">
          📋 复制本机地址: ${location.host}
        </button>
      </div>
    `);
    document.getElementById('btn-copy-ip').addEventListener('click', () => {
      navigator.clipboard?.writeText(location.host);
      toast('已复制: ' + location.host);
    });
  },

  async startScan() {
    this.openModal(`
      <div class="text-center">
        <h3 class="text-lg font-bold mb-3">📷 扫描对方二维码</h3>
        <video id="qr-video" class="w-full rounded-lg" playsinline></video>
        <p class="text-sm text-slate-500 mt-2">将摄像头对准对方屏幕上的二维码</p>
        <p class="text-xs text-amber-600 mt-2">⚠️ 首次需要授权摄像头权限</p>
      </div>
    `);
    const video = document.getElementById('qr-video');
    try {
      const stream = await QR.startScan(video, (data) => {
        QR.stopScan(stream);
        this.handleScannedQR(data);
      });
      // 监听模态关闭，停止扫描
      document.getElementById('modal-close').addEventListener('click', () => QR.stopScan(stream), { once: true });
    } catch (e) {
      this.openModal(`
        <div class="text-center p-4">
          <div class="text-4xl mb-2">📷</div>
          <h3 class="font-bold mb-2">无法访问摄像头</h3>
          <p class="text-sm text-slate-600 mb-3">请手动输入对方设备信息</p>
          <input id="manual-ip" placeholder="http://192.168.1.100:8080" class="w-full px-3 py-2 border rounded mb-2" />
          <button id="btn-manual-connect" class="w-full bg-accent text-white py-2 rounded">连接</button>
          <div class="text-xs text-slate-400 mt-3">错误: ${this.esc(e.message)}</div>
        </div>
      `);
      document.getElementById('btn-manual-connect')?.addEventListener('click', () => {
        const url = document.getElementById('manual-ip').value.trim();
        if (url) {
          // 临时切换 signaling URL
          P2P.signalingUrl = url;
          toast('已切换信令地址: ' + url);
          this.closeModal();
        }
      });
    }
  },

  async handleScannedQR(text) {
    this.closeModal();
    const payload = QR.parse(text);
    if (payload.type === 'join' && payload.deviceId && payload.signalingUrl) {
      toast('🔗 正在连接...');
      // 临时切换信令 URL（如果对方的服务不同）
      const originalUrl = P2P.signalingUrl;
      P2P.signalingUrl = payload.signalingUrl;
      // 给对方打个招呼
      await P2P.sendSignal(payload.deviceId, JSON.stringify({
        type: 'hello',
        fromName: P2P.myDeviceName,
      }));
      // 主动发起连接
      await P2P.connectTo(payload.deviceId, payload.deviceName);
      // 5 秒后切回原 URL（让对方来连我）
      setTimeout(() => { P2P.signalingUrl = originalUrl; }, 5000);
      this.switchView('devices');
      setTimeout(() => this.refreshPeerList(), 3000);
    } else {
      toast('二维码格式无效');
    }
  },

  // ---------- 备份 ----------
  bindBackupView() {
    document.getElementById('btn-export-json').addEventListener('click', () => this.exportJson());
    document.getElementById('btn-export-xlsx').addEventListener('click', () => this.exportXlsx());
    document.getElementById('btn-export-photos').addEventListener('click', () => this.exportPhotosZip());
    document.getElementById('btn-import-json').addEventListener('click', () => {
      document.getElementById('import-input').click();
    });
    document.getElementById('import-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await this.importJson(file);
      e.target.value = '';
    });
  },

  async exportJson() {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hamr-catch-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('已导出 JSON');
  },

  async exportXlsx() {
    const assets = await DB.allAssets();
    const rows = assets.map((a) => ({
      名称: a.name,
      分类: a.category,
      位置: a.location,
      购买日期: a.buyDate,
      价格: a.price,
      备注: a.note,
      更新时间: new Date(a.updatedAt).toLocaleString(),
      照片数量: (a.photos || []).length,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '资产清单');
    XLSX.writeFile(wb, `hamr-catch-资产清单-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('已导出 Excel');
  },

  async exportPhotosZip() {
    const photos = await DB.allPhotos();
    if (photos.length === 0) {
      toast('暂无照片可导出');
      return;
    }
    const zip = new JSZip();
    for (const p of photos) {
      zip.file(`${p.localId}.jpg`, p.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hamr-catch-photos-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`已导出 ${photos.length} 张原图为 ZIP`);
  },

  async importJson(file) {
    if (!confirm('导入会合并现有数据（按时间戳较新为准）。继续？')) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await DB.importAll(data);
      toast(`导入完成: ${result.imported} 新增, ${result.conflicts} 冲突`);
      await this.refreshList();
    } catch (e) {
      toast('导入失败: ' + e.message);
    }
  },

  // ---------- 模态框 ----------
  bindModal() {
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') this.closeModal();
    });
  },
  openModal(html) {
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
  },
  closeModal() {
    document.getElementById('modal').classList.add('hidden');
    QR.stopScan();
  },
};

// 启动
window.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;