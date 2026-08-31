// ============================================================
// camera.js - 拍照 / 选图 / 缩略图生成
// ============================================================

const Camera = {
  /**
   * 处理用户选择的图片文件，生成缩略图
   * @param {File|Blob} file
   * @returns {Promise<{localId, blob, thumbnailBase64, originalAvailable}>}
   */
  async process(file) {
    const localId = 'img-' + uuid();
    const thumbnailBase64 = await this.makeThumbnail(file, 480);
    return { localId, blob: file, thumbnailBase64, originalAvailable: true };
  },

  /**
   * 用 Canvas 生成缩略图（最大 480px, JPEG 0.75）
   */
  async makeThumbnail(file, maxSize = 480) {
    const img = await fileToImage(file);
    let { width, height } = img;
    if (width > height && width > maxSize) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else if (height > maxSize) {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.75);
  },

  /**
   * 获取高清 JPEG 数据（用于本机持久化）
   */
  async compressForOriginal(file, maxSize = 1920) {
    const img = await fileToImage(file);
    let { width, height } = img;
    if (Math.max(width, height) > maxSize) {
      const ratio = maxSize / Math.max(width, height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return new Promise((res) => {
      canvas.toBlob((b) => res(b), 'image/jpeg', 0.9);
    });
  },
};

function fileToImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = rej;
    img.src = url;
  });
}

window.Camera = Camera;