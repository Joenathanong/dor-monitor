const fs = require('fs');
const env = {};
for (const l of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, ''); }
const { google } = require('googleapis');
(async () => {
  const oauth = new google.auth.OAuth2(env.GDRIVE_OAUTH_CLIENT_ID, env.GDRIVE_OAUTH_CLIENT_SECRET, 'http://localhost:53682/callback');
  oauth.setCredentials({ refresh_token: env.GDRIVE_OAUTH_REFRESH_TOKEN });
  const { token } = await oauth.getAccessToken();
  const info = await (await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token)).json();
  console.log('SCOPE token :', info.scope, '| email:', info.email);
  const drive = google.drive({ version: 'v3', auth: oauth });
  const step = async (name, fn) => { try { const r = await fn(); console.log('OK  ', name, r ?? ''); return r; } catch (e) { console.log('FAIL', name, '->', e?.response?.data?.error?.message ?? e.message, '| reason:', JSON.stringify(e?.response?.data?.error?.errors?.[0]?.reason)); } };
  await step('files.get folder', async () => (await drive.files.get({ fileId: env.GDRIVE_FOLDER_ID, fields: 'id,name,ownedByMe' })).data);
  await step('files.list in folder', async () => (await drive.files.list({ q: `'${env.GDRIVE_FOLDER_ID}' in parents and trashed=false`, fields: 'files(id,name)', pageSize: 3 })).data.files?.length);
  const f = await step('files.create', async () => (await drive.files.create({ requestBody: { name: 'diag.txt', parents: [env.GDRIVE_FOLDER_ID] }, media: { mimeType: 'text/plain', body: 'ok' }, fields: 'id' })).data.id);
  if (f) {
    await step('permissions.create anyone', async () => (await drive.permissions.create({ fileId: f, requestBody: { role: 'reader', type: 'anyone' } })).data.id);
    await step('files.delete', async () => { await drive.files.delete({ fileId: f }); return 'deleted'; });
  }
})().catch((e) => console.log('ERR', e.message));
