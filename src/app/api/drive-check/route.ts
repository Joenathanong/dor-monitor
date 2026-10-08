// Diagnosa Google Drive dari server (Vercel) — khusus Admin. Buka /api/drive-check di browser.
import { apiUser, isResponse } from '@/lib/auth';
import { driveAuthMode, getDrive, resolveRootFolder, storageDriver, type RootFolder } from '@/lib/drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await apiUser();
  if (isResponse(u)) return u;
  if (u.role !== 'ADMIN') return Response.json({ error: 'Hanya Admin' }, { status: 403 });

  const steps: Array<{ step: string; ok: boolean; detail?: unknown }> = [];
  const run = async <T,>(step: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try { const r = await fn(); steps.push({ step, ok: true, detail: r }); return r; }
    catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      steps.push({ step, ok: false, detail: err?.response?.data?.error?.message ?? err?.message });
      return undefined;
    }
  };

  const env = {
    STORAGE_DRIVER: storageDriver(),
    authMode: driveAuthMode(),
    GDRIVE_FOLDER_ID: process.env.GDRIVE_FOLDER_ID || null,
    GDRIVE_FOLDER_NAME: process.env.GDRIVE_FOLDER_NAME || 'DOR Bukti Foto',
    hasClientId: !!process.env.GDRIVE_OAUTH_CLIENT_ID,
    hasClientSecret: !!process.env.GDRIVE_OAUTH_CLIENT_SECRET,
    refreshTokenLength: process.env.GDRIVE_OAUTH_REFRESH_TOKEN?.trim().length ?? 0,
    hasServiceAccount: !!(process.env.GDRIVE_SA_JSON || process.env.GDRIVE_SA_BASE64),
  };
  const drive = getDrive();
  if (env.authMode === 'oauth') {
    await run('token scope', async () => {
      const auth = (drive as unknown as { context: { _options: { auth: { getAccessToken: () => Promise<{ token: string }> } } } }).context._options.auth;
      const { token } = await auth.getAccessToken();
      const info = await (await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token)).json();
      return { scope: info.scope, email: info.email };
    });
  }
  const root = await run<RootFolder>('resolve folder induk', () => resolveRootFolder(drive));
  if (root) {
    const id = await run('upload uji', async () => (await drive.files.create({ requestBody: { name: 'dor-check.txt', parents: [root.id] }, media: { mimeType: 'text/plain', body: 'ok' }, fields: 'id' })).data.id);
    if (id) {
      await run('izin publik (anyone reader)', async () => (await drive.permissions.create({ fileId: id, requestBody: { role: 'reader', type: 'anyone' } })).data.id);
      await run('hapus file uji', async () => { await drive.files.delete({ fileId: id }); return 'deleted'; });
    }
  }
  const allOk = steps.every((s) => s.ok);
  return Response.json({
    allOk,
    hint: !allOk ? 'Lihat langkah yang ok:false' : root && root.source !== 'env' ? `Berhasil memakai folder milik app. Set GDRIVE_FOLDER_ID=${root.id} di Vercel lalu Redeploy.` : 'Google Drive siap.',
    env,
    steps,
  }, { status: 200 });
}
