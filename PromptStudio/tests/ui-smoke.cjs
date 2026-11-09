const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function run(win, dir) {
  const checks = [];
  const evaluate = (fn, ...args) => win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`);
  const waitFor = async (fn, message) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(fn)) return; await new Promise(r => setTimeout(r, 100)); }
    throw new Error(message);
  };
  const click = selector => evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error(`Bulunamadı: ${s}`); e.click(); }, selector);
  const input = (selector, value) => evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, selector, value);
  const shot = async name => {
    console.log('UI checkpoint:', name);
    await new Promise(r => setTimeout(r, 500));
    try { fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG()); }
    catch (e) { console.log('Screenshot unavailable:', e.message); }
  };
  await waitFor(() => document.body.innerText.includes('Hoş geldin, üretici.'), 'Ana ekran açılmadı.');
  assert.equal(await evaluate(() => document.querySelectorAll('.quick-card').length), 3);
  await shot('01-genel-bakis'); checks.push('Ana ekran ve gerçek boş durum');
  await click('[data-action="new-project"]');
  await waitFor(() => !!document.querySelector('#brief'), 'Proje açılmadı.');
  await input('#project-name', 'Telefon incelemeleri · Bölüm 01');
  await input('#brief', 'Telefonu bir hafta kullandım. Kamera, pil ve oyun performansı hakkında deneyimlerimi anlatıyorum.');
  await click('[data-tab="cover"]');
  await waitFor(() => !!document.querySelector('#cover-canvas'), 'Kapak editörü açılmadı.');
  await evaluate(() => {
    project.coverConcepts = ['Ürün', 'Tepki', 'Karşılaştırma'].map(name => ({ name, title: name + ' başlığı', overlay: name, prompt: 'Yazısız ' + name }));
    renderStudio();
  });
  await click('[data-action="select-cover-concept"][data-index="2"]');
  await waitFor(() => document.querySelector('#coverPrompt')?.value.includes('Yazısız Karşılaştırma'), 'Seçilen konsept editöre taşınmadı.');
  assert.equal(await evaluate(() => document.querySelector('.youtube-preview-card strong').textContent), 'Karşılaştırma başlığı');
  checks.push('Konsept seçimiyle başlık ve kapak önizlemesini birlikte hazırlama');
  await click('[data-action="cover-compare"]');
  await waitFor(() => document.querySelectorAll('[data-cover-preview]').length === 3, 'Üç kapak önizlemesi açılmadı.');
  await click('[data-cover-choice="1"]');
  await waitFor(() => !document.querySelector('#modal').open, 'Kapak düzeni uygulanamadı.');
  checks.push('A/B/C kapak karşılaştırması ve editöre uygulama');
  await input('#editor-text', 'BİR HAFTA\nSONRA…');
  await click('[data-action="save-cover"]');
  await waitFor(() => document.body.innerText.includes('Kapak kütüphaneye kaydedildi.'), 'Canvas PNG kaydı başarısız.');
  const snap = await evaluate(async () => (await window.studio.call('state')).data);
  assert.equal(snap.assets.length, 1);
  assert.equal(snap.projects[0].name, 'Telefon incelemeleri · Bölüm 01');
  await shot('02-kapak-studyosu'); checks.push('Proje kaydı, kapak editörü ve PNG kütüphane kaydı');
  await click('[data-route="library"]');
  await waitFor(() => !!document.querySelector('.asset-card img'), 'Görsel kütüphanesi açılmadı.');
  await evaluate(() => { document.querySelector('.asset-card img').loading = 'eager'; });
  console.log('Asset inspection:', await evaluate(() => { const i = document.querySelector('.asset-card img'); return { src: i.src, complete: i.complete, width: i.naturalWidth }; }));
  await waitFor(() => document.querySelector('.asset-card img')?.naturalWidth > 0, 'Yerel görsel yüklenemedi.');
  await click('[data-action="edit-asset"]');
  await input('#asset-note', 'Bu görsel renk ve yazı yerleşimi için örnektir.');
  await click('#save-asset');
  await waitFor(() => !document.querySelector('#modal').open, 'Görsel notu kaydedilemedi.');
  checks.push('Görsel protokolü ve kullanım notları');
  await click('[data-action="new-folder"]');
  await input('#folder-name', 'Telefon incelemeleri');
  await click('#save-folder');
  await waitFor(() => document.querySelector('#folder-nav').innerText.includes('Telefon incelemeleri'), 'Koleksiyon kaydedilemedi.');
  await click('[data-route="profiles"]');
  await click('[data-action="new-profile"]');
  await input('#profile-name', 'Teknoloji kanalım');
  await input('#profile-tone', 'Samimi ve bilgilendirici');
  await click('#save-profile');
  await waitFor(() => !!document.querySelector('.profile-card'), 'Profil kaydedilemedi.');
  checks.push('Özel koleksiyon ve kanal profili');
  await click('[data-route="projects"]');
  await waitFor(() => !!document.querySelector('.project-card'), 'Proje kartı yok.');
  await click('.project-card');
  await click('[data-tab="cover"]');
  await waitFor(() => document.querySelector('#cover-canvas')?.width === 1280, 'Kapak tekrar açılmadı.');
  await click('[data-action="series-template"]');
  await click('[data-action="apply-series"]');
  await waitFor(() => document.querySelector('#tone')?.value === 'Samimi ve bilgilendirici', 'Seri şablonu uygulanmadı.');
  await click('[data-action="cover-save-template"][data-style="yes"]');
  await waitFor(async () => {
    const snapshot = (await window.studio.call('state')).data;
    return snapshot.profiles[0].coverStyleAssetId === snapshot.projects[0].coverId;
  }, 'Kapak stil örneği profile kaydedilmedi.');
  assert.equal(await evaluate(() => {
    const profile = state.profiles[0];
    const draft = { references: [] };
    applySeries(draft, profile);
    return draft.references.includes(profile.coverStyleAssetId);
  }), true);
  checks.push('Tek seçimle proje seri şablonu');
  await click('[data-action="save-cover"]');
  await waitFor(() => document.body.innerText.includes('Kapak kütüphaneye kaydedildi.'), 'Yerel görsel içeren canvas dışa aktarılamadı.');
  checks.push('Kayıtlı görselden tekrar PNG üretimi (canvas origin testi)');
  await click('[data-route="analytics"]');
  await waitFor(() => !!document.querySelector('#chat-question'), 'Analiz sohbeti açılmadı.');
  await input('#chat-question', 'Kanalımı nasıl geliştirebilirim?');
  await click('[data-action="send-chat"]');
  await waitFor(() => document.querySelector('#setup-provider')?.value === 'openrouter', 'Sohbetten hızlı AI bağlantısı açılmadı.');
  assert.equal(await evaluate(() => document.querySelector('#provider-browser-login')?.textContent), 'OpenRouter hesabıyla bağlan');
  await click('[data-action="close-modal"]');
  assert.equal(await evaluate(() => document.querySelector('#chat-question').value), 'Kanalımı nasıl geliştirebilirim?');
  checks.push('Yapay zekâ kurulumunu sohbetten açma ve taslağı koruma');
  await click('[data-route="settings"]');
  await waitFor(() => document.querySelectorAll('[data-action="provider"]').length === 8, 'Sağlayıcı listesi açılmadı.');
  assert.equal(await evaluate(() => !!document.querySelector('#github-repo')), false);
  const updates = await evaluate(async () => {
    const settings = (await window.studio.call('settings', { githubRepo: 'example/ignored' })).data;
    if (settings.updateConfigured) return { configured: true, ignored: !settings.settings.githubRepo };
    return { ...(await window.studio.call('check-update')).data, ignored: !settings.settings.githubRepo };
  });
  assert.equal(updates.ignored, true);
  if (!updates.configured) assert.equal(updates.available, false);
  await click('[data-action="ai-setup"][data-id="image"]');
  await evaluate(() => {
    const select = document.querySelector('#setup-provider');
    select.value = 'openrouter';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await input('#provider-key', 'test-image-key-never-sent');
  await click('#save-key');
  await waitFor(() => !document.querySelector('#modal').open, 'Kapak sağlayıcısı kaydedilemedi.');
  const selectedProviders = await evaluate(async () => {
    const { provider, imageProvider } = (await window.studio.call('state')).data.settings;
    return [provider, imageProvider];
  });
  assert.deepEqual(selectedProviders, ['openrouter', 'openrouter']);
  checks.push('Hızlı kurulumdan sağlayıcıyı kaydetme ve dağıtım güncelleme ayarını koruma');
  await click('[data-action="provider"][data-id="openai"]');
  assert.equal(await evaluate(() => document.querySelector('#provider-key').type), 'password');
  await input('#provider-key', 'sk-test-local-never-sent');
  await click('#save-key');
  await waitFor(() => !document.querySelector('#modal').open, 'API anahtarı kaydedilemedi.');
  const secured = await evaluate(async () => (await window.studio.call('state')).data);
  assert.equal(secured.keys.openai, true);
  assert.ok(!JSON.stringify(secured).includes('sk-test-local-never-sent'));
  if (secured.secureStorage) assert.ok(!fs.readFileSync(path.join(dir, 'openai.secret')).includes(Buffer.from('sk-test-local-never-sent')));
  await click('[data-action="provider"][data-id="openai"]');
  await click('#remove-key');
  await waitFor(() => !document.querySelector('#modal').open, 'API anahtarı kaldırılamadı.');
  checks.push('Windows güvenli anahtar kaydı, arayüzden gizleme ve kaldırma');
  await shot('03-ayarlar');
  await click('[data-action="theme"]');
  await waitFor(() => document.body.classList.contains('light'), 'Açık tema çalışmadı.');
  await shot('04-acik-tema');
  await click('[data-action="theme"]');
  checks.push('Sekiz sağlayıcı, gizli anahtar alanı ve iki tema');
  await click('[data-route="publications"]');
  await waitFor(() => document.querySelectorAll('[data-action="connect-publication"]').length === 3, 'Yayın hesabı kartları açılmadı.');
  await click('[data-action="connect-publication"][data-id="instagram"]');
  assert.equal(await evaluate(() => document.querySelector('#publication-token').type), 'password');
  await click('[data-action="close-modal"]');
  checks.push('Yayın kuyruğu ve üç platformun hesap kartları');
  await click('[data-route="ideas"]');
  await waitFor(() => !!document.querySelector('#idea-topic'), 'Fikir laboratuvarı açılmadı.');
  await click('[data-action="research-key"]');
  assert.equal(await evaluate(() => document.querySelector('#research-api-key').type), 'password');
  await click('[data-action="close-modal"]');
  checks.push('Fikir laboratuvarı ve gizli YouTube API anahtarı alanı');
  await click('[data-route="home"]');
  await waitFor(() => document.body.innerText.includes('Hoş geldin, üretici.'), 'Ana ekrana dönüş başarısız.');
  await shot('05-dolu-genel-bakis');
  await click('[data-route="library"]');
  await click('[data-action="delete-asset"]');
  await click('#confirm-delete');
  await waitFor(() => document.querySelectorAll('.asset-card').length === 1, 'Görsel silinemedi.');
  await click('[data-route="projects"]');
  await click('.project-card');
  await click('[data-action="delete-project"]');
  await click('#confirm-delete');
  await waitFor(() => document.body.innerText.includes('Bu alan senin fikirlerini bekliyor.'), 'Proje silinemedi.');
  checks.push('Görsel ve proje silme, gezinti sonrası silinen projenin geri oluşmaması');
  await evaluate(() => {
    state.connected = true;
    state.channel = {
      name: 'Teknoloji kanalım', statistics: {}, reports: { rows: [] },
      period: { start: '2026-10-01', end: '2026-10-28' },
      syncedAt: '2026-10-29T10:00:00Z',
      videos: [{ id: 'abcdefghijk', snippet: { title: 'Kaynak video', publishedAt: '2026-10-07' } }]
    };
  });
  await click('[data-route="analytics"]');
  await click('[data-action="analysis-project"]');
  await input('#analysis-topic', 'Devam videosu');
  await click('#analysis-create');
  await waitFor(() => document.body.innerText.includes('Kaynak video · Kaynak video'), 'Analiz kaynağı projeye taşınmadı.');
  await evaluate(async () => {
    Object.assign(project, { titles: ['Birinci seçenek', 'İkinci seçenek'], description: 'Hazır açıklama', tags: ['örnek'] });
    await flushSave();
    renderStudio();
  });
  await evaluate(() => {
    const select = document.querySelector('#chosen-title');
    select.value = '1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await click('[data-route="projects"]');
  await waitFor(() => document.querySelector('.project-card')?.textContent.includes('Kapak seçilmedi'), 'Proje ilerlemesi gösterilmedi.');
  await click('.project-card');
  await waitFor(() => !!document.querySelector('#cover-canvas'), 'Proje eksik kapak adımından devam etmedi.');
  await input('#editor-text', 'DEVAM');
  await click('[data-action="approve-cover"]');
  await waitFor(() => document.querySelector('#studio-output')?.textContent.includes('İkinci seçenek') && !!document.querySelector('[data-action="publish-project"]'), 'Seçili başlıkla yayın paketi açılmadı.');
  await click('[data-action="publish-project"]');
  await waitFor(() => document.body.innerText.includes('Önce yayın hesabını bağla'), 'Yayın hesabı yönlendirmesi açılmadı.');
  await click('[data-action="close-modal"]');
  checks.push('Analizden taslak, eksik adımdan devam ve seçili başlıkla yayın paketi');
  const codex = require('../desktop/codex-media.cjs');
  const originalCodex = { ...codex };
  const fixture = JSON.parse(fs.readFileSync(path.join(dir, 'library.json'), 'utf8')).assets[0];
  let coverCalls = 0;
  let referenceCount = 0;
  Object.assign(codex, {
    status: async () => ({ installed: true, connected: true }),
    text: async () => JSON.stringify({ titles: ['Tek hesapla içerik'], description: 'Hazır açıklama', tags: ['test'], coverPrompt: 'Yazısız kapak', coverText: 'TEK HESAP' }),
    cover: async (prompt, references) => {
      assert.equal(prompt, 'Yazısız kapak');
      coverCalls++;
      referenceCount = references.length;
      return { buffer: fs.readFileSync(path.join(dir, 'assets', fixture.file)), ext: 'png' };
    }
  });
  try {
    await click('[data-route="home"]');
    await waitFor(() => !!document.querySelector('[data-action="quick-project"]'), 'Hızlı üretim düğmesi açılmadı.');
    await click('[data-action="quick-project"]');
    await waitFor(() => !!document.querySelector('.quick-create-panel'), 'Hızlı üretim ekranı açılmadı.');
    await input('#brief', 'Yeni yazıcı incelemesi');
    await click('[data-action="pick-refs"]');
    await click('[data-pick]');
    await click('#apply-pick');
    await waitFor(() => document.querySelector('.quick-create-panel .refs img'), 'Referans eklenemedi.');
    await click('[data-action="chatgpt-connect"]');
    await waitFor(() => !!document.querySelector('#connect-chatgpt'), 'ChatGPT bağlantı ekranı açılmadı.');
    await click('#connect-chatgpt');
    await waitFor(() => !!document.querySelector('[data-action="quick-generate"]'), 'ChatGPT bağlantısı seçilemedi.');
    await click('[data-action="quick-generate"]');
    await waitFor(() => document.querySelector('#studio-output')?.textContent.includes('Tek hesapla içerik') && !!document.querySelector('[data-action="publish-project"]'), 'Tek hesapla yayın paketi hazırlanmadı.');
    assert.equal(coverCalls, 1);
    assert.equal(referenceCount, 1);
    checks.push('Örnek Codex yanıtıyla ChatGPT bağlantısı, referanslı tek kapak ve metin paketi');
  } finally {
    Object.assign(codex, originalCodex);
  }
  const result = await evaluate(async () => { const s = (await window.studio.call('state')).data; return { projects: s.projects.length, assets: s.assets.length, folders: s.folders.length, profiles: s.profiles.length, bridge: true }; });
  return { ...result, checks };
}
module.exports = { run };
