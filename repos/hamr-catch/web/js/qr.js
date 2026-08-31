// ============================================================
// qr.js - QR 码生成与扫描
// ============================================================

const QR = {
  /**
   * 生成 QR 码图片（data URL），内容为 payload 对象（自动 JSON）
   */
  generate(payload, size = 320) {
    const text = JSON.stringify(payload);
    const qr = qrcode(0, 'M'); // type 0 = auto, error correction 'M'
    qr.addData(text);
    qr.make();
    // 创建 canvas 绘制
    const moduleCount = qr.getModuleCount();
    const cellSize = Math.floor(size / moduleCount);
    const actualSize = cellSize * moduleCount;
    const canvas = document.createElement('canvas');
    canvas.width = actualSize;
    canvas.height = actualSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, actualSize, actualSize);
    ctx.fillStyle = '#0f172a';
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }
    return canvas.toDataURL('image/png');
  },

  /**
   * 解析 QR 扫描到的字符串
   */
  parse(text) {
    try {
      return JSON.parse(text);
    } catch {
      // 也支持纯 URL 形式（备选）
      return { url: text };
    }
  },

  /**
   * 启动摄像头扫描
   * @param {HTMLVideoElement} video
   * @param {(payload)=>void} onScan
   */
  async startScan(video, onScan) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();
    this._scanLoop(video, onScan);
    return stream;
  },

  _scanLoop(video, onScan) {
    if (this._scanning === false) return;
    const canvas = document.getElementById('qr-canvas');
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        onScan(code.data);
        return;
      }
    }
    requestAnimationFrame(() => this._scanLoop(video, onScan));
  },

  stopScan(stream) {
    this._scanning = false;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  },
};

window.QR = QR;