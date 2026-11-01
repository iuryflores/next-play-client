import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('servidor PM2 entrega build e marcador, sem transformar assets inexistentes em HTML', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'nextplay-static-'));
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening'); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  await mkdir(join(dir, 'dist', 'assets'), { recursive: true });
  await writeFile(join(dir, 'dist', 'index.html'), '<div id="root">NextPlay</div>');
  await writeFile(join(dir, 'dist', 'assets', 'app.js'), 'console.log("NextPlay")');
  await writeFile(join(dir, 'dist', 'deploy-meta.json'), '{"releaseId":"test"}');
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/serve-frontend.mjs', import.meta.url))], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 50)); }
  assert.ok(ready);
  assert.equal((await fetch(base + '/deploy-meta.json')).status, 200);
  assert.match((await fetch(base + '/assets/app.js')).headers.get('content-type'), /javascript/);
  assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
  assert.equal((await fetch(base + '/.env')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e%2fpackage.json')).status, 404);
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
});
