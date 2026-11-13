/**
 * StickyPad — Strict HTML & Input Sanitizer
 * Pure vanilla JavaScript with zero external dependencies.
 * Compatible with Node.js and Browser environments.
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

  /**
   * Escape HTML special characters
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Strip all HTML tags, returning safe plain text
   */
  function stripHtml(html) {
    if (typeof html !== 'string') return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Sanitize HTML content with strict allowlist.
   * Strips all scripts, event handlers, styles, iframes, images, and unauthorized attributes.
   */
  function sanitizeNoteHtml(raw) {
    if (typeof raw !== 'string') return '';
    if (!raw.trim()) return '';

    // If pure plain text with no tags, return escaped or wrapped
    if (!/<[a-z][\s\S]*>/i.test(raw)) {
      return escapeHtml(raw);
    }

    // 1. Remove dangerous blocks completely (script, style, iframe, object, embed, svg, math)
    let cleaned = raw.replace(/<(?:script|style|iframe|object|embed|svg|math|applet|form|input|button|select|textarea)[\s\S]*?(?:<\/(?:script|style|iframe|object|embed|svg|math|applet|form|input|button|select|textarea)>|\/?>)/gi, '');

    // 2. Parse and filter through a state machine / tag matcher
    // Matches tags: </?([a-z0-9]+)([^>]*)>
    cleaned = cleaned.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagName, attrs) => {
      const tag = tagName.toLowerCase();

      // If tag is not in allowed list, strip the tag completely
      if (!ALLOWED_TAGS.has(tag)) {
        return '';
      }

      // Closing tags: </div/span/b/etc>
      if (match.startsWith('</')) {
        return `</${tag}>`;
      }

      // Self-closing / void tags
      if (tag === 'br') {
        return '<br>';
      }

      // Filter attributes
      const allowedAttrs = [];

      if (tag === 'div') {
        // Only allow class="checklist-item" and data-checked="true|false"
        if (/\bclass\s*=\s*["']?\s*checklist-item\s*["']?/i.test(attrs)) {
          allowedAttrs.push('class="checklist-item"');
        }
        const checkedMatch = attrs.match(/\bdata-checked\s*=\s*["']?(true|false)["']?/i);
        if (checkedMatch) {
          allowedAttrs.push(`data-checked="${checkedMatch[1]}"`);
        }
      } else if (tag === 'span') {
        // Parse classes
        const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i);
        if (classMatch) {
          const classes = classMatch[1].split(/\s+/).filter(c => ALLOWED_SPAN_CLASSES.has(c));
          if (classes.length > 0) {
            allowedAttrs.push(`class="${classes.join(' ')}"`);
          }
        }

        // data-font
        const fontMatch = attrs.match(/\bdata-font\s*=\s*["']([^"']*)["']/i);
        if (fontMatch && ALLOWED_FONTS.has(fontMatch[1].toLowerCase())) {
          allowedAttrs.push(`data-font="${fontMatch[1].toLowerCase()}"`);
        }

        // contenteditable
        if (/\bcontenteditable\s*=\s*["']?false["']?/i.test(attrs)) {
          allowedAttrs.push('contenteditable="false"');
        } else if (/\bcontenteditable\s*=\s*["']?true["']?/i.test(attrs)) {
          allowedAttrs.push('contenteditable="true"');
        }

        // style font-family
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

    // Final safety pass: remove any leftover orphaned event handlers or javascript: strings
    cleaned = cleaned.replace(/\bon[a-z]+\s*=\s*["'][^"']*["']/gi, '');
    cleaned = cleaned.replace(/javascript:/gi, 'blocked:');

    return cleaned;
  }

  /**
   * Validates and cleans imported notes JSON structure against Prototype Pollution and DoS.
   */
  function sanitizeImportedNotes(rawJsonString) {
    if (typeof rawJsonString !== 'string') {
      throw new Error('Input must be a string');
    }

    // Limit input file size (max 10MB)
    if (rawJsonString.length > 10 * 1024 * 1024) {
      throw new Error('File exceeds maximum allowed size of 10 MB');
    }

    // Guard against prototype pollution in JSON
    const parsed = JSON.parse(rawJsonString, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });

    let notesArray = [];
    if (Array.isArray(parsed)) {
      notesArray = parsed;
    } else if (parsed && Array.isArray(parsed.notes)) {
      notesArray = parsed.notes;
    } else {
      throw new Error('File does not contain a valid notes array');
    }

    // Limit maximum note count to 200 notes
    if (notesArray.length > 200) {
      throw new Error('Import file exceeds limit of 200 notes');
    }

    const ALLOWED_COLORS = new Set(['yellow', 'peach', 'pink', 'purple', 'blue', 'green', 'taupe', 'teal']);
    const ALLOWED_STYLES = new Set(['classic', 'corner-curl', 'bent-edge', 'wavy-curl', 'taped']);
    const ALLOWED_FONTS_LIST = new Set(['sans', 'handwriting', 'manga']);

    const cleanedNotes = [];
    for (let i = 0; i < notesArray.length; i++) {
      const item = notesArray[i];
      if (!item || typeof item !== 'object') continue;

      // Safe ID (strictly note_[a-z0-9_]+)
      let id = typeof item.id === 'string' && /^note_[a-zA-Z0-9_-]+$/.test(item.id)
        ? item.id
        : `note_${Date.now()}_imp_${Math.random().toString(36).substring(2, 7)}`;

      // Safe content with length limit (max 500,000 chars) & HTML sanitization
      let rawContent = typeof item.content === 'string' ? item.content.slice(0, 500000) : '';
      let cleanContent = sanitizeNoteHtml(rawContent);

      // Safe color
      let color = typeof item.color === 'string' ? item.color.toLowerCase() : 'yellow';
      if (color === 'dark') color = 'teal';
      if (!ALLOWED_COLORS.has(color)) color = 'yellow';

      // Safe paper style
      let paperStyle = typeof item.paperStyle === 'string' ? item.paperStyle.toLowerCase() : 'classic';
      if (!ALLOWED_STYLES.has(paperStyle)) paperStyle = 'classic';

      // Safe font
      let fontFamily = typeof item.fontFamily === 'string' ? item.fontFamily.toLowerCase() : 'sans';
      if (!ALLOWED_FONTS_LIST.has(fontFamily)) fontFamily = 'sans';

      let fontSize = typeof item.fontSize === 'number' && item.fontSize >= 12 && item.fontSize <= 36 ? Math.round(item.fontSize) : 16;
      let opacity = typeof item.opacity === 'number' && item.opacity >= 0.1 && item.opacity <= 1.0 ? item.opacity : 1.0;
      let tilt = typeof item.tilt === 'number' && item.tilt >= -10 && item.tilt <= 10 ? Math.round(item.tilt * 10) / 10 : 0;
      let width = typeof item.width === 'number' ? Math.min(600, Math.max(260, Math.round(item.width))) : 320;
      let height = typeof item.height === 'number' ? Math.min(600, Math.max(180, Math.round(item.height))) : 360;

      // Safe stickers (max 30)
      let stickers = [];
      if (Array.isArray(item.stickers)) {
        stickers = item.stickers.slice(0, 30).map((stk, idx) => {
          if (!stk || typeof stk !== 'object') return null;
          return {
            id: typeof stk.id === 'string' ? stk.id.slice(0, 50) : `stk_${idx}`,
            emoji: typeof stk.emoji === 'string' ? stk.emoji.slice(0, 8) : '⭐',
            x: typeof stk.x === 'number' ? Math.max(0, Math.min(800, Math.round(stk.x))) : 50,
            y: typeof stk.y === 'number' ? Math.max(0, Math.min(800, Math.round(stk.y))) : 50,
            size: typeof stk.size === 'number' ? Math.max(16, Math.min(140, Math.round(stk.size))) : 36
          };
        }).filter(Boolean);
      }

      // Safe doodles (PNG data URL only, max 2MB)
      let doodles = null;
      if (typeof item.doodles === 'string' && item.doodles.startsWith('data:image/png;base64,') && item.doodles.length <= 2 * 1024 * 1024) {
        doodles = item.doodles;
      }

      cleanedNotes.push({
        id,
        content: cleanContent,
        color,
        paperStyle,
        fontFamily,
        fontSize,
        opacity,
        tilt,
        width,
        height,
        expandedHeight: height,
        isPinned: Boolean(item.isPinned),
        isCollapsed: Boolean(item.isCollapsed),
        isLocked: Boolean(item.isLocked),
        stickers,
        doodles,
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now()
      });
    }

    return cleanedNotes;
  }

  function isSafeFontFamily(font) {
    if (typeof font !== 'string') return false;
    return ALLOWED_FONTS.has(font.toLowerCase().trim());
  }

  exports.escapeHtml = escapeHtml;
  exports.stripHtml = stripHtml;
  exports.sanitizeNoteHtml = sanitizeNoteHtml;
  exports.sanitizeHtml = sanitizeNoteHtml;
  exports.sanitizeImportedNotes = sanitizeImportedNotes;
  exports.isSafeFontFamily = isSafeFontFamily;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.stickySanitizer = {}));
