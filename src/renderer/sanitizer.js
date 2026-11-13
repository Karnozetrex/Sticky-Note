/**
 * StickyPad — Strict HTML & Input Sanitizer (Renderer Copy)
 */
(function(exports) {
  'use strict';

  const ALLOWED_TAGS = new Set([
    'div', 'span', 'br', 'b', 'i', 'u', 'strong', 'em', 'p'
  ]);

  const ALLOWED_SPAN_CLASSES = new Set([
    'font-sans', 'font-handwriting', 'font-manga', 'checkbox-custom', 'checklist-text'
  ]);

  const ALLOWED_FONTS = new Set(['sans', 'handwriting', 'manga']);

  const SAFE_FONT_FAMILIES = [
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'Caveat, cursive',
    'Patrick Hand, cursive'
  ];

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripHtml(html) {
    if (typeof html !== 'string') return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  function sanitizeNoteHtml(raw) {
    if (typeof raw !== 'string') return '';
    if (!raw.trim()) return '';

    if (!/<[a-z][\s\S]*>/i.test(raw)) {
      return escapeHtml(raw);
    }

    let cleaned = raw.replace(/<(?:script|style|iframe|object|embed|svg|math|applet|form|input|button|select|textarea)[\s\S]*?(?:<\/(?:script|style|iframe|object|embed|svg|math|applet|form|input|button|select|textarea)>|\/?>)/gi, '');

    cleaned = cleaned.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagName, attrs) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (match.startsWith('</')) return `</${tag}>`;
      if (tag === 'br') return '<br>';

      const allowedAttrs = [];
      if (tag === 'div') {
        if (/\bclass\s*=\s*["']?\s*checklist-item\s*["']?/i.test(attrs)) {
          allowedAttrs.push('class="checklist-item"');
        }
        const checkedMatch = attrs.match(/\bdata-checked\s*=\s*["']?(true|false)["']?/i);
        if (checkedMatch) {
          allowedAttrs.push(`data-checked="${checkedMatch[1]}"`);
        }
      } else if (tag === 'span') {
        const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i);
        if (classMatch) {
          const classes = classMatch[1].split(/\s+/).filter(c => ALLOWED_SPAN_CLASSES.has(c));
          if (classes.length > 0) {
            allowedAttrs.push(`class="${classes.join(' ')}"`);
          }
        }
        const fontMatch = attrs.match(/\bdata-font\s*=\s*["']([^"']*)["']/i);
        if (fontMatch && ALLOWED_FONTS.has(fontMatch[1].toLowerCase())) {
          allowedAttrs.push(`data-font="${fontMatch[1].toLowerCase()}"`);
        }
        if (/\bcontenteditable\s*=\s*["']?false["']?/i.test(attrs)) {
          allowedAttrs.push('contenteditable="false"');
        } else if (/\bcontenteditable\s*=\s*["']?true["']?/i.test(attrs)) {
          allowedAttrs.push('contenteditable="true"');
        }
        if (/\bstyle\s*=\s*["']([^"']*)["']/i.test(attrs)) {
          const styleVal = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/i)[1];
          const matchedFamily = SAFE_FONT_FAMILIES.find(f => styleVal.includes(f));
          if (matchedFamily) {
            allowedAttrs.push(`style="font-family: ${matchedFamily};"`);
          }
        }
      }

      const attrString = allowedAttrs.length > 0 ? ' ' + allowedAttrs.join(' ') : '';
      return `<${tag}${attrString}>`;
    });

    cleaned = cleaned.replace(/\bon[a-z]+\s*=\s*["'][^"']*["']/gi, '');
    cleaned = cleaned.replace(/javascript:/gi, 'blocked:');

    return cleaned;
  }

  function isSafeFontFamily(font) {
    if (typeof font !== 'string') return false;
    return ALLOWED_FONTS.has(font.toLowerCase().trim());
  }

  exports.escapeHtml = escapeHtml;
  exports.stripHtml = stripHtml;
  exports.sanitizeNoteHtml = sanitizeNoteHtml;
  exports.sanitizeHtml = sanitizeNoteHtml;
  exports.isSafeFontFamily = isSafeFontFamily;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.stickySanitizer = {}));
