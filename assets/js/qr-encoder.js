/**
 * CleanQR - QR Encoder Module
 * Formats and validates input for all 9 standard QR code types.
 * 100% Client-Side. Follows RFC & MeCard standards.
 */

// Helper to escape special characters for Wi-Fi strings (MeCard standard: \ ; , : " )
function escapeWifi(str) {
  if (!str) return '';
  return str.replace(/([\\;,:"])/g, '\\$1');
}

// Helper to escape text values for vCard 3.0 (RFC 2426: \ ; , and \n)
function escapeVCard(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Helper to escape text values for iCalendar VEVENT (RFC 5545: \ ; , and \n)
function escapeICal(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Robust parser for calendar dates supporting compact iCal (YYYYMMDDTHHMMSS), ISO (YYYY-MM-DDTHH:mm), space separated, or Date objects
function parseCalendarDate(input) {
  if (!input) return null;
  if (input instanceof Date && !isNaN(input.getTime())) return input;
  const str = String(input).trim();
  // 1. Compact iCalendar format: YYYYMMDDTHHMMSS(Z)? or YYYYMMDD
  const compactMatch = str.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i);
  if (compactMatch) {
    const [, yr, mo, da, hr = '00', min = '00', sec = '00', isUtc] = compactMatch;
    if (isUtc) return new Date(Date.UTC(+yr, +mo - 1, +da, +hr, +min, +sec));
    return new Date(+yr, +mo - 1, +da, +hr, +min, +sec);
  }
  // 2. Standard ISO / separated format: YYYY-MM-DD[T /]HH:mm(:ss)?(Z)?
  const isoMatch = str.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z)?)?$/i);
  if (isoMatch) {
    const [, yr, mo, da, hr = '00', min = '00', sec = '00', isUtc] = isoMatch;
    if (isUtc) return new Date(Date.UTC(+yr, +mo - 1, +da, +hr, +min, +sec));
    return new Date(+yr, +mo - 1, +da, +hr, +min, +sec);
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Helper to format Date to iCalendar local floating format (YYYYMMDDTHHMMSS)
function formatICalDate(d) {
  if (!d || isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Helper to format UTC timestamp for RFC 5545 required DTSTAMP field (YYYYMMDDTHHMMSSZ)
function formatICalDateUtc(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export const QREncoder = {
  /**
   * 1. Website URL / Link
   * Normalizes protocol, handles international characters and spaces in path/queries.
   */
  encodeUrl(data) {
    let raw = (data.url || '').trim();
    if (!raw) {
      return { error: 'Please enter a website URL or link.' };
    }

    // Auto-prepend https:// if no protocol is given
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(raw)) {
      raw = 'https://' + raw;
    }

    try {
      // Validate with URL constructor
      const parsed = new URL(raw);
      // Valid URL
      return { text: parsed.href, type: 'Website URL / Link' };
    } catch {
      // Attempt safe encodeURI for URLs with raw spaces or Unicode before rejecting
      try {
        const encodedAttempt = encodeURI(raw);
        const parsed = new URL(encodedAttempt);
        return { text: parsed.href, type: 'Website URL / Link' };
      } catch {
        return { error: 'Please enter a valid website address or link (e.g. https://example.com).' };
      }
    }
  },

  /**
   * 2. Wi-Fi
   * MeCard standard WIFI specification.
   */
  encodeWifi(data) {
    const ssid = (data.ssid || '').trim();
    const password = data.password || '';
    const security = (data.security || 'WPA').toUpperCase(); // WPA, WEP, nopass
    const hidden = Boolean(data.hidden);

    if (!ssid) {
      return { error: 'Please enter the Wi-Fi network name (SSID).' };
    }

    if (security !== 'NOPASS' && !password) {
      return { error: 'Please enter the Wi-Fi password, or set security to "None".' };
    }

    // Format: WIFI:T:WPA;S:MySSID;P:mypass;H:false;;
    const secTag = security === 'NOPASS' ? 'nopass' : security;
    const escapedSSID = escapeWifi(ssid);
    const escapedPass = security === 'NOPASS' ? '' : escapeWifi(password);
    const hiddenTag = hidden ? 'true' : 'false';

    const wifiString = `WIFI:T:${secTag};S:${escapedSSID};P:${escapedPass};H:${hiddenTag};;`;
    return { text: wifiString, type: 'Wi-Fi' };
  },

  /**
   * 4. Contact / vCard 3.0
   * Standards-compliant vCard with character escaping and multiline address support.
   */
  encodeVCard(data) {
    const firstName = (data.firstName || '').trim();
    const lastName = (data.lastName || '').trim();
    const phone = (data.phone || '').trim();
    const email = (data.email || '').trim();
    const org = (data.org || '').trim();
    const title = (data.title || '').trim();
    const url = (data.url || '').trim();
    const street = (data.street || '').trim();
    const city = (data.city || '').trim();
    const state = (data.state || '').trim();
    const zip = (data.zip || '').trim();
    const country = (data.country || '').trim();

    if (!firstName && !lastName && !org && !phone && !email) {
      return { error: 'Please enter at least a name, organization, phone, or email for the contact.' };
    }

    const escFN = escapeVCard([firstName, lastName].filter(Boolean).join(' ') || org);
    const escN = `${escapeVCard(lastName)};${escapeVCard(firstName)};;;`;

    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${escN}`,
      `FN:${escFN}`
    ];

    if (org) lines.push(`ORG:${escapeVCard(org)}`);
    if (title) lines.push(`TITLE:${escapeVCard(title)}`);
    if (phone) lines.push(`TEL;TYPE=CELL:${phone.replace(/[\s()-]/g, '')}`);
    if (email) lines.push(`EMAIL;TYPE=INTERNET:${email.trim()}`);
    if (url) lines.push(`URL:${url.trim()}`);
    if (street || city || state || zip || country) {
      lines.push(`ADR;TYPE=WORK:;;${escapeVCard(street)};${escapeVCard(city)};${escapeVCard(state)};${escapeVCard(zip)};${escapeVCard(country)}`);
    }

    lines.push('END:VCARD');
    return { text: lines.join('\r\n'), type: 'Contact / vCard' };
  },

  /**
   * 5. Email
   * RFC 6068 standard mailto URI.
   */
  encodeEmail(data) {
    const email = (data.email || '').trim().toLowerCase();
    const subject = data.subject || '';
    const body = data.body || '';

    if (!email) {
      return { error: 'Please enter an email address.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Please enter a valid email address (e.g. name@example.com).' };
    }

    const params = [];
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
    if (body) params.push(`body=${encodeURIComponent(body)}`);

    const mailto = `mailto:${email}${params.length > 0 ? '?' + params.join('&') : ''}`;
    return { text: mailto, type: 'Email' };
  },

  /**
   * 6. SMS
   * RFC 5724 standard SMS URI.
   */
  encodeSms(data) {
    const phone = (data.phone || '').trim();
    const message = data.message || '';

    if (!phone) {
      return { error: 'Please enter a recipient phone number.' };
    }

    const cleanPhone = phone.replace(/[\s()-]/g, '');
    const smsUri = `sms:${cleanPhone}${message ? '?body=' + encodeURIComponent(message) : ''}`;
    return { text: smsUri, type: 'SMS' };
  },

  /**
   * 7. Phone
   * RFC 3966 standard tel URI.
   */
  encodePhone(data) {
    const phone = (data.phone || '').trim();
    if (!phone) {
      return { error: 'Please enter a phone number.' };
    }
    const cleanPhone = phone.replace(/[\s()-]/g, '');
    return { text: `tel:${cleanPhone}`, type: 'Phone' };
  },

  /**
   * 8. WhatsApp
   * Official WhatsApp wa.me direct link format.
   */
  encodeWhatsApp(data) {
    const phone = (data.phone || '').trim();
    const message = data.message || '';

    if (!phone) {
      return { error: 'Please enter a WhatsApp phone number with country code.' };
    }

    // WhatsApp requires pure digits (no +, leading zeros, dashes)
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 5) {
      return { error: 'Please include country code without plus sign (e.g. 14155552671).' };
    }

    const waUrl = `https://wa.me/${digitsOnly}${message ? '?text=' + encodeURIComponent(message) : ''}`;
    return { text: waUrl, type: 'WhatsApp' };
  },

  /**
   * 9. Location (Google Maps universal web query)
   * Opens natively in Apple Maps on iOS and Google Maps on Android.
   */
  encodeLocation(data) {
    const latStr = (data.lat || '').toString().trim();
    const lngStr = (data.lng || '').toString().trim();
    const label = (data.label || '').trim();

    if (!latStr || !lngStr) {
      return { error: 'Please enter both latitude and longitude coordinates.' };
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return { error: 'Latitude must be a valid number between -90 and 90.' };
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return { error: 'Longitude must be a valid number between -180 and 180.' };
    }

    const query = label ? `${lat},${lng} (${encodeURIComponent(label)})` : `${lat},${lng}`;
    const mapsUrl = `https://maps.google.com/?q=${query}`;
    return { text: mapsUrl, type: 'Location' };
  },

  /**
   * 10. Calendar / Event
   * iCalendar VEVENT standard (RFC 5545) with proper escaping, multiline safety, UID, and DTSTAMP.
   */
  encodeEvent(data) {
    const title = (data.title || '').trim();
    const start = data.start || '';
    const end = data.end || '';
    const location = (data.location || '').trim();
    const description = (data.description || '').trim();

    if (!title) {
      return { error: 'Please enter an event title.' };
    }
    if (!start) {
      return { error: 'Please select a start date and time.' };
    }

    const startDate = parseCalendarDate(start);
    if (!startDate) {
      return { error: 'Invalid start date format. Please select or enter a valid date.' };
    }

    // If no end time is specified, default to start + 1 hour so the event has a valid non-zero duration
    let endDate;
    if (end) {
      endDate = parseCalendarDate(end);
      if (!endDate) {
        return { error: 'Invalid end date format.' };
      }
      if (endDate.getTime() < startDate.getTime()) {
        return { error: 'Event end time cannot be before start time.' };
      }
    } else {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }

    const dtStart = formatICalDate(startDate);
    const dtEnd = formatICalDate(endDate);

    // RFC 5545 specifies that UID and DTSTAMP are REQUIRED for valid VEVENT objects
    const now = new Date();
    const dtStamp = formatICalDateUtc(now);
    const cleanTitle = title.replace(/\W/g, '').slice(0, 12) || 'event';
    const uid = `${dtStart}-${cleanTitle}@cleanqr`;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CleanQR//Event Generator//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `SUMMARY:${escapeICal(title)}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`
    ];

    if (location) {
      lines.push(`LOCATION:${escapeICal(location)}`);
    }
    if (description) {
      lines.push(`DESCRIPTION:${escapeICal(description)}`);
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');
    return { text: lines.join('\r\n'), type: 'Calendar Event' };
  },

  /**
   * Master dispatcher for given type and data object
   */
  encode(type, data) {
    switch (type) {
      case 'url': return this.encodeUrl(data);
      case 'wifi': return this.encodeWifi(data);
      case 'vcard': return this.encodeVCard(data);
      case 'email': return this.encodeEmail(data);
      case 'sms': return this.encodeSms(data);
      case 'phone': return this.encodePhone(data);
      case 'whatsapp': return this.encodeWhatsApp(data);
      case 'location': return this.encodeLocation(data);
      case 'event': return this.encodeEvent(data);
      default: return { error: `Unsupported QR code type: ${type}` };
    }
  }
};
