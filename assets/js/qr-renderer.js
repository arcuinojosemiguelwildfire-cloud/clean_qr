/**
 * CleanQR - QR Renderer Module
 * Generates custom QR code module patterns, eye styles, logo integration, and SVG export.
 * 100% Client-Side using 'qrcode' library's bit matrix generator.
 */
import QRCode from 'qrcode';

// Hex color validation to prevent SVG injection or invalid canvas colors
function sanitizeHex(hex, fallback = '#000000') {
  if (typeof hex !== 'string') return fallback;
  const clean = hex.trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(clean)) {
    return clean;
  }
  return fallback;
}

function parseHex(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c.slice(0, 6), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function getLuminance({ r, g, b }) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// Safe rounded rectangle path generator compatible with all browsers and mobile WebViews
function drawRoundedRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function checkContrast(fgHex, bgHex) {
  try {
    const fg = parseHex(sanitizeHex(fgHex, '#000000'));
    const bg = parseHex(sanitizeHex(bgHex, '#ffffff'));
    const lum1 = getLuminance(fg);
    const lum2 = getLuminance(bg);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    const ratio = (brightest + 0.05) / (darkest + 0.05);
    const isFgDarker = lum1 < lum2;
    return {
      ratio: Number(ratio.toFixed(2)),
      isReadable: ratio >= 3.0,
      isFgDarker
    };
  } catch {
    return { ratio: 21, isReadable: true, isFgDarker: true };
  }
}

export const QRRenderer = {
  /**
   * Helper to check if a matrix cell (row, col) is inside one of the three 7x7 finder patterns.
   */
  isEyeModule(row, col, matrixSize) {
    // Top-Left eye
    if (row < 7 && col < 7) return true;
    // Top-Right eye
    if (row < 7 && col >= matrixSize - 7) return true;
    // Bottom-Left eye
    if (row >= matrixSize - 7 && col < 7) return true;
    return false;
  },

  /**
   * Helper to check if a cell is on the timing tracks (Row 6 or Column 6).
   * Timing patterns must always remain solid squares so decoders can lock onto the clock tracks.
   */
  isTimingModule(row, col) {
    return row === 6 || col === 6;
  },

  /**
   * Helper to draw custom Eye Finder Pattern
   */
  drawEye(ctx, originX, originY, eyeSize, eyeStyle, fgColor, bgColor, transparent) {
    const moduleSize = eyeSize / 7;
    ctx.save();

    if (eyeStyle === 'circle') {
      const centerX = originX + eyeSize / 2;
      const centerY = originY + eyeSize / 2;

      // Outer ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, eyeSize / 2 - moduleSize / 2, 0, Math.PI * 2);
      ctx.strokeStyle = fgColor;
      ctx.lineWidth = moduleSize;
      ctx.stroke();

      // Inner space (if not transparent)
      if (!transparent) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, eyeSize / 2 - moduleSize, 0, Math.PI * 2);
        ctx.fillStyle = bgColor;
        ctx.fill();
      }

      // Center pupil
      ctx.beginPath();
      ctx.arc(centerX, centerY, (3 * moduleSize) / 2, 0, Math.PI * 2);
      ctx.fillStyle = fgColor;
      ctx.fill();

    } else if (eyeStyle === 'rounded') {
      const outerRadius = moduleSize * 1.2;
      const innerRadius = moduleSize * 0.8;

      // Outer frame
      ctx.fillStyle = fgColor;
      ctx.beginPath();
      drawRoundedRect(ctx, originX, originY, eyeSize, eyeSize, outerRadius);
      ctx.fill();

      // Middle cutout
      ctx.fillStyle = transparent ? 'rgba(0,0,0,0)' : bgColor;
      if (transparent) {
        ctx.globalCompositeOperation = 'destination-out';
      }
      ctx.beginPath();
      drawRoundedRect(ctx, originX + moduleSize, originY + moduleSize, 5 * moduleSize, 5 * moduleSize, moduleSize * 0.8);
      ctx.fill();
      if (transparent) {
        ctx.globalCompositeOperation = 'source-over';
      }

      // Inner pupil
      ctx.fillStyle = fgColor;
      ctx.beginPath();
      drawRoundedRect(ctx, originX + 2 * moduleSize, originY + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize, innerRadius);
      ctx.fill();

    } else {
      // Classic Square - exact module grid alignment
      ctx.fillStyle = fgColor;
      // Outer 7x7 frame
      ctx.fillRect(originX, originY, eyeSize, eyeSize);

      // Inner 5x5 cutout
      ctx.fillStyle = transparent ? 'rgba(0,0,0,0)' : bgColor;
      if (transparent) {
        ctx.globalCompositeOperation = 'destination-out';
      }
      ctx.fillRect(originX + moduleSize, originY + moduleSize, 5 * moduleSize, 5 * moduleSize);
      if (transparent) {
        ctx.globalCompositeOperation = 'source-over';
      }

      // Center 3x3 pupil
      ctx.fillStyle = fgColor;
      ctx.fillRect(originX + 2 * moduleSize, originY + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);
    }

    ctx.restore();
  },

  /**
   * Main render function that draws to an HTML Canvas
   */
  async renderToCanvas(canvas, text, options = {}) {
    if (!text || !canvas) return null;

    const {
      size = 512,
      foreground = '#000000',
      background = '#ffffff',
      transparent = false,
      margin = 4,
      moduleStyle = 'square',
      eyeStyle = 'square',
      errorCorrection = 'M',
      logo = null
    } = options;

    const fg = sanitizeHex(foreground, '#000000');
    const bg = sanitizeHex(background, '#ffffff');

    // Generate raw QR code matrix with error handling for large payloads
    const ecLevel = logo ? 'H' : errorCorrection;
    let qrData;
    try {
      qrData = QRCode.create(text, { errorCorrectionLevel: ecLevel });
    } catch {
      // If error correction H was too large, attempt lower EC level if no logo
      if (!logo && (ecLevel === 'H' || ecLevel === 'Q')) {
        try {
          qrData = QRCode.create(text, { errorCorrectionLevel: 'L' });
        } catch {
          throw new Error('Data is too large to fit in a QR code. Please shorten your content.');
        }
      } else {
        throw new Error('Data is too large to fit in a QR code. Please shorten your content.');
      }
    }

    const matrix = qrData.modules;
    const matrixSize = matrix.size;

    // Integer pixel alignment: every module is an exact whole number of pixels
    const targetSize = size || 512;
    const totalModules = matrixSize + margin * 2;
    const modulePx = Math.max(2, Math.floor(targetSize / totalModules));
    const renderSize = totalModules * modulePx;
    const offset = margin * modulePx;

    // Setup canvas dimensions with exact integer pixels
    canvas.width = renderSize;
    canvas.height = renderSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Disable image smoothing for razor-sharp, scan-safe pixel edges
    ctx.imageSmoothingEnabled = false;

    // Clear canvas
    ctx.clearRect(0, 0, renderSize, renderSize);

    // Draw background if not transparent
    if (!transparent) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, renderSize, renderSize);
    }

    // Calculate center logo coordinates safely (10% to 22% max of total QR dimension)
    let logoPxSize = 0;
    let logoX = 0;
    let logoY = 0;
    let shieldSize = 0;
    let shieldX = 0;
    let shieldY = 0;

    if (logo && logo.image) {
      const sizePercent = Math.min(Math.max(logo.sizePercent || 0.15, 0.10), 0.22);
      let rawLogoPx = Math.floor(renderSize * sizePercent);
      if (rawLogoPx % 2 !== 0) rawLogoPx -= 1;
      logoPxSize = rawLogoPx;
      logoX = Math.round((renderSize - logoPxSize) / 2);
      logoY = Math.round((renderSize - logoPxSize) / 2);

      const shieldPadding = Math.round(modulePx * 0.4);
      shieldSize = logoPxSize + shieldPadding * 2;
      shieldX = Math.round((renderSize - shieldSize) / 2);
      shieldY = Math.round((renderSize - shieldSize) / 2);
    }

    // 1. Draw Body Modules (Full bit matrix preserved so Reed-Solomon Level H can reliably recover from center logo)
    ctx.fillStyle = fg;

    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        // Skip eye regions
        if (this.isEyeModule(r, c, matrixSize)) continue;

        // Check if module is dark
        if (matrix.get(r, c)) {
          const x = offset + c * modulePx;
          const y = offset + r * modulePx;

          // Timing tracks (row 6 and col 6) MUST always remain solid square for clock track recognition
          if (this.isTimingModule(r, c) || moduleStyle === 'square') {
            ctx.fillRect(x, y, modulePx, modulePx);
          } else if (moduleStyle === 'dots') {
            // Scan-safe dot squircle: preserves contiguous module contact so decoders do not fragment bits
            const rad = Math.max(1, Math.round(modulePx * 0.38));
            ctx.beginPath();
            drawRoundedRect(ctx, x, y, modulePx, modulePx, rad);
            ctx.fill();
          } else if (moduleStyle === 'rounded') {
            const rad = Math.max(1, Math.round(modulePx * 0.20));
            ctx.beginPath();
            drawRoundedRect(ctx, x, y, modulePx, modulePx, rad);
            ctx.fill();
          } else if (moduleStyle === 'soft') {
            const rad = Math.max(1, Math.round(modulePx * 0.32));
            ctx.beginPath();
            drawRoundedRect(ctx, x, y, modulePx, modulePx, rad);
            ctx.fill();
          }
        }
      }
    }

    // 2. Draw 3 Corner Eyes with exact integer module alignment
    const eyeDimension = 7 * modulePx;

    // Top-Left Eye
    this.drawEye(ctx, offset, offset, eyeDimension, eyeStyle, fg, bg, transparent);

    // Top-Right Eye
    const trX = offset + (matrixSize - 7) * modulePx;
    this.drawEye(ctx, trX, offset, eyeDimension, eyeStyle, fg, bg, transparent);

    // Bottom-Left Eye
    const blY = offset + (matrixSize - 7) * modulePx;
    this.drawEye(ctx, offset, blY, eyeDimension, eyeStyle, fg, bg, transparent);

    // 3. Draw Logo with protective shield and aspect ratio preservation
    if (logo && logo.image && logoPxSize > 0) {
      // Draw background protective shield
      ctx.save();
      ctx.fillStyle = transparent ? '#ffffff' : bg;
      ctx.beginPath();
      drawRoundedRect(ctx, shieldX, shieldY, shieldSize, shieldSize, Math.round(modulePx * 0.8));
      ctx.fill();

      // Hairline border around shield
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw logo image safely with aspect-ratio preservation and crisp scaling
      try {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const imgW = logo.image.naturalWidth || logo.image.width || 1;
        const imgH = logo.image.naturalHeight || logo.image.height || 1;
        const scale = Math.min(logoPxSize / imgW, logoPxSize / imgH);
        const drawW = Math.max(1, Math.round(imgW * scale));
        const drawH = Math.max(1, Math.round(imgH * scale));
        const drawX = Math.round(logoX + (logoPxSize - drawW) / 2);
        const drawY = Math.round(logoY + (logoPxSize - drawH) / 2);
        ctx.drawImage(logo.image, drawX, drawY, drawW, drawH);
      } catch (err) {
        console.warn('Error drawing logo to canvas', err);
      }
      ctx.restore();
    }

    return canvas;
  },

  /**
   * Generates clean, standalone vector SVG string with SVG 1.1/2.0 compatibility
   */
  generateSvg(text, options = {}) {
    if (!text) return '';

    const {
      size = 512,
      foreground = '#000000',
      background = '#ffffff',
      transparent = false,
      margin = 4,
      moduleStyle = 'square',
      eyeStyle = 'square',
      errorCorrection = 'M',
      logo = null
    } = options;

    const fg = sanitizeHex(foreground, '#000000');
    const bg = sanitizeHex(background, '#ffffff');

    const ecLevel = logo ? 'H' : errorCorrection;
    let qrData;
    try {
      qrData = QRCode.create(text, { errorCorrectionLevel: ecLevel });
    } catch {
      try {
        qrData = QRCode.create(text, { errorCorrectionLevel: 'L' });
      } catch {
        return '';
      }
    }

    const matrix = qrData.modules;
    const matrixSize = matrix.size;

    const targetSize = size || 512;
    const totalModules = matrixSize + margin * 2;
    const modulePx = Math.max(2, Math.floor(targetSize / totalModules));
    const renderSize = totalModules * modulePx;
    const offset = margin * modulePx;

    const svgElements = [];

    // Background
    if (!transparent) {
      svgElements.push(`<rect width="${renderSize}" height="${renderSize}" fill="${bg}" />`);
    }

    // Logo shield and dimensions
    let logoPxSize = 0;
    let logoX = 0;
    let logoY = 0;
    let shieldSize = 0;
    let shieldX = 0;
    let shieldY = 0;

    if (logo && logo.image) {
      const sizePercent = Math.min(Math.max(logo.sizePercent || 0.15, 0.10), 0.22);
      let rawLogoPx = Math.floor(renderSize * sizePercent);
      if (rawLogoPx % 2 !== 0) rawLogoPx -= 1;
      logoPxSize = rawLogoPx;
      logoX = Math.round((renderSize - logoPxSize) / 2);
      logoY = Math.round((renderSize - logoPxSize) / 2);

      const shieldPadding = Math.round(modulePx * 0.4);
      shieldSize = logoPxSize + shieldPadding * 2;
      shieldX = Math.round((renderSize - shieldSize) / 2);
      shieldY = Math.round((renderSize - shieldSize) / 2);
    }

    // Body modules (Full matrix preserved for Level H Reed-Solomon scanning reliability)
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (this.isEyeModule(r, c, matrixSize)) continue;

        if (matrix.get(r, c)) {
          const x = offset + c * modulePx;
          const y = offset + r * modulePx;

          if (this.isTimingModule(r, c) || moduleStyle === 'square') {
            svgElements.push(`<rect x="${x}" y="${y}" width="${modulePx}" height="${modulePx}" fill="${fg}" />`);
          } else if (moduleStyle === 'dots') {
            const rx = Math.max(1, Math.round(modulePx * 0.38));
            svgElements.push(`<rect x="${x}" y="${y}" width="${modulePx}" height="${modulePx}" rx="${rx}" fill="${fg}" />`);
          } else if (moduleStyle === 'rounded') {
            const rx = Math.max(1, Math.round(modulePx * 0.20));
            svgElements.push(`<rect x="${x}" y="${y}" width="${modulePx}" height="${modulePx}" rx="${rx}" fill="${fg}" />`);
          } else if (moduleStyle === 'soft') {
            const rx = Math.max(1, Math.round(modulePx * 0.32));
            svgElements.push(`<rect x="${x}" y="${y}" width="${modulePx}" height="${modulePx}" rx="${rx}" fill="${fg}" />`);
          }
        }
      }
    }

    // Corner Eye SVG Generator
    const renderSvgEye = (originX, originY) => {
      const eyeSize = 7 * modulePx;
      const mod = modulePx;
      const elements = [];

      if (eyeStyle === 'circle') {
        const cx = (originX + eyeSize / 2).toFixed(1);
        const cy = (originY + eyeSize / 2).toFixed(1);
        const outerR = (eyeSize / 2 - mod / 2).toFixed(1);
        const innerR = ((3 * mod) / 2).toFixed(1);

        elements.push(`<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${fg}" stroke-width="${mod}" />`);
        if (!transparent) {
          elements.push(`<circle cx="${cx}" cy="${cy}" r="${(eyeSize / 2 - mod).toFixed(1)}" fill="${bg}" />`);
        }
        elements.push(`<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${fg}" />`);
      } else if (eyeStyle === 'rounded') {
        const outerRad = Math.round(mod * 1.2);
        const innerRad = Math.round(mod * 0.8);

        elements.push(`<rect x="${originX}" y="${originY}" width="${eyeSize}" height="${eyeSize}" rx="${outerRad}" fill="${fg}" />`);
        elements.push(`<rect x="${originX + mod}" y="${originY + mod}" width="${5 * mod}" height="${5 * mod}" rx="${Math.round(mod * 0.8)}" fill="${transparent ? '#ffffff' : bg}" />`);
        elements.push(`<rect x="${originX + 2 * mod}" y="${originY + 2 * mod}" width="${3 * mod}" height="${3 * mod}" rx="${innerRad}" fill="${fg}" />`);
      } else {
        // Classic Square
        elements.push(`<rect x="${originX}" y="${originY}" width="${eyeSize}" height="${eyeSize}" fill="${fg}" />`);
        elements.push(`<rect x="${originX + mod}" y="${originY + mod}" width="${5 * mod}" height="${5 * mod}" fill="${transparent ? '#ffffff' : bg}" />`);
        elements.push(`<rect x="${originX + 2 * mod}" y="${originY + 2 * mod}" width="${3 * mod}" height="${3 * mod}" fill="${fg}" />`);
      }
      return elements.join('\n');
    };

    // 3 Finder Eyes
    svgElements.push(renderSvgEye(offset, offset));
    svgElements.push(renderSvgEye(offset + (matrixSize - 7) * modulePx, offset));
    svgElements.push(renderSvgEye(offset, offset + (matrixSize - 7) * modulePx));

    // Logo embedding in SVG with safe Data URL validation
    if (logo && logo.image && logo.image.src && logoPxSize > 0) {
      const src = logo.image.src;
      // Only embed verified base64 image data URLs in SVG output
      if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(src)) {
        svgElements.push(`<rect x="${shieldX}" y="${shieldY}" width="${shieldSize}" height="${shieldSize}" rx="${Math.round(modulePx * 0.8)}" fill="${transparent ? '#ffffff' : bg}" stroke="rgba(0,0,0,0.12)" stroke-width="1" />`);
        svgElements.push(`<image x="${logoX}" y="${logoY}" width="${logoPxSize}" height="${logoPxSize}" href="${src}" xlink:href="${src}" preserveAspectRatio="xMidYMid meet" />`);
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${renderSize} ${renderSize}" width="${renderSize}" height="${renderSize}">
  ${svgElements.join('\n  ')}
</svg>`;
  }
};
