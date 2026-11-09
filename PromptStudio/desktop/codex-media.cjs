const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function executable() {
  const local = process.env.LOCALAPPDATA;
  const bin = local && path.join(local, 'OpenAI', 'Codex', 'bin');
  const installed = bin ? await fs.readdir(bin, { withFileTypes: true }).catch(() => []) : [];
  const candidates = [
    ...String(process.env.PATH || '').split(path.delimiter).map(value => value.replace(/^"|"$/g, '')).filter(value => path.isAbsolute(value)).map(value => path.join(value, 'codex.exe')),
    ...(local ? [path.join(local, 'Microsoft', 'WinGet', 'Links', 'codex.exe')] : []),
    ...installed.filter(entry => entry.isDirectory()).map(entry => path.join(bin, entry.name, 'codex.exe'))
  ];
  for (const candidate of candidates) {
    if (await fs.stat(candidate).then(stat => stat.isFile()).catch(() => false)) return candidate;
  }
  return null;
}

function cliEnvironment() {
  const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'SYSTEMDRIVE', 'USERNAME', 'USERDOMAIN', 'HOMEDRIVE', 'HOMEPATH', 'COMSPEC', 'PROGRAMDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432']);
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toUpperCase())));
}

function cli(bin, args, { cwd = os.tmpdir(), input = '', timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env: cliEnvironment(), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let errors = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Codex işlemi zaman aşımına uğradı. Tekrar denemeden önce işlemin durumunu kontrol et.'));
    }, timeout);
    child.stdout.setEncoding('utf8').on('data', chunk => {
      output += chunk;
      if (output.length > 8 * 1024 * 1024) {
        child.kill();
        reject(new Error('Codex beklenenden büyük çıktı döndürdü.'));
      }
    });
    child.stderr.setEncoding('utf8').on('data', chunk => { errors = (errors + chunk).slice(-8192); });
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timer); reject(new Error('Codex başlatılamadı. Kurulumunu kontrol et.')); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, output, errors }); });
    child.stdin.end(input);
  });
}

async function status() {
  const bin = await executable();
  if (!bin) return { installed: false, connected: false };
  const result = await cli(bin, ['login', 'status']);
  return { installed: true, connected: result.code === 0 && /logged in using ChatGPT/i.test(result.output + result.errors) };
}

let loggingIn = false;
async function login() {
  if (loggingIn) throw new Error('Tarayıcıda devam eden giriş işlemini tamamla.');
  const bin = await executable();
  if (!bin) throw new Error('Önce Codex CLI’ı kur.');
  loggingIn = true;
  try {
    await cli(bin, ['login'], { timeout: 240000 });
    if (!(await status()).connected) throw new Error('ChatGPT ile giriş tamamlanmadı. Tarayıcıdan tekrar dene.');
  } finally {
    loggingIn = false;
  }
}

async function run(prompt, references, image) {
  const bin = await executable();
  if (!bin || !(await status()).connected) throw new Error('Önce ChatGPT hesabını bağla.');
  if (references.length > 5) throw new Error('ChatGPT ile kapak üretiminde en fazla 5 referans seç.');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'promptstudio-codex-'));
  try {
    const args = ['exec', '--json', '--color', 'never', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--sandbox', 'read-only', '-c', 'approval_policy="never"', '-c', 'features.shell_tool=false', '-C', directory];
    args.push(image ? '--enable' : '--disable', 'image_generation');
    for (const [index, reference] of references.entries()) {
      const format = reference.mime === 'image/jpeg' ? 'jpg' : reference.mime === 'image/webp' ? 'webp' : 'png';
      const file = path.join(directory, `reference-${index + 1}.${format}`);
      await fs.writeFile(file, reference.buffer);
      args.push('--image', file);
    }
    const result = await cli(bin, [...args, '-'], { cwd: directory, input: prompt, timeout: image ? 240000 : 120000 });
    const events = result.output.split(/\r?\n/).flatMap(line => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
    if (result.code !== 0 || !events.some(event => event.type === 'turn.completed')) {
      if (/usage limit|rate.limit|quota|insufficient/i.test(result.output + result.errors)) throw new Error('Codex kullanım sınırına ulaşıldı. Hesabını kontrol et.');
      throw new Error('Codex üretimi tamamlayamadı. ChatGPT oturumunu ve bağlantını kontrol et.');
    }
    if (!image) {
      const messages = events.filter(event => event.type === 'item.completed' && event.item?.type === 'agent_message');
      const text = messages.at(-1)?.item.text;
      if (!text) throw new Error('Codex metin sonucu döndürmedi.');
      return text;
    }
    const thread = events.find(event => event.type === 'thread.started')?.thread_id;
    if (!/^[a-zA-Z0-9_-]{10,80}$/.test(thread || '')) throw new Error('Codex görsel oturumu bulunamadı.');
    const roots = [path.join(os.homedir(), '.codex', 'generated_images', thread), path.join(directory, 'generated_images')];
    for (const root of roots) {
      const files = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
      for (const entry of files.filter(item => item.isFile() && /^[A-Za-z0-9_-]+\.png$/i.test(item.name)).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = path.join(root, entry.name);
        const stat = await fs.stat(file);
        if (stat.size > 0 && stat.size <= 25 * 1024 * 1024) return { buffer: await fs.readFile(file), ext: 'png' };
      }
    }
    throw new Error('Codex kapak dosyasını oluşturmadı. Hesabın görsel üretimini destekliyor mu kontrol et.');
  } finally {
    const target = path.resolve(directory);
    if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('promptstudio-codex-')) {
      await fs.rm(target, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function text(system, messages) {
  return run(`${system}\nYalnızca istenen metni döndür. Dosya ve araç kullanma.\nGirdi (JSON):\n${JSON.stringify(messages)}`, [], false);
}

function cover(prompt, references) {
  const roles = references.map(({ role, note }, index) => ({ reference: index + 1, role, note }));
  return run(`Yerleşik image_gen aracını bir kez kullanıp yatay 16:9 tek bir YouTube kapak PNG'si oluştur. Ekli referansları aşağıdaki rollerle kullan. Önceki kapağın stili örnekse renkleri, ışığı ve görsel dili koru, eski konu veya metni kopyalama. Yazı ve logo için boşluk bırak. Başka araç çalıştırma.\nGirdi (JSON):\n${JSON.stringify({ prompt, roles })}`, references, true);
}

module.exports = { status, login, text, cover };
