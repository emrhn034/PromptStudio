const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const dir = path.resolve(__dirname, '../test-results', `package-${Date.now()}`);
fs.mkdirSync(dir, { recursive: true });
const env = { ...process.env, PROMPTSTUDIO_DATA_DIR: dir, PROMPTSTUDIO_LAUNCH_CHECK: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.PROMPTSTUDIO_SMOKE;
const executable = path.resolve(__dirname, '../release/win-unpacked/PromptStudio.exe');
const p = spawn(executable, [], { env, stdio: 'inherit', windowsHide: true });
const timeout = setTimeout(() => { p.kill(); console.error('Packaged launch timed out'); process.exitCode = 1; }, 30000);
p.on('exit', code => {
  clearTimeout(timeout);
  const file = path.join(dir, 'launch-check.json');
  if (!fs.existsSync(file)) { console.error('No packaged launch result', code); process.exitCode = 1; return; }
  const result = JSON.parse(fs.readFileSync(file));
  console.log('Packaged launch:', result);
  process.exitCode = code || (result.ok && result.ready && result.providers === 8 ? 0 : 1);
});
