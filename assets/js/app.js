/**
 * CleanQR - Main Application Controller
 * Handles UI interactions, live updates, presets, logo uploading, and exports.
 * 100% Client-Side. No user data leaves the browser.
 */

import { SiteConfig } from './config.js';
import { QREncoder } from './qr-encoder.js';
import { QRRenderer, checkContrast } from './qr-renderer.js';
import { QRExporter } from './qr-exporter.js';

// Predefined presets
const PRESETS = {
  classic: {
    foreground: '#000000',
    background: '#ffffff',
    transparent: false,
    moduleStyle: 'square',
    eyeStyle: 'square'
  },
  modernNavy: {
    foreground: '#0f172a',
    background: '#ffffff',
    transparent: false,
    moduleStyle: 'rounded',
    eyeStyle: 'rounded'
  },
  forestEmerald: {
    foreground: '#064e3b',
    background: '#f0fdf4',
    transparent: false,
    moduleStyle: 'rounded',
    eyeStyle: 'rounded'
  },
  minimalSlate: {
    foreground: '#334155',
    background: '#f8fafc',
    transparent: false,
    moduleStyle: 'rounded',
    eyeStyle: 'rounded'
  },
  crimsonImpact: {
    foreground: '#881337',
    background: '#fff1f2',
    transparent: false,
    moduleStyle: 'soft',
    eyeStyle: 'rounded'
  }
};

// Harmless sample fallback data when inputs are empty
const SAMPLE_FALLBACKS = {
  url: 'https://example.com',
  wifi: 'WIFI:T:WPA;S:Guest_WiFi;P:Welcome2026;;',
  vcard: 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Smith;Alex;;;\r\nFN:Alex Smith\r\nTITLE:Product Designer\r\nTEL;TYPE=CELL:+15551234567\r\nEMAIL:alex@example.com\r\nEND:VCARD',
  email: 'mailto:info@example.com?subject=Hello%20CleanQR',
  sms: 'sms:+15551234567?body=Hello',
  phone: 'tel:+18005550199',
  whatsapp: 'https://wa.me/14155552671?text=Hello',
  location: 'https://maps.google.com/?q=37.7749,-122.4194',
  event: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CleanQR//Event Generator//EN\r\nBEGIN:VEVENT\r\nUID:sample-evt@cleanqr\r\nDTSTAMP:20261001T000000Z\r\nSUMMARY:Sample Event\r\nDTSTART:20261015T090000\r\nDTEND:20261015T100000\r\nEND:VEVENT\r\nEND:VCALENDAR'
};

class CleanQRApp {
  constructor() {
    this.currentType = 'url';
    this.logoData = null; // { image: HTMLImageElement, sizePercent: 0.15 }
    this.cachedSvg = '';
    this.textDebounceTimer = null;
    this.isSample = true;

    this.initElements();
    this.initEventListeners();
    this.applyPreset('classic', false);
    this.updateQR();
  }

  initElements() {
    // Canvas & Preview elements
    this.canvas = document.getElementById('qr-canvas');
    this.canvasContainer = document.getElementById('canvas-container');
    this.previewBadge = document.getElementById('preview-badge');
    this.sampleNotice = document.getElementById('sample-notice');
    this.validationAlert = document.getElementById('validation-alert');
    this.contrastAlert = document.getElementById('contrast-alert');
    this.encodedTextPreview = document.getElementById('encoded-text-preview');
    this.charCountEl = document.getElementById('char-count');

    // Controls
    this.fgColorInput = document.getElementById('fg-color');
    this.fgHexInput = document.getElementById('fg-hex');
    this.bgColorInput = document.getElementById('bg-color');
    this.bgHexInput = document.getElementById('bg-hex');
    this.transparentCheckbox = document.getElementById('transparent-bg');
    this.marginInput = document.getElementById('margin-slider');
    this.marginValue = document.getElementById('margin-value');
    this.ecSelect = document.getElementById('ec-select');
    this.sizeSelect = document.getElementById('size-select');
    this.formatSelect = document.getElementById('format-select');

    // Logo elements
    this.logoInput = document.getElementById('logo-input');
    this.logoDropzone = document.getElementById('logo-dropzone');
    this.logoPreviewContainer = document.getElementById('logo-preview-container');
    this.logoThumb = document.getElementById('logo-thumb');
    this.logoRemoveBtn = document.getElementById('logo-remove-btn');
    this.logoSizeSlider = document.getElementById('logo-size-slider');
    this.logoSizeValue = document.getElementById('logo-size-value');
    this.logoWarning = document.getElementById('logo-warning');

    // Action Buttons
    this.downloadBtn = document.getElementById('download-btn');
    this.copyBtn = document.getElementById('copy-btn');
    this.printBtn = document.getElementById('print-btn');
    this.toastEl = document.getElementById('toast-notification');

    // Tab buttons & Form panels
    this.tabButtons = document.querySelectorAll('[data-qr-type]');
    this.formPanels = document.querySelectorAll('.qr-form-panel');
  }

  initEventListeners() {
    // 1. Tab Switching (Immediate update)
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-qr-type');
        this.switchTab(type);
      });
    });

    // 2. Form Text Inputs (Short debounce for smooth typing: 60ms)
    document.querySelectorAll('.qr-form-panel input, .qr-form-panel textarea, .qr-form-panel select').forEach(input => {
      input.addEventListener('input', () => this.queueTextInputUpdate());
      input.addEventListener('change', () => this.updateQR());
    });

    // 3. Color controls (IMMEDIATE UPDATES)
    if (this.fgColorInput && this.fgHexInput) {
      this.fgColorInput.addEventListener('input', (e) => {
        this.fgHexInput.value = e.target.value.toUpperCase();
        this.updateQR();
      });
      this.fgHexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          this.fgColorInput.value = val;
          this.updateQR();
        }
      });
    }

    if (this.bgColorInput && this.bgHexInput) {
      this.bgColorInput.addEventListener('input', (e) => {
        this.bgHexInput.value = e.target.value.toUpperCase();
        this.updateQR();
      });
      this.bgHexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          this.bgColorInput.value = val;
          this.updateQR();
        }
      });
    }

    // Quick color swatches (IMMEDIATE UPDATE)
    document.querySelectorAll('[data-color-target]').forEach(swatch => {
      swatch.addEventListener('click', () => {
        const target = swatch.getAttribute('data-color-target');
        const color = swatch.getAttribute('data-color-value');
        if (target === 'fg') {
          if (this.fgColorInput) this.fgColorInput.value = color;
          if (this.fgHexInput) this.fgHexInput.value = color.toUpperCase();
        } else if (target === 'bg') {
          if (this.bgColorInput) this.bgColorInput.value = color;
          if (this.bgHexInput) this.bgHexInput.value = color.toUpperCase();
          if (this.transparentCheckbox) this.transparentCheckbox.checked = false;
        }
        this.updateQR();
      });
    });

    // Transparent checkbox (IMMEDIATE UPDATE)
    if (this.transparentCheckbox) {
      this.transparentCheckbox.addEventListener('change', (e) => {
        if (this.bgColorInput) this.bgColorInput.disabled = e.target.checked;
        if (this.bgHexInput) this.bgHexInput.disabled = e.target.checked;
        this.updateQR();
      });
    }

    // Module & Eye style radios (IMMEDIATE UPDATE)
    document.querySelectorAll('input[name="module-style"]').forEach(radio => {
      radio.addEventListener('change', () => this.updateQR());
    });
    document.querySelectorAll('input[name="eye-style"]').forEach(radio => {
      radio.addEventListener('change', () => this.updateQR());
    });

    // Margin & Error Correction & Size (IMMEDIATE UPDATE)
    if (this.marginInput) {
      this.marginInput.addEventListener('input', (e) => {
        if (this.marginValue) this.marginValue.textContent = e.target.value;
        this.updateQR();
      });
    }
    if (this.ecSelect) {
      this.ecSelect.addEventListener('change', () => this.updateQR());
    }
    if (this.sizeSelect) {
      this.sizeSelect.addEventListener('change', () => this.updateQR());
    }

    // Preset Buttons (IMMEDIATE UPDATE)
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.getAttribute('data-preset');
        this.applyPreset(presetKey, true);
      });
    });

    // Logo Upload handling (IMMEDIATE UPDATE)
    if (this.logoInput) {
      this.logoInput.addEventListener('change', (e) => this.handleLogoFiles(e.target.files));
    }
    if (this.logoDropzone) {
      this.logoDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.logoDropzone.classList.add('border-blue-500', 'bg-blue-50');
      });
      this.logoDropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        this.logoDropzone.classList.remove('border-blue-500', 'bg-blue-50');
      });
      this.logoDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.logoDropzone.classList.remove('border-blue-500', 'bg-blue-50');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleLogoFiles(e.dataTransfer.files);
        }
      });
      this.logoDropzone.addEventListener('click', () => {
        if (this.logoInput) this.logoInput.click();
      });
    }

    if (this.logoRemoveBtn) {
      this.logoRemoveBtn.addEventListener('click', () => this.removeLogo());
    }

    if (this.logoSizeSlider) {
      this.logoSizeSlider.addEventListener('input', (e) => {
        const pct = parseInt(e.target.value, 10);
        if (this.logoSizeValue) this.logoSizeValue.textContent = `${pct}%`;
        if (this.logoData) {
          this.logoData.sizePercent = pct / 100;
        }
        if (this.logoWarning) {
          this.logoWarning.classList.toggle('hidden', pct <= 18);
        }
        this.updateQR();
      });
    }

    // Downloads & Exports
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => this.handleDownload());
    }
    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => this.handleCopy());
    }
    if (this.printBtn) {
      this.printBtn.addEventListener('click', () => QRExporter.print());
    }

    // Quick sample data button
    const sampleBtn = document.getElementById('sample-btn');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => this.loadSampleData());
    }
  }

  switchTab(type) {
    this.currentType = type;

    // Update Tab Buttons UI
    this.tabButtons.forEach(btn => {
      const match = btn.getAttribute('data-qr-type') === type;
      btn.setAttribute('aria-selected', match ? 'true' : 'false');
      if (match) {
        btn.classList.add('bg-blue-600', 'text-white', 'shadow-xs');
        btn.classList.remove('bg-white', 'text-slate-700', 'hover:bg-slate-100');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white', 'shadow-xs');
        btn.classList.add('bg-white', 'text-slate-700', 'hover:bg-slate-100');
      }
    });

    // Update Form Panels
    this.formPanels.forEach(panel => {
      const match = panel.id === `form-${type}`;
      panel.classList.toggle('hidden', !match);
      if (match) {
        const firstInput = panel.querySelector('input:not([type=hidden]), textarea, select');
        if (firstInput) firstInput.focus();
      }
    });

    this.updateQR();
  }

  applyPreset(presetKey, update = true) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    if (this.fgColorInput) this.fgColorInput.value = preset.foreground;
    if (this.fgHexInput) this.fgHexInput.value = preset.foreground.toUpperCase();
    if (this.bgColorInput) this.bgColorInput.value = preset.background;
    if (this.bgHexInput) this.bgHexInput.value = preset.background.toUpperCase();

    if (this.transparentCheckbox) {
      this.transparentCheckbox.checked = preset.transparent;
      if (this.bgColorInput) this.bgColorInput.disabled = preset.transparent;
      if (this.bgHexInput) this.bgHexInput.disabled = preset.transparent;
    }

    const modRadio = document.querySelector(`input[name="module-style"][value="${preset.moduleStyle}"]`);
    if (modRadio) modRadio.checked = true;

    const eyeRadio = document.querySelector(`input[name="eye-style"][value="${preset.eyeStyle}"]`);
    if (eyeRadio) eyeRadio.checked = true;

    document.querySelectorAll('[data-preset]').forEach(btn => {
      const active = btn.getAttribute('data-preset') === presetKey;
      btn.classList.toggle('border-blue-600', active);
      btn.classList.toggle('bg-blue-50/50', active);
    });

    if (update) {
      this.updateQR();
    }
  }

  handleLogoFiles(files) {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Validate type strictly, with mobile fallback for blank file.type
    const validMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    const isImageMime = file.type && (validMimes.includes(file.type) || file.type.startsWith('image/'));
    const isImageExt = /\.(png|jpe?g|webp|svg)$/i.test(file.name || '');
    if (!isImageMime && !isImageExt) {
      this.showToast('Please upload a valid image file (PNG, JPG, or WebP).', true);
      return;
    }

    // Validate file size (max 15 MB to comfortably accept smartphone camera roll photos)
    if (file.size > 15 * 1024 * 1024) {
      this.showToast('Image file size must be less than 15 MB.', true);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      this.showToast('Failed to read image file. Please try another image.', true);
    };

    reader.onload = (e) => {
      const result = e.target.result;
      if (typeof result !== 'string' || !result.startsWith('data:image/')) {
        this.showToast('Invalid image data detected.', true);
        return;
      }

      const img = new Image();
      img.onerror = () => {
        this.showToast('Could not decode image file. File may be corrupted or unsupported.', true);
      };

      img.onload = () => {
        // Guard against unusable sub-pixel images
        if (img.naturalWidth < 16 || img.naturalHeight < 16) {
          this.showToast('Image is too small to be used as a QR center logo.', true);
          return;
        }

        // Downsample large camera photos (> 512px) to 512px max dimension
        // This prevents mobile memory spikes, speeds up canvas rendering, and keeps SVG export lightweight
        let processedImg = img;
        let thumbUrl = result;
        const maxDim = 512;
        if (img.naturalWidth > maxDim || img.naturalHeight > maxDim) {
          try {
            const offCanvas = document.createElement('canvas');
            const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight);
            offCanvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            offCanvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            const offCtx = offCanvas.getContext('2d');
            if (offCtx) {
              offCtx.imageSmoothingEnabled = true;
              offCtx.imageSmoothingQuality = 'high';
              offCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);
              thumbUrl = offCanvas.toDataURL('image/png');
              const downsampledImg = new Image();
              downsampledImg.src = thumbUrl;
              processedImg = downsampledImg;
            }
          } catch (canvasErr) {
            console.warn('Could not downsample image via offscreen canvas, using original', canvasErr);
          }
        }

        const sliderPct = this.logoSizeSlider ? parseInt(this.logoSizeSlider.value, 10) : 15;
        const safePct = Math.min(Math.max(sliderPct, 10), 22);
        this.logoData = {
          image: processedImg,
          sizePercent: safePct / 100
        };

        // Automatically set Level H error correction for logos
        if (this.ecSelect) {
          this.ecSelect.value = 'H';
        }

        if (this.logoThumb) this.logoThumb.src = thumbUrl;
        if (this.logoPreviewContainer) this.logoPreviewContainer.classList.remove('hidden');
        if (this.logoDropzone) this.logoDropzone.classList.add('hidden');

        this.showToast('Logo attached. Error correction set to High (H) for reliable scanning.');
        this.updateQR();
      };

      img.src = result;
    };

    reader.readAsDataURL(file);
  }

  removeLogo() {
    this.logoData = null;
    if (this.logoInput) this.logoInput.value = '';
    if (this.logoThumb) this.logoThumb.src = '';
    if (this.logoPreviewContainer) this.logoPreviewContainer.classList.add('hidden');
    if (this.logoDropzone) this.logoDropzone.classList.remove('hidden');
    this.updateQR();
  }

  getFormData() {
    const data = {};
    const activePanel = document.getElementById(`form-${this.currentType}`);
    if (!activePanel) return data;

    activePanel.querySelectorAll('input, textarea, select').forEach(field => {
      const name = field.name;
      if (!name) return;
      if (field.type === 'checkbox') {
        data[name] = field.checked;
      } else {
        data[name] = field.value;
      }
    });

    return data;
  }

  // Short debounce strictly for typing in text fields
  queueTextInputUpdate() {
    clearTimeout(this.textDebounceTimer);
    this.textDebounceTimer = setTimeout(() => this.updateQR(), 60);
  }

  async updateQR() {
    const formData = this.getFormData();
    let textToEncode = '';
    let isUserEmpty = false;

    // Check if user has entered non-empty content
    const rawValues = Object.values(formData).filter(v => typeof v === 'string' && v.trim().length > 0);
    if (rawValues.length === 0) {
      isUserEmpty = true;
    }

    if (isUserEmpty) {
      // Use harmless realistic sample QR code
      textToEncode = SAMPLE_FALLBACKS[this.currentType] || 'https://example.com';
      this.isSample = true;
      if (this.validationAlert) {
        this.validationAlert.classList.add('hidden');
      }
    } else {
      const encoded = QREncoder.encode(this.currentType, formData);
      if (encoded.error) {
        if (this.validationAlert) {
          this.validationAlert.textContent = encoded.error;
          this.validationAlert.classList.remove('hidden');
        }
        textToEncode = SAMPLE_FALLBACKS[this.currentType] || 'https://example.com';
        this.isSample = true;
      } else {
        textToEncode = encoded.text;
        this.isSample = false;
        if (this.validationAlert) {
          this.validationAlert.classList.add('hidden');
        }
      }
    }

    // Update Live/Sample badges and notices safely
    if (this.previewBadge) {
      if (this.isSample) {
        this.previewBadge.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200';
        this.previewBadge.replaceChildren();
        const dot = document.createElement('span');
        dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500';
        this.previewBadge.appendChild(dot);
        this.previewBadge.appendChild(document.createTextNode('Sample QR'));
      } else {
        this.previewBadge.className = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
        this.previewBadge.replaceChildren();
        const dot = document.createElement('span');
        dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse';
        this.previewBadge.appendChild(dot);
        this.previewBadge.appendChild(document.createTextNode('Live QR'));
      }
    }

    if (this.sampleNotice) {
      this.sampleNotice.classList.toggle('hidden', !this.isSample);
      if (this.isSample) {
        const codeEl = this.sampleNotice.querySelector('code');
        if (codeEl) {
          const sampleLabel = textToEncode.length > 32 ? textToEncode.slice(0, 29) + '...' : textToEncode;
          codeEl.textContent = sampleLabel;
        }
      }
    }

    // Update preview details with textContent
    if (this.encodedTextPreview) {
      this.encodedTextPreview.textContent = textToEncode;
    }
    if (this.charCountEl) {
      this.charCountEl.textContent = `${textToEncode.length} chars`;
    }

    // Read customization options synchronously
    const fg = this.fgColorInput ? this.fgColorInput.value : '#000000';
    const bg = this.bgColorInput ? this.bgColorInput.value : '#ffffff';
    const transparent = this.transparentCheckbox ? this.transparentCheckbox.checked : false;
    const margin = this.marginInput ? parseInt(this.marginInput.value, 10) : 4;
    const ec = this.ecSelect ? this.ecSelect.value : 'M';
    const size = this.sizeSelect ? parseInt(this.sizeSelect.value, 10) : 512;

    const modStyleEl = document.querySelector('input[name="module-style"]:checked');
    const moduleStyle = modStyleEl ? modStyleEl.value : 'square';

    const eyeStyleEl = document.querySelector('input[name="eye-style"]:checked');
    const eyeStyle = eyeStyleEl ? eyeStyleEl.value : 'square';

    // Contrast check
    if (!transparent) {
      const contrast = checkContrast(fg, bg);
      if (this.contrastAlert) {
        if (!contrast.isReadable || !contrast.isFgDarker) {
          this.contrastAlert.textContent = 'Low contrast warning: Dark code on light background recommended.';
          this.contrastAlert.classList.remove('hidden');
        } else {
          this.contrastAlert.classList.add('hidden');
        }
      }
    } else {
      if (this.contrastAlert) this.contrastAlert.classList.add('hidden');
    }

    const renderOptions = {
      size,
      foreground: fg,
      background: bg,
      transparent,
      margin,
      moduleStyle,
      eyeStyle,
      errorCorrection: ec,
      logo: this.logoData
    };

    // Render Canvas safely
    try {
      await QRRenderer.renderToCanvas(this.canvas, textToEncode, renderOptions);
      this.cachedSvg = QRRenderer.generateSvg(textToEncode, renderOptions);
    } catch (err) {
      if (this.validationAlert) {
        this.validationAlert.textContent = err.message || 'Error generating QR code. Content may be too long.';
        this.validationAlert.classList.remove('hidden');
      }
    }
  }

  handleDownload() {
    const format = this.formatSelect ? this.formatSelect.value : 'png';
    const type = this.isSample ? 'sample' : this.currentType;

    if (format === 'svg') {
      if (!this.cachedSvg) {
        this.showToast('SVG could not be generated. Please try PNG.', true);
        return;
      }
      QRExporter.downloadSvg(this.cachedSvg, type);
    } else if (format === 'jpg') {
      const bg = this.bgColorInput ? this.bgColorInput.value : '#ffffff';
      QRExporter.downloadJpg(this.canvas, type, bg);
    } else {
      QRExporter.downloadPng(this.canvas, type);
    }

    this.showToast(`Downloaded as ${format.toUpperCase()}!`);
  }

  async handleCopy() {
    try {
      await QRExporter.copyToClipboard(this.canvas);
      this.showToast('Copied QR image to clipboard!');
    } catch (err) {
      this.showToast('Could not copy image directly. Please use Download PNG.', true);
    }
  }

  showToast(message, isError = false) {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden', 'bg-slate-900', 'bg-red-600');
    this.toastEl.classList.add(isError ? 'bg-red-600' : 'bg-slate-900');
    this.toastEl.style.opacity = '1';

    setTimeout(() => {
      this.toastEl.style.opacity = '0';
      setTimeout(() => this.toastEl.classList.add('hidden'), 300);
    }, 2800);
  }

  loadSampleData() {
    switch (this.currentType) {
      case 'url': {
        const input = document.getElementById('input-url');
        if (input) input.value = 'https://example.com';
        break;
      }
      case 'wifi': {
        const ssid = document.getElementById('input-wifi-ssid');
        const pass = document.getElementById('input-wifi-pass');
        if (ssid) ssid.value = 'CoffeeShop_Guest';
        if (pass) pass.value = 'Roast2026!';
        break;
      }
      case 'vcard': {
        const fn = document.getElementById('input-vcard-first');
        const ln = document.getElementById('input-vcard-last');
        const org = document.getElementById('input-vcard-org');
        const tel = document.getElementById('input-vcard-phone');
        const email = document.getElementById('input-vcard-email');
        if (fn) fn.value = 'Sarah';
        if (ln) ln.value = 'Chen';
        if (org) org.value = 'CleanQR Studio';
        if (tel) tel.value = '+1 415 555 0199';
        if (email) email.value = 'sarah@cleanqr.local';
        break;
      }
      case 'email': {
        const to = document.getElementById('input-email-to');
        const sub = document.getElementById('input-email-subject');
        const body = document.getElementById('input-email-body');
        if (to) to.value = 'hello@example.com';
        if (sub) sub.value = 'Project Inquiry';
        if (body) body.value = 'Hi there, I would love to connect about your utility tools.';
        break;
      }
      case 'sms': {
        const phone = document.getElementById('input-sms-phone');
        const msg = document.getElementById('input-sms-message');
        if (phone) phone.value = '+1 555 123 4567';
        if (msg) msg.value = 'Hello from CleanQR!';
        break;
      }
      case 'phone': {
        const phone = document.getElementById('input-phone-num');
        if (phone) phone.value = '+1 800 555 0199';
        break;
      }
      case 'whatsapp': {
        const phone = document.getElementById('input-wa-phone');
        const msg = document.getElementById('input-wa-msg');
        if (phone) phone.value = '14155552671';
        if (msg) msg.value = 'Hi, I would like more information.';
        break;
      }
      case 'location': {
        const lat = document.getElementById('input-loc-lat');
        const lng = document.getElementById('input-loc-lng');
        const label = document.getElementById('input-loc-label');
        if (lat) lat.value = '37.7749';
        if (lng) lng.value = '-122.4194';
        if (label) label.value = 'San Francisco Ferry Building';
        break;
      }
      case 'event': {
        const title = document.getElementById('input-evt-title');
        const start = document.getElementById('input-evt-start');
        const loc = document.getElementById('input-evt-loc');
        const desc = document.getElementById('input-evt-desc');
        if (title) title.value = 'Product Launch Demo';
        if (start) start.value = '2026-10-15T10:00';
        if (loc) loc.value = 'Innovation Hall, Room 3B';
        if (desc) desc.value = 'Join us for live product demos, Q&A, and networking.';
        break;
      }
      default:
        break;
    }
    this.updateQR();
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.cleanQRApp = new CleanQRApp();
});
