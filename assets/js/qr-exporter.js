/**
 * CleanQR - QR Exporter Module
 * Handles file downloads (PNG, JPG, SVG), clipboard copying, and print triggers.
 * 100% Client-Side.
 */

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function triggerStringDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  triggerBlobDownload(blob, filename);
}

export const QRExporter = {
  /**
   * Generates a clean, timestamped file name
   */
  getFileName(type = 'qr-code', ext = 'png') {
    const cleanType = String(type).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'qr';
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `cleanqr-${cleanType}-${timestamp}.${ext}`;
  },

  /**
   * Export to PNG
   */
  downloadPng(canvas, type = 'qr-code') {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        triggerBlobDownload(blob, this.getFileName(type, 'png'));
      }
    }, 'image/png');
  },

  /**
   * Export to JPG (ensure solid background)
   */
  downloadJpg(canvas, type = 'qr-code', bgColor = '#ffffff') {
    if (!canvas) return;
    // Create an offscreen canvas to guarantee solid background without alpha
    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = bgColor || '#ffffff';
    ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    offCanvas.toBlob((blob) => {
      if (blob) {
        triggerBlobDownload(blob, this.getFileName(type, 'jpg'));
      }
    }, 'image/jpeg', 0.95);
  },

  /**
   * Export to SVG
   */
  downloadSvg(svgString, type = 'qr-code') {
    if (!svgString) return;
    triggerStringDownload(svgString, this.getFileName(type, 'svg'), 'image/svg+xml;charset=utf-8');
  },

  /**
   * Copy to Clipboard as PNG image
   */
  async copyToClipboard(canvas) {
    if (!canvas) {
      throw new Error('Canvas not found');
    }
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      throw new Error('Clipboard image copy not supported in this browser. Please use Download PNG.');
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          return reject(new Error('Failed to create image blob'));
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          resolve(true);
        } catch (err) {
          reject(err);
        }
      }, 'image/png');
    });
  },

  /**
   * Print QR code
   */
  print() {
    window.print();
  }
};
