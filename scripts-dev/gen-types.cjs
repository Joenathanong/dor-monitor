const fs = require('fs');
const path = require('path');
(async () => {
  const { getDMMF } = require('@prisma/internals');
  const { dmmfToTypes, externalToInternalDmmf } = require('@prisma/client/generator-build');
  const datamodel = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const doc = externalToInternalDmmf(await getDMMF({ datamodel }));
  doc.mappings.modelOperations.forEach(op => { op.plural ||= op.model[0].toLowerCase() + op.model.slice(1) + 's'; });
  const out = 'node_modules/.prisma/client';
  fs.writeFileSync(path.join(out, 'index.d.ts'), dmmfToTypes(doc));
  fs.writeFileSync(path.join(out, 'default.d.ts'), "export * from './index'\n");
  const enums = {};
  for (const e of doc.datamodel.enums) { enums[e.name] = Object.fromEntries(e.values.map(v => [v.name, v.name])); }
  const js = `
const enums = ${JSON.stringify(enums)};
class PrismaClientKnownRequestError extends Error { constructor(m, o={}) { super(m); this.code = o.code; this.meta = o.meta; } }
class PrismaClient { constructor(){ return new Proxy(this, { get: (t, p) => p === 'then' ? undefined : (typeof p === 'string' && p.startsWith('$')) ? async () => undefined : new Proxy({}, { get: () => async () => { throw new Error('stub'); } }) }); } }
const Prisma = { PrismaClientKnownRequestError, ...enums, sql: () => '', raw: () => '', join: () => '', empty: '' };
module.exports = { PrismaClient, Prisma, ...enums, $Enums: enums };
`;
  fs.writeFileSync(path.join(out, 'index.js'), js);
  fs.writeFileSync(path.join(out, 'default.js'), "module.exports = require('./index')\n");
  fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({ name: '.prisma/client', main: 'index.js', types: 'index.d.ts' }));
  console.log('types written', fs.statSync(path.join(out, 'index.d.ts')).size);
})().catch(e => { console.error(e); process.exit(1); });
