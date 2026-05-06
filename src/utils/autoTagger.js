/**
 * autoTagger.js
 *
 * Rule-based "AI-style" tagger that decorates a clipboard item with
 * a useful set of tags right at capture time. The rules are intentionally
 * simple and explainable — no external API calls, fully offline.
 *
 * Tag categories produced:
 *   - link, <domain>            (urls)
 *   - code, <language>          (code snippets)
 *   - emoji
 *   - image
 *   - article (long text), snippet (short text)
 *   - email, contact            (email or phone numbers)
 *   - color, design             (hex codes)
 *   - token, sensitive          (JWTs / API-key shaped strings)
 *   - sensitive                 (credit card patterns)
 */

import { guessLanguage } from './typeDetector.js';

const LONG_TEXT_THRESHOLD = 200;
const SHORT_TEXT_THRESHOLD = 30;

const RX = {
  url:        /^https?:\/\/[^\s]+$/i,
  email:      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  phone:      /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/,
  hexColor:   /#([0-9a-f]{3}|[0-9a-f]{6})\b/i,
  // JWT: three base64url segments separated by dots, prefixed with eyJ (header).
  jwt:        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  // Looks like an API key: long opaque mixed-case string. Conservative.
  apiKeyish:  /\b[A-Za-z0-9_\-]{32,}\b/,
  // Credit card: 13–19 digit groupings; we only flag, never store full numbers visibly.
  creditCard: /\b(?:\d[ -]*?){13,19}\b/
};

/**
 * Build the tag list for a captured item.
 * @param {{type:string, content:string, sourceDomain?:string|null}} input
 * @returns {string[]} unique tag list
 */
export function autoTag({ type, content, sourceDomain }) {
  const tags = new Set();
  const text = typeof content === 'string' ? content : '';

  // -- type-driven tags --
  switch (type) {
    case 'url': {
      tags.add('link');
      try {
        const host = new URL(text).hostname.replace(/^www\./, '');
        if (host) tags.add(host);
      } catch { /* malformed URL — skip domain tag */ }
      break;
    }
    case 'code': {
      tags.add('code');
      const lang = guessLanguage(text);
      if (lang) tags.add(lang);
      break;
    }
    case 'emoji':
      tags.add('emoji');
      break;
    case 'image':
      tags.add('image');
      break;
    case 'html':
      tags.add('html');
      break;
    default:
      break;
  }

  // -- length-based tags (text only) --
  if (type !== 'image') {
    if (text.length >= LONG_TEXT_THRESHOLD) tags.add('article');
    else if (text.length > 0 && text.length <= SHORT_TEXT_THRESHOLD) tags.add('snippet');
  }

  // -- pattern-based tags --
  if (RX.email.test(text)) { tags.add('contact'); tags.add('email'); }
  if (RX.phone.test(text) && !RX.url.test(text)) tags.add('contact');
  if (RX.hexColor.test(text)) { tags.add('color'); tags.add('design'); }

  if (RX.jwt.test(text)) {
    tags.add('token');
    tags.add('sensitive');
  } else if (
    RX.apiKeyish.test(text) &&
    /(api[_-]?key|secret|token|bearer)/i.test(text)
  ) {
    tags.add('token');
    tags.add('sensitive');
  }

  if (looksLikeCreditCard(text)) tags.add('sensitive');

  if (sourceDomain && !tags.has(sourceDomain) && type !== 'url') {
    tags.add(`from:${sourceDomain.replace(/^www\./, '')}`);
  }

  return Array.from(tags);
}

/**
 * Credit-card heuristic: digits-only after stripping separators, 13–19 long,
 * passing the Luhn check. Avoids tagging long phone numbers as cards.
 */
function looksLikeCreditCard(text) {
  if (!RX.creditCard.test(text)) return false;
  const digits = text.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}
