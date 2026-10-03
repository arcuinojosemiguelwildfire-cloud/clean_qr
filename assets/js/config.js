/**
 * CleanQR Site Configuration
 * Central configuration file for brand name, paths, social links, and metadata.
 */

export const SiteConfig = {
  name: 'CleanQR',
  title: 'CleanQR – Free Private QR Code Generator',
  tagline: 'Fast, Private & 100% Free QR Code Generator',
  description: 'Generate custom, high-resolution QR codes directly in your browser. No sign-up, no dynamic subscription traps, no watermarks, and 100% private.',
  domain: 'cleanqr.local',
  canonicalBase: '', // Automatically falls back to window.location.origin
  contactEmail: 'contact@cleanqr.local',
  year: 2026,
  version: '1.0.0',
  lastUpdated: 'September 2026',
  
  // Future suite navigation items
  tools: [
    { id: 'qr-code-generator', name: 'QR Code Generator', path: '/qr-code-generator/', active: true },
    { id: 'image-color-picker', name: 'Image Color Picker', path: '#', comingSoon: true },
    { id: 'percentage-calculator', name: 'Percentage Calculator', path: '#', comingSoon: true },
    { id: 'tip-calculator', name: 'Tip Calculator', path: '#', comingSoon: true }
  ],

  // Resolves path relative to the current location to safely support subdirectories and shared hosting
  resolvePath(targetPath) {
    if (!targetPath || targetPath === '#') return '#';
    // If it's already an absolute or relative protocol, return as is
    if (/^(?:https?:|\/\/)/i.test(targetPath)) return targetPath;
    
    // Normalize targetPath removing leading slash
    const cleanTarget = targetPath.replace(/^\/+/, '');
    
    // Detect depth from current pathname
    const segments = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const depth = segments.length > 0 && !segments[0].includes('.html') ? segments.length : 0;
    
    // If we're inside a subdirectory like /qr-code-generator/ or /about/, prefix with '../'
    const prefix = depth > 0 ? '../'.repeat(depth) : './';
    return cleanTarget ? prefix + cleanTarget : prefix;
  }
};
