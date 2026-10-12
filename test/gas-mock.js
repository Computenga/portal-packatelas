// Simulación mínima de los servicios de Apps Script para probar Code.gs en Node.
const crypto = require('crypto');
const fs = require('fs');
const vm = require('vm');

const TZ = 'America/Mexico_City';

function fmtDate(d, tz, pattern) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d).map(p => [p.type, p.value]));
  if (parts.hour === '24') parts.hour = '00';
  return pattern.replace('yyyy', parts.year).replace('MM', parts.month).replace('dd', parts.day)
    .replace('HH', parts.hour).replace('mm', parts.minute).replace('ss', parts.second);
}

/** Convierte lo que Sheets convertiría: 'yyyy-mm-dd' → Date (medianoche CDMX). */
function sheetsValue(v, fmt) {
  if (fmt === '@') return v === null || v === undefined ? '' : (v instanceof Date ? v : String(v));
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00-06:00');
  return v === undefined || v === null ? '' : v;
}
function display(v) {
  if (v instanceof Date) return fmtDate(v, TZ, 'yyyy-MM-dd');
  return v === '' || v == null ? '' : String(v);
}

class Sheet {
  constructor(name, rows) { this.name = name; this.data = rows ? rows.map(r => r.slice()) : []; this.fmt = {}; this.validation = null; }
  getName() { return this.name; }
  getLastRow() { let n = this.data.length; while (n > 0 && this.data[n - 1].every(c => c === '' || c == null)) n--; return n; }
  getLastColumn() { return this.data.reduce((m, r) => { let n = r.length; while (n > 0 && (r[n - 1] === '' || r[n - 1] == null)) n--; return Math.max(m, n); }, 0); }
  getMaxRows() { return Math.max(1000, this.data.length); }
  getRange(a, b, c, d) {
    if (typeof a === 'string') {
      const m = a.match(/^([A-Z])(\d+)?(?::([A-Z]))?/);
      const col = m[1].charCodeAt(0) - 64;
      return new Range(this, m[2] ? Number(m[2]) : 1, col, m[2] ? 1 : this.getMaxRows(), 1);
    }
    return new Range(this, a, b, c || 1, d || 1);
  }
  appendRow(vals) { this.data.splice(this.getLastRow(), 0, vals.map((v, i) => sheetsValue(v, this.fmt[i + 1]))); }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  setFrozenRows() {}
  cell(r, c) { return (this.data[r - 1] || [])[c - 1]; }
  set(r, c, v) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = sheetsValue(v, this.fmt[c]); }
}
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = this.sh.cell(this.r + i, this.c + j); row.push(v === undefined || v === null ? '' : v); } out.push(row); } return out; }
  getDisplayValues() { return this.getValues().map(r => r.map(display)); }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x))); return this; }
  setValue(v) { this.sh.set(this.r, this.c, v); return this; }
  setNumberFormat(f) { for (let j = 0; j < this.nc; j++) this.sh.fmt[this.c + j] = f; return this; }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
  getDataValidation() { return this.sh.validation; }
}
class Spreadsheet {
  constructor(sheets) { this.sheets = sheets; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }
}

function makeEnv({ now, maestro, flotilla, gmail }) {
  const props = {};
  const pushes = [], mails = [], files = {};
  let fileSeq = 0;
  const RealDate = Date;
  const NOW = new RealDate(now).getTime();
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(NOW); }
    static now() { return NOW; }
  }
  const folder = (name) => ({
    name, getId: () => 'F-' + name, getFoldersByName: (n) => { let used = false; return { hasNext: () => !used, next: () => { used = true; return folder(n); } }; },
    createFolder: (n) => folder(n),
    createFile: (blob) => { const id = 'file' + (++fileSeq); files[id] = blob; return { getId: () => id, getName: () => blob.name }; },
    getFiles: () => ({ hasNext: () => false }),
  });
  const blob = (data, mime, name) => ({ data, mime, name, getAs() { return blob(data, 'application/pdf', name); }, setName(n) { this.name = n; return this; }, getBytes: () => Buffer.from(String(data)), getDataAsString: () => String(data) });

  const ctx = {
    console: { log: (...a) => process.env.VERBOSE && console.log(...a), warn() {}, error: (...a) => process.env.VERBOSE && console.error(...a) }, Date: FakeDate, Math, JSON, Number, String, Object, Array, RegExp, Error, isNaN, Buffer, Intl,
    SpreadsheetApp: {
      openById: (id) => (id === 'MAESTRO' || id.startsWith('1U6') ? maestro : flotilla),
      flush() {},
      DataValidationCriteria: { VALUE_IN_LIST: 'VALUE_IN_LIST' },
    },
    Utilities: {
      formatDate: (d, tz, p) => fmtDate(d, tz, p),
      getUuid: () => crypto.randomUUID(),
      base64EncodeWebSafe: (s) => Buffer.from(typeof s === 'string' ? s : Buffer.from(s.map(b => b & 0xff))).toString('base64url'),
      base64DecodeWebSafe: (s) => [...Buffer.from(s, 'base64url')],
      base64Encode: (b) => Buffer.from(b).toString('base64'),
      base64Decode: (s) => [...Buffer.from(s, 'base64')],
      computeHmacSha256Signature: (v, k) => [...crypto.createHmac('sha256', k).update(v).digest()].map(b => (b > 127 ? b - 256 : b)),
      computeDigest: (alg, v) => [...crypto.createHash('sha256').update(v).digest()].map(b => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'sha256' },
      newBlob: (d, mime, name) => typeof d === 'object' && Array.isArray(d) ? blob(Buffer.from(d.map(b => b & 0xff)).toString('latin1'), d, mime) : blob(d, mime, name),
      sleep() {},
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => { const c = {}; return { get: k => c[k] || null, put: (k, v) => { c[k] = v; } }; } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    DriveApp: { getRootFolder: () => folder('root'), getFolderById: (id) => folder(id), getFileById: (id) => ({ getBlob: () => files[id] || blob('x') }) },
    GmailApp: { search: () => gmail.map(t => ({ getMessages: () => t.map(m => ({ getId: () => m.id, getSubject: () => m.subject, getPlainBody: () => m.body, getDate: () => new RealDate(m.date) })) })) },
    UrlFetchApp: { fetch: (url, o) => { pushes.push(JSON.parse(o.payload).message); return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
    ScriptApp: { getOAuthToken: () => 'tok', getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => { const b = { timeBased: () => b, everyMinutes: () => b, everyHours: () => b, create: () => b }; return b; } },
    MailApp: { sendEmail: (to, s, b) => mails.push({ to, s, b }) },
    ContentService: { createTextOutput: (t) => ({ setMimeType() { return t; } }), MimeType: { JSON: 'json' } },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Code.gs', 'utf8') + '\n;this.__x = { ACTIONS, _cache };', ctx);
  const call = (action, data = {}, token) => {
    for (const k of Object.keys(ctx.__x._cache)) delete ctx.__x._cache[k]; // cada petición es una ejecución nueva
    const out = ctx.doPost({ postData: { contents: JSON.stringify({ action, token, ...data }) } });
    return JSON.parse(out);
  };
  const run = (fn, ...a) => { for (const k of Object.keys(ctx.__x._cache)) delete ctx.__x._cache[k]; return ctx[fn](...a); };
  return { ctx, call, run, pushes, mails, files, props, Sheet, Spreadsheet };
}

module.exports = { makeEnv, Sheet, Spreadsheet };
