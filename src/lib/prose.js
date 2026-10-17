// @ts-nocheck
/* The prose helpers, copied as is from author-business System/Tools/sf.js (the prose section, with U.escapeHtml and
 * U.wordCount), so the app counts words and cleans prose exactly as sf does. Do not edit it here: change sf.js, then copy
 * again with `npm run sync-parser`. tests/prose.test.ts checks the copy when the vault is checked out beside this repository. */
const U = (() => {
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  function wordCount(text) {
    const m = String(text || '').match(/[A-Za-z0-9À-ɏЀ-ӿ]+(?:['’\-][A-Za-z0-9À-ɏ]+)*/g);
    return m ? m.length : 0;
  }
  return { escapeHtml, wordCount };
})();

export const Prose = (() => {
  const RE_FENCE = /^\s*(```|~~~)/;
  const RE_HEAD = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
  const RE_HR = /^\s*([-*_])(\s*\1){2,}\s*$/;

  // Comments are removed but their line breaks stay, so line numbers still match the file.
  const stripComments = (s) => String(s || '').replace(/%%[\s\S]*?%%|<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));

  function inline(text) {
    const codes = [];
    text = String(text || '').replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return '\u0000C' + (codes.length - 1) + '\u0000'; });
    let s = U.escapeHtml(text);
    s = s.replace(/!?\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (m, target, sub, alias) => (alias || target).trim());
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => (/^(https?:|mailto:)/i.test(url) ? '<a href="' + url + '">' + label + '</a>' : label));
    s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    s = s.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
    s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => '<code>' + U.escapeHtml(codes[+i]) + '</code>');
    return s;
  }

  // The reading text of a body with the same number of lines as the body: comments, callouts (author notes),
  // code, headings and rules become empty lines, and Markdown markers go while the words stay.
  function proseLines(body) {
    const lines = stripComments(body).replace(/\r\n?/g, '\n').split('\n');
    let inFence = false, inCallout = false;
    return lines.map((l) => {
      if (RE_FENCE.test(l)) { inFence = !inFence; return ''; }
      if (inFence) return '';
      if (/^\s*>\s*\[!/.test(l)) { inCallout = true; return ''; }
      if (inCallout) { if (/^\s*>/.test(l)) return ''; inCallout = false; }
      if (RE_HEAD.test(l) || RE_HR.test(l)) return '';
      return l
        .replace(/!\[\[[^\]]*\]\]/g, '')
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/(\*\*|__|==|~~)/g, '')
        .replace(/(^|[\s(“"'‘])[*_]([^*_\n]+)[*_](?=[\s.,;:!?)”"'’—–-]|$)/g, '$1$2')
        .replace(/^\s*>\s?/, '');
    }).join('\n');
  }

  const proseText = (body) => proseLines(body).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();

  // Keep the author's words and emphasis for a book export; drop comments, callouts and headings.
  function cleanProse(body) {
    const lines = stripComments(body || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let inCallout = false, inFence = false;
    lines.forEach((l) => {
      if (RE_FENCE.test(l)) { inFence = !inFence; return; }
      if (inFence) return;
      if (/^\s*>\s*\[!/.test(l)) { inCallout = true; return; }
      if (inCallout) { if (/^\s*>/.test(l)) return; inCallout = false; }
      if (/^#{1,6}\s/.test(l)) return;
      out.push(l);
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const ABBR = /^(mr|mrs|ms|dr|st|mt|jr|sr|vs|etc|prof|capt|lt|col|gen|sgt|rev|fr|no|ave|blvd|dept|e\.g|i\.e|a\.m|p\.m|u\.s|u\.k)$/i;

  // Sentence segmentation with offsets; keeps dialogue tags with their quote ("Stop!" she said.).
  function sentences(text) {
    const res = [];
    let start = 0, i = 0;
    const n = text.length;
    function push(end) {
      const raw = text.slice(start, end);
      const lead = raw.match(/^\s*/)[0].length;
      const s = raw.trim();
      if (s && /[A-Za-z0-9]/.test(s)) res.push({ text: s, start: start + lead, end: start + lead + s.length });
      start = end;
    }
    while (i < n) {
      const c = text[i];
      if (c === '\n' && text[i + 1] === '\n') { push(i); i += 2; continue; }
      if (c === '.' || c === '!' || c === '?' || c === '…') {
        let j = i + 1;
        while (j < n && /[.!?…]/.test(text[j])) j++;
        while (j < n && /["'”’)\]]/.test(text[j])) j++;
        if (j >= n) { push(n); i = n; break; }
        if (!/\s/.test(text[j])) { i = j; continue; }
        let k = j;
        while (k < n && /[ \t]/.test(text[k])) k++;
        const next = text[k] || '';
        if (text[k] === '\n' || /["'“‘(\[A-Z0-9À-Ý]/.test(next)) {
          if (c === '.') {
            const wm = text.slice(Math.max(0, i - 12), i).match(/([A-Za-z.]+)$/);
            const w = wm ? wm[1] : '';
            if (ABBR.test(w) || /^[A-Z]$/.test(w)) { i = j; continue; }
          }
          push(j);
          i = j;
          continue;
        }
        i = j;
        continue;
      }
      i++;
    }
    if (start < n) push(n);
    return res;
  }

  function paragraphs(text) {
    const res = [], re = /\n\s*\n/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      const chunk = text.slice(last, m.index);
      if (chunk.trim()) res.push({ text: chunk, start: last, end: m.index });
      last = m.index + m[0].length;
    }
    if (text.slice(last).trim()) res.push({ text: text.slice(last), start: last, end: text.length });
    return res;
  }

  function paraHtml(text, breakMark) {
    return text.split(/\n\s*\n/).map((p) => {
      p = p.trim();
      if (!p) return '';
      if (/^(#|\*\s?\*\s?\*)$/.test(p)) return '<p class="break">' + breakMark + '</p>';
      return '<p>' + inline(p).replace(/\n/g, ' ') + '</p>';
    }).filter(Boolean).join('\n');
  }

  return { stripComments, inline, proseLines, proseText, cleanProse, sentences, paragraphs, paraHtml };
})();

export const wordCount = U.wordCount;
