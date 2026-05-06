/**
 * typeDetector.js
 *
 * Pure functions that classify a clipboard payload into one of the six
 * supported types: "image" | "url" | "emoji" | "code" | "html" | "text".
 *
 * Detection is intentionally cheap (regex-only). The output drives both
 * how we store the item and which icon/theme the UI renders.
 */

// Emoji range — covers common pictographic, supplemental, and flag ranges.
const EMOJI_RE = /\p{Extended_Pictographic}/u;

// URL — http(s) only; we don't auto-tag arbitrary URI schemes.
const URL_RE = /^https?:\/\/[^\s]+$/i;

// Heuristic code patterns: looks for at least two strong "code" tells.
const CODE_HINTS = [
  /\bfunction\s+\w+\s*\(/,
  /=>\s*[\{\(]/,
  /\b(const|let|var)\s+\w+\s*=/,
  /\bclass\s+\w+\s*\{/,
  /\bdef\s+\w+\s*\(/,
  /\bimport\s+.+\s+from\s+['"]/,
  /#include\s*<[^>]+>/,
  /\bSELECT\b[\s\S]+\bFROM\b/i,
  /\bpublic\s+(static\s+)?(class|void)\b/,
  /[{};]\s*$/m,
  /^\s*<\/?\w+[^>]*>\s*$/m
];

/**
 * Detect the type of the captured payload.
 * @param {{content?:string, html?:string, image?:string|null}} payload
 * @returns {"image"|"url"|"emoji"|"code"|"html"|"text"}
 */
export function detectType({ content = '', html = '', image = null } = {}) {
  if (image && typeof image === 'string' && image.startsWith('data:image')) {
    return 'image';
  }

  const text = (content || '').trim();

  // Single emoji or emoji-only string → "emoji"
  if (text && EMOJI_RE.test(text) && stripEmoji(text).length === 0) {
    return 'emoji';
  }

  // Single URL on a line → "url"
  if (text && URL_RE.test(text)) {
    return 'url';
  }

  // Heuristic code detection.
  if (text && looksLikeCode(text)) {
    return 'code';
  }

  // Rich text only (no plain text equivalent) → "html"
  if (!text && html) return 'html';

  return 'text';
}

/**
 * Lightweight language guesser used by autoTagger. Returns a string like
 * "javascript" / "python" / "html" / null.
 */
export function guessLanguage(content) {
  if (!content) return null;
  const s = String(content);

  if (/<\/?(div|span|html|body|p|a)\b/i.test(s)) return 'html';
  if (/^\s*</.test(s) && /<\/[a-z]/i.test(s)) return 'xml';
  if (/\bdef\s+\w+\s*\(.*\):/.test(s)) return 'python';
  if (/\b(import|from)\s+.+\s+import\b/.test(s) || /\bprint\s*\(/.test(s)) return 'python';
  if (/^\s*package\s+\w/.test(s) || /\bfunc\s+\w+\s*\(/.test(s)) return 'go';
  if (/\bpublic\s+(static\s+)?(class|void)\b/.test(s)) return 'java';
  if (/#include\s*</.test(s)) return 'cpp';
  if (/\bSELECT\b[\s\S]+\bFROM\b/i.test(s)) return 'sql';
  if (/\b(const|let|var)\s+\w+\s*=/.test(s) || /=>\s*[\{\(]/.test(s)) return 'javascript';
  if (/\binterface\s+\w/.test(s) || /:\s*(string|number|boolean)\b/.test(s)) return 'typescript';
  if (/^\s*\$\w+\s*=/.test(s) || /<\?php/.test(s)) return 'php';
  return null;
}

function stripEmoji(s) {
  return s.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, '').trim();
}

function looksLikeCode(text) {
  if (text.length < 8) return false;
  let hits = 0;
  for (const re of CODE_HINTS) {
    if (re.test(text)) hits++;
    if (hits >= 2) return true;
  }
  // Long indented line plus braces → code-ish.
  if (/^\s{2,}/m.test(text) && /[{};]/.test(text)) hits++;
  return hits >= 2;
}
