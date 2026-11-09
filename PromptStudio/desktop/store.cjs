const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const fresh = () => ({ schema: 1, projects: [], folders: [], assets: [], profiles: [], channel: null, chat: [], settings: { theme: 'dark', provider: 'openai', imageProvider: 'openai', models: {}, imageModels: {}, oauthClientId: '' } });
class Store {
  constructor(dir) {
    this.dir = dir;
    this.assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(this.assetsDir, { recursive: true });
    this.file = path.join(dir, 'library.json');
    this.state = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : fresh();
    if (this.state.schema !== 1) throw new Error('Kütüphane sürümü desteklenmiyor. Veriler korunmuştur.');
    if (this.state.settings) delete this.state.settings.githubRepo;
    this.state.publications ||= [];
  }
  persist() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }
  save(collection, value) {
    if (!['projects', 'folders', 'profiles', 'assets', 'publications'].includes(collection)) throw new Error('Geçersiz kayıt türü.');
    const item = structuredClone(value);
    item.id ||= randomUUID();
    item.updatedAt = new Date().toISOString();
    const idx = this.state[collection].findIndex(x => x.id === item.id);
    item.createdAt = idx >= 0 ? this.state[collection][idx].createdAt : item.updatedAt;
    if (idx >= 0) this.state[collection][idx] = item;
    else this.state[collection].unshift(item);
    this.persist();
    return item;
  }
  remove(collection, id) {
    if (!['projects', 'folders', 'profiles', 'assets'].includes(collection)) throw new Error('Geçersiz kayıt türü.');
    if (collection === 'assets') {
      const asset = this.asset(id);
      if (asset) fs.rmSync(this.assetPath(id), { force: true });
      for (const p of this.state.projects) {
        p.references = (p.references || []).filter(x => x !== id);
        if (p.coverId === id) p.coverId = '';
        if (p.editor?.background === id) p.editor.background = '';
        if (p.editor?.logo === id) p.editor.logo = '';
      }
    }
    if (collection === 'assets') {
      for (const profile of this.state.profiles) {
        if (profile.coverReferences) profile.coverReferences = profile.coverReferences.filter(assetId => assetId !== id);
        if (profile.coverStyleAssetId === id) delete profile.coverStyleAssetId;
      }
    }
    if (collection === 'folders') {
      for (const p of this.state.projects) if (p.folderId === id) p.folderId = '';
    }
    if (collection === 'profiles') {
      for (const p of this.state.projects) if (p.profileId === id) p.profileId = '';
    }
    this.state[collection] = this.state[collection].filter(x => x.id !== id);
    this.persist();
  }
  asset(id) { return this.state.assets.find(x => x.id === id); }
  assetPath(id) {
    const item = this.asset(id);
    if (!item || !/^[a-f0-9-]+\.(png|jpg|webp)$/.test(item.file)) throw new Error('Görsel bulunamadı.');
    return path.join(this.assetsDir, item.file);
  }
  addAsset(buffer, ext, info = {}) {
    if (!['png', 'jpg', 'webp'].includes(ext) || buffer.length > 25 * 1024 * 1024) throw new Error('PNG, JPEG veya WebP ve en fazla 25 MB olmalı.');
    const valid = ext === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : ext === 'jpg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!valid) throw new Error('Görsel içeriği desteklenen bir biçim değil.');
    const id = randomUUID();
    const file = `${id}.${ext}`;
    fs.writeFileSync(path.join(this.assetsDir, file), buffer);
    return this.save('assets', { id, file, name: info.name || 'Yeni görsel', role: info.role || 'Stil örneği', note: info.note || '', tags: info.tags || '' });
  }
}
module.exports = { Store, fresh };
