// @ts-nocheck
/* The frontmatter parser, copied as is from author-business System/Tools/sf.js (the FRONTMATTER section), so the app
 * and the sf tool read notes the same way. Do not edit it here: change sf.js, then copy the block again with
 * `npm run sync-parser`. tests/frontmatter.test.ts checks the copy still matches when the vault is checked out beside
 * this repository. */
export const Frontmatter = (() => {
  'use strict';

  function fail(msg, line) {
    const e = new Error(msg + (line != null ? ' (frontmatter line ' + (line + 1) + ')' : ''));
    e.yamlLine = line;
    return e;
  }
  function spaces(n) { return n > 0 ? ' '.repeat(n) : ''; }
  function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  // ---------------------------------------------------------------- scalars
  function resolvePlain(s) {
    if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
    if (s === 'true' || s === 'True' || s === 'TRUE') return true;
    if (s === 'false' || s === 'False' || s === 'FALSE') return false;
    if (/^[-+]?(0|[1-9]\d*)$/.test(s)) {
      const n = parseInt(s, 10);
      return Math.abs(n) <= 9007199254740991 ? n : s;
    }
    if (/^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) || /^[-+]?\d+[eE][-+]?\d+$/.test(s)) return parseFloat(s);
    return s;
  }

  function stripComment(s) {
    if (/^\s*#/.test(s)) return '';
    const m = s.match(/[ \t]#/);
    return (m ? s.slice(0, m.index) : s).replace(/\s+$/, '');
  }

  // "!!str 012" -> "012", "&a value" -> "value" (aliases are not supported and stay literal)
  function stripTagAnchor(s) { return s.replace(/^(?:!!?[A-Za-z0-9_:\-]*\s+|&[^\s]+\s+)+/, ''); }

  function readQuoted(s, pos) {
    const q = s[pos];
    let i = pos + 1, out = '';
    if (q === "'") {
      while (i < s.length) {
        const c = s[i];
        if (c === "'") {
          if (s[i + 1] === "'") { out += "'"; i += 2; continue; }
          return { value: out, end: i + 1 };
        }
        out += c; i++;
      }
      throw fail('Unterminated single-quoted string');
    }
    while (i < s.length) {
      const ch = s[i];
      if (ch === '\\') {
        const n = s[i + 1];
        i += 2;
        switch (n) {
          case 'n': out += '\n'; break;
          case 't': out += '\t'; break;
          case 'r': out += '\r'; break;
          case '"': out += '"'; break;
          case '\\': out += '\\'; break;
          case '/': out += '/'; break;
          case '0': out += '\0'; break;
          case 'b': out += '\b'; break;
          case 'f': out += '\f'; break;
          case ' ': out += ' '; break;
          case 'N': out += '\u0085'; break;
          case '_': out += ' '; break;
          case 'x': out += String.fromCharCode(parseInt(s.substr(i, 2), 16)); i += 2; break;
          case 'u': out += String.fromCharCode(parseInt(s.substr(i, 4), 16)); i += 4; break;
          case 'U': out += String.fromCodePoint(parseInt(s.substr(i, 8), 16)); i += 8; break;
          default: out += (n === undefined ? '' : n);
        }
        continue;
      }
      if (ch === '"') return { value: out, end: i + 1 };
      out += ch; i++;
    }
    throw fail('Unterminated double-quoted string');
  }

  // ---------------------------------------------------------------- flow collections
  function FlowParser(s, line) { this.s = s; this.pos = 0; this.line = line; }
  FlowParser.prototype.ws = function () {
    while (this.pos < this.s.length && /\s/.test(this.s[this.pos])) this.pos++;
  };
  FlowParser.prototype.node = function (ctx) {
    this.ws();
    const c = this.s[this.pos];
    if (c === '[') {
      const wl = /^\[\[[^\[\]\n]+\]\]/.exec(this.s.slice(this.pos));
      if (wl) { this.pos += wl[0].length; return wl[0]; }
      return this.seq();
    }
    if (c === '{') return this.map();
    if (c === '"' || c === "'") {
      const q = readQuoted(this.s, this.pos);
      this.pos = q.end;
      return q.value;
    }
    return this.plain(ctx);
  };
  FlowParser.prototype.seq = function () {
    this.pos++;
    const arr = [];
    for (;;) {
      this.ws();
      if (this.pos >= this.s.length) throw fail('Unclosed [ in flow sequence', this.line);
      if (this.s[this.pos] === ']') { this.pos++; return arr; }
      arr.push(this.node('seq'));
      this.ws();
      if (this.s[this.pos] === ',') { this.pos++; continue; }
      if (this.s[this.pos] === ']') { this.pos++; return arr; }
      throw fail('Expected "," or "]" in flow sequence', this.line);
    }
  };
  FlowParser.prototype.map = function () {
    this.pos++;
    const obj = {};
    for (;;) {
      this.ws();
      if (this.pos >= this.s.length) throw fail('Unclosed { in flow mapping', this.line);
      if (this.s[this.pos] === '}') { this.pos++; return obj; }
      const key = this.node('key');
      this.ws();
      let val = null;
      if (this.s[this.pos] === ':') {
        this.pos++;
        this.ws();
        if (this.s[this.pos] !== ',' && this.s[this.pos] !== '}') val = this.node('val');
      }
      obj[String(key)] = val;
      this.ws();
      if (this.s[this.pos] === ',') { this.pos++; continue; }
      if (this.s[this.pos] === '}') { this.pos++; return obj; }
      throw fail('Expected "," or "}" in flow mapping', this.line);
    }
  };
  FlowParser.prototype.plain = function (ctx) {
    const s = this.s, start = this.pos;
    while (this.pos < s.length) {
      const c = s[this.pos];
      if (c === ',' || c === ']' || c === '}') break;
      if (c === ':' && ctx === 'key') break;
      if (c === '#' && this.pos > start && /\s/.test(s[this.pos - 1])) { this.pos = s.length; break; }
      this.pos++;
    }
    return resolvePlain(stripTagAnchor(s.slice(start, this.pos).trim()));
  };

  function flowDepth(s) {
    let depth = 0, q = null, prev = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (q === '"' && c === '\\') { i++; continue; }
        if (c === q) {
          if (q === "'" && s[i + 1] === "'") { i++; continue; }
          q = null;
          prev = c;
        }
        continue;
      }
      if (/\s/.test(c)) continue;
      // a quote only opens a scalar at the start of one; "Ines's" is a plain apostrophe
      if ((c === '"' || c === "'") && (prev === '' || prev === '[' || prev === '{' || prev === ',' || prev === ':')) { q = c; continue; }
      prev = c;
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
      else if (c === '#' && i > 0 && /\s/.test(s[i - 1])) break;
    }
    return depth;
  }

  const LINK_LIST = /^\s*(\[\[[^\[\]\n]+\]\]\s*,\s*)+\[\[[^\[\]\n]+\]\]\s*$/;

  // ---------------------------------------------------------------- block parser
  function Parser(text) {
    this.lines = String(text).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^\t+/, (t) => spaces(t.length * 2)));
    this.i = 0;
  }
  Parser.prototype.peek = function () {
    while (this.i < this.lines.length && /^\s*(#.*)?$/.test(this.lines[this.i])) this.i++;
    if (this.i >= this.lines.length) return null;
    const line = this.lines[this.i];
    const ind = line.match(/^ */)[0].length;
    return { indent: ind, text: line.slice(ind), index: this.i };
  };

  function isSeqItem(text) { return text === '-' || /^-[ \t]/.test(text); }

  function findMapColon(text) {
    let q = null, depth = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === q) q = null; continue; }
      if (i === 0 && (c === '"' || c === "'")) { q = c; continue; }
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
      else if (c === '#' && i > 0 && /\s/.test(text[i - 1])) return -1;
      else if (c === ':' && depth <= 0 && (i + 1 === text.length || text[i + 1] === ' ' || text[i + 1] === '\t')) return i;
    }
    return -1;
  }

  function splitKey(text) {
    if (text[0] === '"' || text[0] === "'") {
      let q;
      try { q = readQuoted(text, 0); } catch (e) { return null; }
      const after = text.slice(q.end);
      const m = after.match(/^[ \t]*:(?=[ \t]|$)/);
      if (!m) return null;
      return { key: q.value, rest: after.slice(m[0].length).replace(/^[ \t]+/, '') };
    }
    if (text[0] === '[' || text[0] === '{') return null;
    const idx = findMapColon(text);
    if (idx <= 0) return null;
    const key = text.slice(0, idx).trim();
    if (!key || key[0] === '#') return null;
    return { key, rest: text.slice(idx + 1).replace(/^[ \t]+/, '') };
  }

  Parser.prototype.parseNode = function (indent) {
    const t = this.peek();
    if (!t) return null;
    if (isSeqItem(t.text)) return this.parseSeq(t.indent);
    if (splitKey(t.text)) return this.parseMap(t.indent);
    this.i++;
    return this.parseValue(t.text, indent - 1, t.index);
  };

  Parser.prototype.parseMap = function (indent) {
    const obj = {};
    for (;;) {
      const t = this.peek();
      if (!t || t.indent < indent) break;
      if (t.indent > indent) throw fail('Unexpected indentation', t.index);
      if (isSeqItem(t.text)) break;
      const kv = splitKey(t.text);
      if (!kv) throw fail('Expected "key: value" but found "' + t.text.slice(0, 40) + '"', t.index);
      this.i++;
      obj[kv.key] = this.parseValue(kv.rest, indent, t.index);
    }
    return obj;
  };

  Parser.prototype.parseSeq = function (indent) {
    const arr = [];
    for (;;) {
      const t = this.peek();
      if (!t || t.indent < indent) break;
      if (t.indent > indent) throw fail('Unexpected indentation in list', t.index);
      if (!isSeqItem(t.text)) break;
      const after = t.text.replace(/^-[ \t]*/, '');
      const itemIndent = indent + (t.text.length - after.length);
      this.i++;
      if (after === '' || after[0] === '#') {
        const n = this.peek();
        if (n && n.indent > indent) arr.push(this.parseNode(n.indent));
        else arr.push(null);
        continue;
      }
      if (isSeqItem(after) || (after[0] !== '[' && after[0] !== '{' && splitKey(after))) {
        // a nested list or mapping that starts on the dash line: re-read it at its own column
        this.i--;
        this.lines[this.i] = spaces(itemIndent) + after;
        arr.push(isSeqItem(after) ? this.parseSeq(itemIndent) : this.parseMap(itemIndent));
        continue;
      }
      arr.push(this.parseValue(after, indent, t.index));
    }
    return arr;
  };

  Parser.prototype.parseValue = function (rest, indent, lineIdx) {
    const r = rest.replace(/^[ \t]+/, '');
    const bare = stripComment(r);
    if (bare === '') {
      const t = this.peek();
      if (t && t.indent > indent) return this.parseNode(t.indent);
      if (t && t.indent === indent && isSeqItem(t.text)) return this.parseSeq(indent);
      return null;
    }
    if ((bare[0] === '|' || bare[0] === '>') && /^[|>](?:[+-]?\d?|\d?[+-]?)$/.test(bare)) return this.parseBlockScalar(bare, indent);
    if (bare[0] === '[' || bare[0] === '{') {
      if (LINK_LIST.test(bare)) return bare.match(/\[\[[^\[\]\n]+\]\]/g);
      let buf = r;
      while (flowDepth(buf) > 0 && this.i < this.lines.length) {
        buf += ' ' + this.lines[this.i].trim();
        this.i++;
      }
      const fp = new FlowParser(buf, lineIdx);
      const v = fp.node('top');
      fp.ws();
      const tail = buf.slice(fp.pos).trim();
      if (tail && tail[0] !== '#') {
        if (LINK_LIST.test(stripComment(buf))) return stripComment(buf).match(/\[\[[^\[\]\n]+\]\]/g);
        // not valid flow YAML: keep the raw text as a string rather than lose data
        return stripComment(r).trim();
      }
      return v;
    }
    if (r[0] === '"' || r[0] === "'") return this.parseQuoted(r, indent);
    // plain scalar with optional continuation lines
    let s = stripTagAnchor(bare.trim());
    while (this.i < this.lines.length) {
      const line = this.lines[this.i];
      if (/^\s*$/.test(line)) break;
      const ind = line.match(/^ */)[0].length;
      if (ind <= indent || /^\s*#/.test(line)) break;
      s += ' ' + stripComment(line.trim());
      this.i++;
    }
    return resolvePlain(s);
  };

  Parser.prototype.parseQuoted = function (r) {
    let buf = r;
    for (;;) {
      try {
        const q = readQuoted(buf, 0);
        const after = buf.slice(q.end).trim();
        if (after && after[0] !== '#') return resolvePlain(stripComment(r).trim());
        return q.value;
      } catch (e) {
        if (this.i >= this.lines.length) throw e;
        const next = this.lines[this.i++];
        buf += (next.trim() === '' ? '\n' : ' ' + next.trim());
      }
    }
  };

  Parser.prototype.parseBlockScalar = function (header, indent) {
    const style = header[0];
    const chomp = (header.match(/[+-]/) || [''])[0];
    const explicit = parseInt((header.match(/\d/) || ['0'])[0], 10);
    let contentIndent = explicit ? indent + explicit : null;
    const lines = [];
    while (this.i < this.lines.length) {
      const line = this.lines[this.i];
      if (/^\s*$/.test(line)) { lines.push(''); this.i++; continue; }
      const ind = line.match(/^ */)[0].length;
      if (contentIndent === null) {
        if (ind <= indent) break;
        contentIndent = ind;
      }
      if (ind < contentIndent) break;
      lines.push(line.slice(contentIndent));
      this.i++;
    }
    let trailing = 0;
    while (lines.length && lines[lines.length - 1] === '') { lines.pop(); trailing++; }
    let text;
    if (style === '|') {
      text = lines.join('\n');
    } else {
      const out = [];
      for (let j = 0; j < lines.length; j++) {
        const l = lines[j];
        if (l === '') { out.push('\n'); continue; }
        const prev = out.length ? out[out.length - 1] : null;
        if (prev !== null && prev !== '\n') out.push(/^\s/.test(l) ? '\n' : ' ');
        out.push(l);
      }
      text = out.join('');
    }
    if (!lines.length) return '';
    if (chomp === '-') return text;
    if (chomp === '+') return text + '\n' + '\n'.repeat(trailing);
    return text + '\n';
  };

  function parseYaml(text) {
    if (text == null) return {};
    const p = new Parser(text);
    const t = p.peek();
    if (!t) return {};
    const v = p.parseNode(t.indent);
    const rest = p.peek();
    if (rest) throw fail('Could not read past "' + rest.text.slice(0, 40) + '"', rest.index);
    return v;
  }

  function safeParse(text) {
    try {
      const data = parseYaml(text);
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return { data: {}, error: data === null ? null : 'Frontmatter is not a list of "key: value" properties' };
      }
      return { data, error: null };
    } catch (e) {
      return { data: {}, error: e.message };
    }
  }

  // ---------------------------------------------------------------- writer
  const RESERVED = /^(~|null|Null|NULL|true|True|TRUE|false|False|FALSE|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF|y|Y|n|N)$/;

  function needsQuote(s) {
    if (s === '') return true;
    if (/^\s|\s$/.test(s)) return true;
    if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(s)) return true;
    if (/: |:$| #|\t/.test(s)) return true;
    if (/[\u0000-\u001f\u007f]/.test(s)) return true;
    if (RESERVED.test(s)) return true;
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return true;
    if (/^[-+]?0[xob]/i.test(s)) return true;
    if (/^\d+(:\d+)+$/.test(s)) return true;
    return false;
  }

  function emitScalar(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return isFinite(v) ? String(v) : JSON.stringify(String(v));
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
    const s = String(v);
    return needsQuote(s) ? JSON.stringify(s) : s;
  }

  // Keys always read back as strings, so reserved words like "n" or "yes" need no quotes.
  function emitKey(k) {
    const s = String(k);
    const bad = s === '' || /^\s|\s$/.test(s) || /^[-?:,\[\]{}#&*!|>'"%@`]/.test(s) || /[:#\u0000-\u001f\u007f]/.test(s) ||
      /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s);
    return bad ? JSON.stringify(s) : s;
  }

  function blockScalar(s, ind) {
    const trailing = (s.match(/\n*$/) || [''])[0].length;
    const body = s.replace(/\n+$/, '');
    if (/^[ \t]/.test(body)) return JSON.stringify(s) + '\n';
    const header = trailing === 0 ? '|-' : (trailing === 1 ? '|' : '|+');
    let out = header + '\n';
    body.split('\n').forEach((l) => { out += (l === '' ? '' : spaces(ind) + l) + '\n'; });
    if (trailing > 1) out += '\n'.repeat(trailing - 1);
    return out;
  }

  function emitAfterKey(v, ind) {
    if (v === null || v === undefined) return '\n';
    if (Array.isArray(v)) return v.length ? '\n' + emitSeq(v, ind + 2) : ' []\n';
    if (isPlainObject(v)) return Object.keys(v).length ? '\n' + emitMap(v, ind + 2) : ' {}\n';
    if (typeof v === 'string' && v.indexOf('\n') >= 0) return ' ' + blockScalar(v, ind + 2);
    return ' ' + emitScalar(v) + '\n';
  }

  function emitMap(obj, ind) {
    let out = '';
    Object.keys(obj).forEach((k) => {
      if (obj[k] === undefined) return;
      out += spaces(ind) + emitKey(k) + ':' + emitAfterKey(obj[k], ind);
    });
    return out;
  }

  function emitSeq(arr, ind) {
    let out = '';
    arr.forEach((item) => {
      if (isPlainObject(item) && Object.keys(item).length) out += spaces(ind) + '- ' + emitMap(item, ind + 2).slice(ind + 2);
      else if (Array.isArray(item) && item.length) out += spaces(ind) + '- ' + emitSeq(item, ind + 2).slice(ind + 2);
      else if (Array.isArray(item)) out += spaces(ind) + '- []\n';
      else if (isPlainObject(item)) out += spaces(ind) + '- {}\n';
      else if (typeof item === 'string' && item.indexOf('\n') >= 0) out += spaces(ind) + '- ' + blockScalar(item, ind + 2);
      else if (item === null || item === undefined) out += spaces(ind) + '-\n';
      else out += spaces(ind) + '- ' + emitScalar(item) + '\n';
    });
    return out;
  }

  function stringify(obj) {
    if (obj === null || obj === undefined) return '';
    if (Array.isArray(obj)) return emitSeq(obj, 0);
    if (typeof obj !== 'object') return emitScalar(obj) + '\n';
    return emitMap(obj, 0);
  }

  // ---------------------------------------------------------------- notes
  const OPEN = /^﻿?---[ \t]*\r?\n/;

  // text === open + yaml + close + body, byte for byte.
  function split(text) {
    text = String(text == null ? '' : text);
    const m = text.match(OPEN);
    if (!m) return { yaml: null, body: text, hasFm: false, open: '', close: '' };
    const rest = text.slice(m[0].length);
    const empty = rest.match(/^---[ \t]*(\r?\n|$)/);
    if (empty) return { yaml: '', body: rest.slice(empty[0].length), hasFm: true, open: m[0], close: empty[0] };
    const close = rest.match(/\r?\n(?:---|\.\.\.)[ \t]*(\r?\n|$)/);
    if (!close) return { yaml: null, body: text, hasFm: false, open: '', close: '' };
    return {
      yaml: rest.slice(0, close.index),
      body: rest.slice(close.index + close[0].length),
      hasFm: true, open: m[0], close: close[0]
    };
  }

  function parse(text) {
    const s = split(text);
    if (!s.hasFm) return { data: {}, body: s.body, error: null, hasFm: false, yaml: null };
    const r = safeParse(s.yaml);
    return { data: r.data, body: s.body, error: r.error, hasFm: true, yaml: s.yaml };
  }

  function join(data, body) {
    body = body == null ? '' : String(body);
    if (!data || !Object.keys(data).length) return body;
    return '---\n' + stringify(data) + '---\n' + body;
  }

  // Apply fn(data) to a note's properties and re-emit them; the body is kept byte for byte.
  // Refuses unreadable frontmatter, so a typo never wipes a note's properties.
  function update(text, fn) {
    const p = parse(text);
    if (p.error) throw new Error('Cannot update properties: ' + p.error);
    let data = p.data || {};
    const res = fn(data);
    if (res && typeof res === 'object' && res !== data) data = res;
    return join(data, p.body);
  }

  // Set one scalar property by editing only its own line (or adding one line), leaving every other line as it was.
  function setScalar(text, key, value) {
    const s = split(text);
    const line = emitKey(key) + ': ' + emitScalar(value);
    if (!s.hasFm) return '---\n' + line + '\n---\n' + s.body;
    const p = safeParse(s.yaml);
    if (p.error) throw new Error('Cannot update properties: ' + p.error);
    const eol = s.yaml.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    if (s.yaml === '') return s.open + line + eol + s.close + s.body;
    const lines = s.yaml.split(/\r?\n/);
    const re = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[ \\t]*:');
    let done = false;
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i])) continue;
      let j = i + 1;
      while (j < lines.length && (/^[ \t]+\S/.test(lines[j]) || /^-([ \t]|$)/.test(lines[j]))) j++;
      lines.splice(i, j - i, line);
      done = true;
      break;
    }
    if (!done) lines.push(line);
    return s.open + lines.join(eol) + s.close + s.body;
  }

  return { parseYaml, safeParse, stringify, needsQuote, emitScalar, split, parse, join, update, setScalar };
})();
