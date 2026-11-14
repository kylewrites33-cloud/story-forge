// @ts-nocheck
/* The Kindle file's shared parts, copied as is from author-business System/Tools/sf.js (the Kindle section): curly quotes,
 * the stylesheet, the title page, the series pages, the cover size and the ready check, so the app's Make the Kindle file
 * and `sf compile --epub` make the same pages. Do not edit it here: change sf.js, then copy again with
 * `npm run sync-parser`. tests/kindle.test.ts checks the copy when the vault is checked out beside this repository. */
export const Kindle = (() => {
  const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ------------------------------------------------------------------ typography
  // Curly quotes, long dashes and one-character ellipses, put in as the file is made: the words in the vault never
  // change. Works on finished markup (XHTML or Word XML): only the text between tags changes, a tag like <em> is
  // see-through, and a block tag (a paragraph, a line break) starts the text afresh.
  const BLOCK = /^<\/?(?:p|div|h[1-6]|li|ol|ul|section|nav|body|br|w:p|w:br|w:tab)\b/i;
  const SPACE = (c) => !c || /\s/.test(c);
  const OPEN = /[([{“‘]/;
  const DASH = /[—–-]/;
  const WORD = /[\p{L}\p{N}]/u;
  // Words that start with an apostrophe for a dropped letter: 'em, 'til, 'cause, rock 'n' roll.
  const ELIDE = /^(?:em|tis|twas|til|cause|cos|cuz|bout|n|nuff|kay)(?![\p{L}])/iu;

  function dashes(t) {
    return t.replace(/(^|[^-])--(?!-)/g, '$1—').replace(/\.\s?\.\s?\.(?!\s?\.)/g, '…');
  }

  function smart(markup) {
    const parts = String(markup).split(/(<[^>]*>)/);
    for (let i = 0; i < parts.length; i += 2) {
      parts[i] = dashes(parts[i].replace(/&quot;|&#34;/g, '"').replace(/&#39;|&apos;|&#x27;/gi, "'"));
    }
    // The next character of text after part i, character j: '' at a block tag or the end.
    const next = (i, j) => {
      for (;;) {
        if (j < parts[i].length) return parts[i][j];
        i++;
        if (i >= parts.length) return '';
        if (i % 2) { if (BLOCK.test(parts[i])) return ''; i++; j = 0; if (i >= parts.length) return ''; continue; }
        j = 0;
      }
    };
    const ahead = (i, j) => { let s = ''; for (let k = 0; k < 12; k++) { const c = next(i, j + k); if (!c) break; s += c; } return s; };
    let before = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2) { if (BLOCK.test(parts[i])) before = ''; continue; }
      const t = parts[i];
      if (t.indexOf('"') < 0 && t.indexOf("'") < 0) { before = (before + t).slice(-12); continue; }
      let out = '';
      for (let j = 0; j < t.length; j++) {
        const c = t[j];
        if (c !== '"' && c !== "'") { out += c; before = (before + c).slice(-12); continue; }
        const p = before.slice(-1), n = next(i, j + 1);
        let q;
        if (c === '"') {
          if (/\d'\d{1,2}$/.test(before)) q = '"'; // 5'10": feet and inches stay straight
          else if (SPACE(p) || OPEN.test(p)) q = SPACE(n) && SPACE(p) ? '”' : '“';
          else if (DASH.test(p)) q = SPACE(n) || /[.,;:!?)\]]/.test(n) ? '”' : '“';
          else q = '”';
        } else if (/\d/.test(p) && (/\d/.test(n) || (/(?:^|\s)\d+$/.test(before) && (SPACE(n) || n === '"')))) {
          q = "'"; // 5'10, 6' tall
        } else if (WORD.test(p)) q = '’';
        else if ((SPACE(p) || OPEN.test(p) || DASH.test(p)) && WORD.test(n)) {
          const rest = ahead(i, j + 1);
          q = /^\d\d(?:s\b|\b)/.test(rest) || ELIDE.test(rest) ? '’' : '‘';
        } else q = '’';
        out += q;
        before = (before + q).slice(-12);
      }
      parts[i] = out;
    }
    return parts.join('');
  }

  // ------------------------------------------------------------------ the stylesheet
  // Checked against Amazon's Kindle Publishing Guidelines 2026.3 (read 2026-11-14): body text keeps the reader's own
  // font, size, colour and justification; headings say their alignment (11.3.1); side margins and padding are percents
  // (11.3.5); page breaks are page-break-before (11.3.7). Borders take the text colour, so a screen's box shows in
  // dark mode too. A long screen may split across pages, so no half-empty page is left before it.
  const CSS = [
    'p{margin:0;text-indent:1.5em;}',
    'p.first,p.noindent{text-indent:0;}',
    'p.break{text-align:center;text-indent:0;margin:1em 0;}',
    'h1.chapter{text-align:center;font-weight:normal;margin:2em 0 1.5em;page-break-before:always;}',
    'h1.chapter .num{display:block;font-size:0.75em;letter-spacing:0.12em;text-transform:uppercase;}',
    'h1.chapter .ctitle{display:block;font-size:1.3em;margin-top:0.4em;}',
    'div.screen{margin:1em 2%;padding:0.5em 4%;border:1px solid;page-break-inside:avoid;}',
    'div.screen.long{page-break-inside:auto;}',
    'div.screen p{text-indent:0;text-align:left;}',
    'div.screen p.t{font-weight:bold;font-variant:small-caps;letter-spacing:0.04em;}',
    'div.screen p.sp{margin-top:0.8em;}',
    'section.titlepage{text-align:center;margin-top:25%;}',
    'section.titlepage h1{text-align:center;font-weight:normal;font-size:1.8em;margin:0 0 0.6em;}',
    'section.titlepage p{text-align:center;text-indent:0;}',
    'section.titlepage p.subtitle{font-style:italic;margin-bottom:1.2em;}',
    'section.titlepage p.series{font-size:0.9em;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:2.5em;}',
    'section.titlepage p.author{font-size:1.2em;}',
    'section.titlepage p.publisher{font-size:0.85em;margin-top:4em;}',
    'section.matter h2{text-align:center;font-weight:normal;margin:2em 0 1em;}',
    'section.matter p{margin-bottom:0.6em;}',
    'section.matter p.series{text-align:center;font-style:italic;margin-top:1.2em;}',
    'section.copyright{font-size:0.85em;margin-top:2em;}',
    'section.copyright p{margin-bottom:0.5em;}',
    'section.dedication,section.epigraph{text-align:center;margin-top:30%;}',
    'section.dedication p,section.epigraph p{text-align:center;}',
    'nav h2{text-align:center;font-weight:normal;}',
    'nav ol{list-style-type:none;padding-left:0;}',
    'nav li{margin:0.3em 0;}'
  ].join('\n') + '\n';

  // A screen longer than this many lines may split across pages.
  const LONG_SCREEN = 8;

  // ------------------------------------------------------------------ the title page
  const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const numberWord = (n) => {
    if (n !== Math.floor(n) || n < 0 || n > 99) return String(n);
    if (n < 20) return WORDS[n];
    return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + WORDS[n % 10] : '');
  };

  // The subtitle: `subtitle` on Book.md, or what follows "<title>:" in `long_title`.
  function subtitleOf(title, data) {
    const s = String((data && data.subtitle) || '').trim();
    if (s) return s;
    const long = String((data && data.long_title) || '').trim();
    const pre = String(title || '').trim() + ':';
    return long.toLowerCase().indexOf(pre.toLowerCase()) === 0 ? long.slice(pre.length).trim() : '';
  }

  // info: { title, subtitle, series, number, author, publisher }
  function titlePage(info) {
    const line = (cls, t) => (t ? '<p class="' + cls + '">' + x(t) + '</p>' : '');
    const series = info.series ? info.series + (info.number != null ? ', Book ' + numberWord(info.number) : '') : '';
    return '<section class="titlepage" epub:type="titlepage"><h1>' + x(info.title) + '</h1>' + line('subtitle', info.subtitle) +
      line('series', series) + line('author', info.author) + line('publisher', info.publisher) + '</section>';
  }

  // ------------------------------------------------------------------ the book look (Build 2)
  // One look per series (Kyle, 2026-11-14, Kindle plan Build 2), kept in the series' `Book Look.md`: the chapter
  // heading, the first paragraph of a chapter and after a scene break, and the scene break. Fewer choices than Vellum, on
  // purpose; each is a few lines of CSS a Kindle is documented to show (Kindle Publishing Guidelines 2026.3: drop caps
  // 11.3.6, small caps and borders in the supported CSS table). The defaults are the look the file had before.
  const LOOK_OPTIONS = {
    chapter_number: [['numeral', 'Chapter 3'], ['word', 'Chapter Three'], ['roman', 'Chapter III'], ['bare', '3'], ['none', 'No number']],
    heading_align: [['center', 'Centred'], ['left', 'Left']],
    heading_style: [['classic', 'Classic'], ['caps', 'Spaced capitals'], ['rule', 'With a line'], ['bold', 'Bold title']],
    first_paragraph: [['plain', 'Plain'], ['dropcap', 'Drop cap'], ['smallcaps', 'First words in small caps']],
    after_break: [['plain', 'Plain'], ['dropcap', 'Drop cap'], ['smallcaps', 'First words in small caps']],
    scene_break: [['stars', '* * *'], ['dots', '\u00b7 \u00b7 \u00b7'], ['line', 'A short line'], ['space', 'A blank space']]
  };
  const LOOK_DEFAULT = { chapter_number: 'numeral', heading_align: 'center', heading_style: 'classic', first_paragraph: 'plain', after_break: 'plain', scene_break: 'stars' };

  // A Book Look note's properties as a whole look: anything missing or unknown is the default.
  function lookOf(data) {
    const out = {};
    Object.keys(LOOK_DEFAULT).forEach((k) => {
      const v = String((data && data[k]) || '').trim();
      out[k] = LOOK_OPTIONS[k].some((o) => o[0] === v) ? v : LOOK_DEFAULT[k];
    });
    return out;
  }

  function roman(n) {
    let r = '';
    [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
      .forEach(([v, s]) => { while (n >= v) { r += s; n -= v; } });
    return r;
  }

  // "Chapter 3" as the look says it; '' for no number. A number that is not a whole number stays as written.
  function chapterLabel(num, look) {
    const n = /^\d+$/.test(String(num)) ? +num : null;
    const how = (look || LOOK_DEFAULT).chapter_number;
    if (how === 'none') return '';
    if (how === 'bare') return String(num);
    if (n == null) return 'Chapter ' + num;
    return 'Chapter ' + (how === 'word' ? numberWord(n) : how === 'roman' ? roman(n) : String(n));
  }

  function breakHtml(look) {
    const b = (look || LOOK_DEFAULT).scene_break;
    if (b === 'line') return '<hr class="break"/>';
    if (b === 'space') return '<p class="break space">\u00a0</p>';
    return '<p class="break">' + (b === 'dots' ? '\u00b7 \u00b7 \u00b7' : '* * *') + '</p>';
  }

  // The look's own CSS, after the stylesheet.
  function lookCss(look) {
    const l = look || LOOK_DEFAULT;
    const out = [];
    if (l.heading_align === 'left') out.push('h1.chapter{text-align:left;}');
    if (l.heading_style === 'caps') out.push('h1.chapter .ctitle{text-transform:uppercase;letter-spacing:0.12em;font-size:1.1em;}');
    if (l.heading_style === 'rule') out.push('h1.chapter .ctitle{border-top:1px solid;padding-top:0.5em;' + (l.heading_align === 'left' ? 'margin-right:60%;' : 'margin-left:30%;margin-right:30%;') + '}');
    if (l.heading_style === 'bold') out.push('h1.chapter .ctitle{font-weight:bold;}');
    if (l.first_paragraph === 'dropcap' || l.after_break === 'dropcap') {
      // Amazon's own drop cap (Kindle Publishing Guidelines 2026.3, 11.3.6).
      out.push('span.dropcap{font-weight:normal;font-size:320%;float:left;margin-top:-0.3225em;margin-bottom:-0.3245em;margin-right:0.03em;}');
      out.push('@media amzn-mobi{span.dropcap{font-size:3em;font-weight:bold;float:none;margin:0;}}');
    }
    if (l.first_paragraph === 'smallcaps' || l.after_break === 'smallcaps') out.push('span.lead{font-variant:small-caps;letter-spacing:0.05em;}');
    if (l.scene_break === 'line') out.push('hr.break{border:0;border-top:1px solid;width:25%;margin:1.2em auto;}');
    if (l.scene_break === 'space') out.push('p.break.space{margin:0.6em 0;}');
    return out.length ? out.join('\n') + '\n' : '';
  }

  // The first words of a paragraph dressed as the look says: a drop cap, or the first words in small caps.
  function opening(p, how) {
    const m = /^(<p class="first">)([^<]*)/.exec(p);
    if (!m || how === 'plain' || !m[2]) return p;
    const t = m[2], rest = p.slice(m[0].length);
    if (how === 'dropcap') {
      const d = /^(["'\u201c\u2018(]*[\p{L}\p{N}])/u.exec(t);
      return d ? m[1] + '<span class="dropcap">' + d[1] + '</span>' + t.slice(d[1].length) + rest : p;
    }
    const w = /^(\S+(?:\s+\S+){0,3})/.exec(t);
    return w ? m[1] + '<span class="lead">' + w[1] + '</span>' + t.slice(w[1].length) + rest : p;
  }

  // A chapter's page dressed in the look: its number, its first paragraphs, its scene breaks. Both builders make the
  // page in the plain look first; this is the one place the look changes it.
  function dress(html, look) {
    const l = look || LOOK_DEFAULT;
    let out = html.replace(/<span class="num">Chapter ([^<]+)<\/span> ?/, (m, n) => {
      const label = chapterLabel(n, l);
      return label ? '<span class="num">' + label + '</span> ' : '';
    });
    out = out.split('<p class="break">* * *</p>').join(breakHtml(l));
    let k = 0;
    out = out.replace(/<p class="first">[^<]*/g, (p) => opening(p, k++ === 0 ? l.first_paragraph : l.after_break));
    return out;
  }

  // ------------------------------------------------------------------ front and back pages
  const key = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const ALSO = /^also by\b/i;

  // Every heading of a Book Matter note with its words, empty ones too: { place, title, body }.
  function matterSections(body) {
    const out = [];
    let cur = null;
    String(body || '').replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
      const h = /^##\s+(front|back)\s*:\s*(.+?)\s*$/i.exec(line);
      if (h) { cur = { place: h[1].toLowerCase(), title: h[2], body: '' }; out.push(cur); return; }
      if (cur) cur.body += line + '\n';
    });
    out.forEach((p) => { p.body = p.body.trim(); });
    return out;
  }

  // The book's pages with the series' pages filling in any the book does not have (About the author, Also by, a
  // newsletter page written once for the series). A book page with no words takes the series page of the same name.
  function mergeMatter(bookSections, seriesSections) {
    const series = seriesSections || [];
    const out = [];
    const used = {};
    bookSections.forEach((p) => {
      const s = series.find((q) => q.place === p.place && key(q.title) === key(p.title));
      if (s) used[key(s.title) + '|' + s.place] = true;
      out.push(p.body || !s ? p : s);
    });
    ['front', 'back'].forEach((place) => {
      const extra = series.filter((q) => q.place === place && !used[key(q.title) + '|' + place]);
      const lastAt = out.map((p) => p.place).lastIndexOf(place);
      const at = lastAt >= 0 ? lastAt + 1 : place === 'front' ? 0 : out.length;
      out.splice(at, 0, ...extra);
    });
    return out;
  }

  // An "Also by" page: the series' other books with a store link, in order, then the page's own words (other series),
  // leaving out any line that names or links this book. books: [{ title, number, url }]; current: { title, url }.
  function alsoBy(page, seriesName, books, current) {
    const others = books.filter((b) => b.url && key(b.title) !== key(current.title)).sort((a, b) => (a.number || 0) - (b.number || 0));
    const list = others.map((b) => '[' + b.title + '](' + b.url + ')').join('\n\n');
    const own = String(page.body || '').split(/\n\s*\n/).filter((para) => {
      if (current.url && para.indexOf(current.url) >= 0) return false;
      const labels = []; para.replace(/\[([^\]]+)\]\(/g, (m, l) => { labels.push(key(l)); return m; });
      return labels.indexOf(key(current.title)) < 0;
    }).join('\n\n').trim();
    const body = (list ? '*' + seriesName + '*\n\n' + list : '') + (list && own ? '\n\n' : '') + own;
    return { place: page.place, title: page.title, body };
  }

  // The pages to print: series pages merged in, Also by filled from the series, empty pages left out.
  function bookMatter(bookBody, seriesBody, seriesName, books, current) {
    return mergeMatter(matterSections(bookBody), matterSections(seriesBody))
      .map((p) => (ALSO.test(p.title) ? alsoBy(p, seriesName, books || [], current || {}) : p))
      .filter((p) => p.body);
  }

  // ------------------------------------------------------------------ the cover
  // A JPEG's or PNG's size in pixels, or null.
  function imageSize(b) {
    if (!b || b.length < 24) return null;
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      return { width: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, height: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 };
    }
    if (b[0] !== 0xff || b[1] !== 0xd8) return null;
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: (b[i + 7] << 8) | b[i + 8], height: (b[i + 5] << 8) | b[i + 6] };
      i += 2 + len;
    }
    return null;
  }

  // Plain sentences about the cover: [] when it is right. Amazon asks for 2,560 by 1,600 pixels, at least 2,500 tall for
  // high-definition screens, 5 MB or less (Kindle Publishing Guidelines 2026.3, 4.1).
  function coverProblems(bytes) {
    if (!bytes) return ['There is no cover in the file. Add the full-size front cover on Book details.'];
    const out = [];
    const s = imageSize(bytes);
    if (!s) return ['The cover picture could not be read. Use a JPG or PNG.'];
    const n = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (s.height < 2500 || s.width < 1560) out.push('The cover is ' + n(s.width) + ' wide by ' + n(s.height) + ' tall. Amazon asks for 1,600 wide by 2,560 tall, so it will look soft on big screens.');
    const ratio = s.height / s.width;
    if (ratio < 1.4 || ratio > 1.8) out.push('The cover is not the usual shape: Amazon\'s is 1.6 times as tall as it is wide, and this one is ' + ratio.toFixed(2) + '.');
    if (bytes.length > 5 * 1024 * 1024) out.push('The cover is ' + (bytes.length / 1048576).toFixed(1) + ' MB. Amazon asks for 5 MB or less; save it as a JPG.');
    return out;
  }

  // ------------------------------------------------------------------ the ready check
  const textOf = (html) => String(html).replace(/<p class="break">[\s\S]*?<\/p>/g, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const around = (t, at) => '"' + t.slice(Math.max(0, at - 25), at + 25).trim() + '"';

  // Everything that would embarrass the book, as plain sentences, and what is right. pages: [{ label, html, kind:
  // 'chapter' | 'matter' }] as they go in the file (after the typography); matter: the Book Matter sections, empty ones
  // too; cover: its bytes or null; author.
  function check(input) {
    const problems = [], good = [];
    const chapters = input.pages.filter((p) => p.kind === 'chapter');
    const say = (list, max, one) => { list.slice(0, max).forEach((s) => problems.push(s)); if (list.length > max) problems.push(one(list.length - max)); };
    const notes = [], marks = [], quotes = [], titles = [], short = [], links = [];
    input.pages.forEach((p) => {
      const t = textOf(p.html);
      let m;
      const braces = /[{}]/g;
      if ((m = braces.exec(t))) notes.push(p.label + ' still has a { } note: ' + around(t, m.index) + '.');
      const stray = /\*|==|\[\[|\]\]|(?:^|\s)_|_(?:\s|$)|(?:^|\s)>\s/g;
      if ((m = stray.exec(t))) marks.push(p.label + ' has a stray writing mark: ' + around(t, m.index) + '.');
      const straight = /["']/g;
      if ((m = straight.exec(t)) && !/\d['"]/.test(t.slice(m.index - 1, m.index + 1))) quotes.push(p.label + ' has a straight quote mark: ' + around(t, m.index) + '.');
      const hrefs = /<a href="([^"]*)"/g;
      while ((m = hrefs.exec(p.html))) if (!/^(?:https?:\/\/[^\s/]+\.[^\s]+|mailto:\S+@\S+)$/i.test(m[1])) links.push(p.label + ' has a link that goes nowhere: ' + m[1] + '.');
      const fill = /\[(?:ISBN|link|url|tk|todo|placeholder)\]|\bTK\b|\bTODO\b|\bXXX\b/i;
      if ((m = fill.exec(t))) links.push(p.label + ' still has a blank to fill in: ' + around(t, m.index) + '.');
      if (p.kind === 'chapter') {
        if (!/^Chapter\s+\S+\s*:\s*\S/.test(p.label)) titles.push(p.label);
        const words = t.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
        if (words < 100) short.push(p.label + ' has only ' + words + (words === 1 ? ' word.' : ' words.'));
      }
    });
    say(notes, 5, (n) => 'And ' + n + ' more { } notes.');
    say(marks, 5, (n) => 'And ' + n + ' more pages with stray marks.');
    say(quotes, 5, (n) => 'And ' + n + ' more straight quote marks.');
    if (titles.length) problems.push((titles.length === 1 ? titles[0] + ' has' : titles.slice(0, 5).join(', ') + (titles.length > 5 ? ' and ' + (titles.length - 5) + ' more' : '') + ' have') + ' no chapter title.');
    say(short, 5, (n) => 'And ' + n + ' more short chapters.');
    say(links, 5, (n) => 'And ' + n + ' more links or blanks.');
    coverProblems(input.cover).forEach((s) => problems.push(s));
    const matter = input.matter || [];
    if (!matter.some((p) => /^copyright$/i.test(p.title) && p.body)) problems.push('There is no copyright page. Add one under Front and back matter.');
    matter.filter((p) => !p.body && !ALSO.test(p.title)).forEach((p) => problems.push('The page "' + p.title + '" has no words, so it is left out.'));
    if (!input.author) problems.push('The book has no author. Add the author on Book details.');
    if (!notes.length && !marks.length) good.push('No { } notes or stray marks.');
    if (!quotes.length) good.push('Every quote mark is curly.');
    if (!titles.length && !short.length) good.push('All ' + chapters.length + ' chapters have a title and words.');
    if (input.cover && !coverProblems(input.cover).length) good.push('The cover is the right size.');
    if (matter.some((p) => /^copyright$/i.test(p.title) && p.body)) good.push('The copyright page is in.');
    if (!links.length) good.push('Every link has an address.');
    return { problems, good };
  }

  return { smart, CSS, LONG_SCREEN, numberWord, LOOK_OPTIONS, LOOK_DEFAULT, lookOf, chapterLabel, breakHtml, lookCss, dress, subtitleOf, titlePage, matterSections, mergeMatter, alsoBy, bookMatter, imageSize, coverProblems, check };
})();
