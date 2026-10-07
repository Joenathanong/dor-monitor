/* Mock PrismaClient in-memory untuk uji tampilan di container (engine Prisma diblokir).
 * TIDAK dipakai di produksi. Dipasang ke node_modules/.prisma/client/index.js hanya saat smoke test. */
const enums = {
  Role: { ADMIN: 'ADMIN', PIC: 'PIC', VIEWER: 'VIEWER' },
  FindingSource: { DOR: 'DOR', GEMBA: 'GEMBA' },
  FindingStatus: { OPEN: 'OPEN', IN_PROGRESS: 'IN_PROGRESS', DONE: 'DONE', CLOSED: 'CLOSED', CANCELLED: 'CANCELLED' },
  Priority: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
  ActionType: { ACTION: 'ACTION', COMMENT: 'COMMENT', STATUS: 'STATUS', REASSIGN: 'REASSIGN' },
  GembaStatus: { PLANNED: 'PLANNED', ONGOING: 'ONGOING', COMPLETED: 'COMPLETED' },
};
const { scryptSync, randomBytes } = require('node:crypto');
function hash(pw) { const salt = randomBytes(16); const h = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }); return `scrypt$16384$8$1$${salt.toString('base64')}$${h.toString('base64')}`; }
const d = (daysAgo, h = 9) => { const x = new Date(); x.setDate(x.getDate() - daysAgo); x.setHours(h, 0, 0, 0); return x; };
const addDays = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };

const db = {
  division: [
    { id: 'd1', code: 'INV-IEG', name: 'Inventory IEG', description: null, color: 'c1', isGembaTeam: false, active: true, sortOrder: 0, createdAt: d(30), updatedAt: d(30) },
    { id: 'd2', code: 'INV-EJI', name: 'Inventory EJI', description: null, color: 'c3', isGembaTeam: false, active: true, sortOrder: 1, createdAt: d(30), updatedAt: d(30) },
    { id: 'd3', code: 'FUL', name: 'Fulfilment', description: null, color: 'c2', isGembaTeam: false, active: true, sortOrder: 2, createdAt: d(30), updatedAt: d(30) },
    { id: 'd4', code: 'QAQC', name: 'QA/QC', description: null, color: 'c4', isGembaTeam: true, active: true, sortOrder: 3, createdAt: d(30), updatedAt: d(30) },
    { id: 'd5', code: 'K3', name: 'K3', description: null, color: 'c5', isGembaTeam: false, active: true, sortOrder: 4, createdAt: d(30), updatedAt: d(30) },
  ],
  category: [
    { id: 'c1', code: 'DELIVERY', name: 'Delivery', color: 'c3', active: true, sortOrder: 0 },
    { id: 'c2', code: 'QUALITY', name: 'Quality', color: 'c1', active: true, sortOrder: 1 },
    { id: 'c3', code: 'SAFETY', name: 'Safety', color: 'c4', active: true, sortOrder: 2 },
    { id: 'c4', code: 'MORAL', name: 'Moral', color: 'c2', active: true, sortOrder: 3 },
    { id: 'c5', code: 'COST', name: 'Cost', color: 'c5', active: true, sortOrder: 4 },
  ],
  user: [
    { id: 'u1', email: 'admin@ptieg.co.id', name: 'Administrator', passwordHash: hash('Admin123!'), role: 'ADMIN', divisionId: null, phone: null, active: true, mustChangePassword: false, sessionVersion: 1, lastLoginAt: d(0), createdAt: d(30), updatedAt: d(0) },
    { id: 'u2', email: 'budi@ptieg.co.id', name: 'Budi Santoso', passwordHash: hash('Pic12345'), role: 'PIC', divisionId: 'd1', phone: '0812', active: true, mustChangePassword: false, sessionVersion: 1, lastLoginAt: d(1), createdAt: d(30), updatedAt: d(0) },
    { id: 'u3', email: 'sari@ptieg.co.id', name: 'Sari Dewi', passwordHash: hash('Pic12345'), role: 'PIC', divisionId: 'd4', phone: null, active: true, mustChangePassword: false, sessionVersion: 1, lastLoginAt: d(2), createdAt: d(30), updatedAt: d(0) },
    { id: 'u4', email: 'andi@ptieg.co.id', name: 'Andi Wijaya', passwordHash: hash('Pic12345'), role: 'PIC', divisionId: 'd3', phone: null, active: true, mustChangePassword: true, sessionVersion: 1, lastLoginAt: null, createdAt: d(10), updatedAt: d(0) },
  ],
  gembaSession: [
    { id: 'g1', number: 'GEMBA-2026-0001', title: 'Gemba pagi area Inbound', area: 'Gudang A – Inbound & Rak 1–10', scheduledAt: d(2, 8), startedAt: d(2, 8), completedAt: null, status: 'ONGOING', leaderId: 'u3', divisionId: 'd4', participants: 'Sari, Budi, Andi', notes: null, createdAt: d(3), updatedAt: d(2) },
    { id: 'g2', number: 'GEMBA-2026-0002', title: 'Gemba area Packing', area: 'Packing line 1–4', scheduledAt: d(-1, 14), startedAt: null, completedAt: null, status: 'PLANNED', leaderId: 'u3', divisionId: 'd4', participants: null, notes: 'Fokus 5S', createdAt: d(1), updatedAt: d(1) },
  ],
  finding: [],
  findingAction: [],
  attachment: [],
  appSetting: [{ key: 'sla_days', value: '2' }, { key: 'app_name', value: 'DOR IEG' }],
  counter: [],
};
const titles = ['Pallet menghalangi jalur evakuasi', 'Label SKU tidak terbaca di rak B-07', 'Barang retur menumpuk di area staging', 'APAR kedaluwarsa di dock 2', 'Selisih stok OCS vs fisik SKU 10023', 'Packing tidak sesuai SOP bubble wrap', 'Forklift beroperasi tanpa klakson', 'Pengiriman JNE terlambat pickup', 'Operator tidak memakai safety shoes', 'Kardus rusak di rak A-12'];
const statuses = ['OPEN', 'IN_PROGRESS', 'DONE', 'CLOSED', 'OPEN', 'IN_PROGRESS', 'DONE', 'OPEN', 'CLOSED', 'CANCELLED'];
for (let i = 0; i < 24; i++) {
  const reportedAt = d(i % 12, 8 + (i % 5));
  const status = statuses[i % statuses.length];
  const source = i % 4 === 0 ? 'GEMBA' : 'DOR';
  const first = status === 'OPEN' ? null : addDays(reportedAt, i % 3);
  db.finding.push({
    id: `f${i + 1}`, number: `${source === 'GEMBA' ? 'GMB' : 'DOR'}-2026-${String(i + 1).padStart(4, '0')}`, source, title: titles[i % titles.length], description: 'Ditemukan saat review pagi. Perlu tindakan segera supaya tidak berulang.\nDampak: potensi keterlambatan proses.', location: ['Rak A-12', 'Dock 2', 'Packing line 3', null][i % 4],
    categoryId: `c${(i % 5) + 1}`, priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3], status, reporterId: i % 2 ? 'u2' : 'u3', reporterDivisionId: i % 2 ? 'd1' : 'd4', assignedDivisionId: `d${(i % 5) + 1}`, assigneeId: i % 5 === 0 ? 'u2' : null,
    gembaSessionId: source === 'GEMBA' ? 'g1' : null, reportedAt, dueAt: addDays(reportedAt, 2), slaDays: 2, firstActionAt: first, doneAt: status === 'DONE' || status === 'CLOSED' ? addDays(reportedAt, 3) : null,
    closedAt: status === 'CLOSED' || status === 'CANCELLED' ? addDays(reportedAt, 4) : null, closedById: status === 'CLOSED' ? 'u3' : null, rootCause: i % 3 === 0 ? 'Tidak ada marking lantai' : null, resolution: null, createdAt: reportedAt, updatedAt: reportedAt,
  });
  if (first) {
    db.findingAction.push({ id: `a${i}-1`, findingId: `f${i + 1}`, userId: 'u2', type: 'ACTION', note: 'Sudah dipindahkan ke area yang benar dan dipasang marking.', fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', createdAt: first });
    if (status === 'DONE' || status === 'CLOSED') db.findingAction.push({ id: `a${i}-2`, findingId: `f${i + 1}`, userId: 'u2', type: 'STATUS', note: 'Selesai, mohon diverifikasi.', fromStatus: 'IN_PROGRESS', toStatus: 'DONE', createdAt: addDays(first, 1) });
  }
}

const relations = {
  finding: { category: ['category', 'categoryId'], reporter: ['user', 'reporterId'], reporterDivision: ['division', 'reporterDivisionId'], assignedDivision: ['division', 'assignedDivisionId'], assignee: ['user', 'assigneeId'], closedBy: ['user', 'closedById'], gembaSession: ['gembaSession', 'gembaSessionId'], actions: ['findingAction', 'findingId', 'many'], attachments: ['attachment', 'findingId', 'many'] },
  findingAction: { user: ['user', 'userId'], attachments: ['attachment', 'actionId', 'many'], finding: ['finding', 'findingId'] },
  gembaSession: { leader: ['user', 'leaderId'], division: ['division', 'divisionId'], findings: ['finding', 'gembaSessionId', 'many'] },
  user: { division: ['division', 'divisionId'] },
  division: { users: ['user', 'divisionId', 'many'], assignedFindings: ['finding', 'assignedDivisionId', 'many'] },
  category: { findings: ['finding', 'categoryId', 'many'] },
  attachment: {},
  appSetting: {}, counter: {},
};

function matchCond(v, c) {
  if (c === null || typeof c !== 'object' || c instanceof Date) return v === c || (v instanceof Date && c instanceof Date && v.getTime() === c.getTime());
  if ('in' in c) return c.in.includes(v);
  if ('not' in c) return c.not === null ? v !== null : v !== c.not;
  let ok = true;
  const t = (x) => (x instanceof Date ? x.getTime() : x);
  if ('gte' in c) ok = ok && t(v) >= t(c.gte);
  if ('lte' in c) ok = ok && t(v) <= t(c.lte);
  if ('lt' in c) ok = ok && t(v) < t(c.lt);
  if ('gt' in c) ok = ok && t(v) > t(c.gt);
  return ok;
}
function matches(row, where) {
  if (!where) return true;
  for (const [k, c] of Object.entries(where)) {
    if (k === 'OR') { if (!c.some((w) => matches(row, w))) return false; continue; }
    if (k === 'AND') { if (!c.every((w) => matches(row, w))) return false; continue; }
    if (!matchCond(row[k], c)) return false;
  }
  return true;
}
function hydrate(model, row, args) {
  if (!row) return row;
  let out = { ...row };
  const rel = relations[model] || {};
  const spec = args?.include || args?.select;
  if (args?.select) { const sel = {}; for (const k of Object.keys(args.select)) if (!(k in rel) && k !== '_count') sel[k] = row[k]; out = sel; }
  if (spec) {
    for (const [k, v] of Object.entries(spec)) {
      if (!v) continue;
      if (k === '_count') { out._count = {}; for (const rk of Object.keys(v.select)) { const [m, fk] = rel[rk]; out._count[rk] = db[m].filter((r) => r[fk] === row.id).length; } continue; }
      if (!(k in rel)) continue;
      const [m, fk, many] = rel[k];
      const sub = typeof v === 'object' ? v : {};
      if (many) {
        let rows = db[m].filter((r) => r[fk] === row.id && matches(r, sub.where));
        rows = sortRows(rows, sub.orderBy);
        out[k] = rows.map((r) => hydrate(m, r, sub));
      } else {
        out[k] = row[fk] ? hydrate(m, db[m].find((r) => r.id === row[fk]) || null, sub) : null;
      }
    }
  }
  return out;
}
function sortRows(rows, orderBy) {
  if (!orderBy) return rows;
  const obs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const ob of obs) { const [k, dir] = Object.entries(ob)[0]; const x = a[k] instanceof Date ? a[k].getTime() : a[k]; const y = b[k] instanceof Date ? b[k].getTime() : b[k]; if (x === y) continue; return (x > y ? 1 : -1) * (dir === 'desc' ? -1 : 1); }
    return 0;
  });
}
let seq = 1000;
const defaults = { finding: { status: 'OPEN', source: 'DOR', priority: 'MEDIUM', firstActionAt: null, doneAt: null, closedAt: null, closedById: null, assigneeId: null, gembaSessionId: null, rootCause: null, resolution: null, location: null, reporterDivisionId: null }, gembaSession: { status: 'PLANNED', startedAt: null, completedAt: null, participants: null, notes: null }, user: { active: true, mustChangePassword: true, sessionVersion: 1, role: 'PIC', divisionId: null, phone: null, lastLoginAt: null }, division: { active: true, isGembaTeam: false, sortOrder: 0, color: null, description: null }, category: { active: true, sortOrder: 0, color: null }, attachment: { findingId: null, actionId: null, isPublic: false, webViewUrl: null, width: null, height: null, size: 0 }, findingAction: { type: 'ACTION', fromStatus: null, toStatus: null }, counter: { value: 0 } };
function model(m) {
  const table = () => db[m];
  return {
    findMany: async (args = {}) => { let rows = table().filter((r) => matches(r, args.where)); rows = sortRows(rows, args.orderBy); if (args.take) rows = rows.slice(0, args.take); return rows.map((r) => hydrate(m, r, args)); },
    findFirst: async (args = {}) => { const rows = sortRows(table().filter((r) => matches(r, args.where)), args.orderBy); return hydrate(m, rows[0] || null, args); },
    findUnique: async (args = {}) => hydrate(m, table().find((r) => matches(r, args.where)) || null, args),
    findUniqueOrThrow: async (args = {}) => { const r = table().find((x) => matches(x, args.where)); if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' }); return hydrate(m, r, args); },
    count: async (args = {}) => table().filter((r) => matches(r, args.where)).length,
    groupBy: async (args = {}) => { const g = new Map(); for (const r of table().filter((x) => matches(x, args.where))) { const k = args.by.map((b) => r[b]).join('|'); if (!g.has(k)) g.set(k, { ...Object.fromEntries(args.by.map((b) => [b, r[b]])), _count: { _all: 0 } }); g.get(k)._count._all++; } return [...g.values()]; },
    create: async (args) => { const row = { id: `${m}${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...(defaults[m] || {}), ...args.data }; table().push(row); return hydrate(m, row, args); },
    update: async (args) => { const row = table().find((r) => matches(r, args.where)); if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' }); for (const [k, v] of Object.entries(args.data)) row[k] = v && typeof v === 'object' && 'increment' in v ? (row[k] || 0) + v.increment : v; row.updatedAt = new Date(); return hydrate(m, row, args); },
    updateMany: async (args) => { let n = 0; for (const row of table().filter((r) => matches(r, args.where))) { Object.assign(row, args.data); n++; } return { count: n }; },
    upsert: async (args) => { const row = table().find((r) => matches(r, args.where)); if (row) { Object.assign(row, args.update); return row; } const n = { id: `${m}${++seq}`, ...args.create }; table().push(n); return n; },
    delete: async (args) => { const i = table().findIndex((r) => matches(r, args.where)); if (i < 0) throw Object.assign(new Error('not found'), { code: 'P2025' }); return table().splice(i, 1)[0]; },
    deleteMany: async (args = {}) => { const keep = table().filter((r) => !matches(r, args.where)); const n = table().length - keep.length; db[m] = keep; return { count: n }; },
  };
}
class PrismaClientKnownRequestError extends Error { constructor(m, o = {}) { super(m); this.code = o.code; this.meta = o.meta; } }
class PrismaClient {
  constructor() { for (const m of Object.keys(db)) this[m] = model(m); }
  async $queryRaw() { return [{ 1: 1 }]; }
  async $queryRawUnsafe() { return []; }
  async $executeRawUnsafe() { return 0; }
  async $disconnect() {}
  async $connect() {}
}
const Prisma = { PrismaClientKnownRequestError, ...enums, sql: () => '', raw: () => '', join: () => '', empty: '' };
module.exports = { PrismaClient, Prisma, ...enums, $Enums: enums };
