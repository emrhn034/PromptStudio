const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Store } = require('../desktop/store.cjs');
const { parseContent, textAI, imageAI, refreshOAuth, newerVersion, createOAuth, channelData } = require('../desktop/services.cjs');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');

test('OpenRouter seçilen kapak için tek görsel ve referansları aynı anahtarla gönderir', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/images');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.n, 1);
    assert.equal(body.aspect_ratio, '16:9');
    assert.equal(body.model, 'openai/gpt-image-2');
    assert.equal(body.input_references[0].image_url.url, `data:image/png;base64,${png.toString('base64')}`);
    assert.match(body.prompt, /Ürün/);
    return Response.json({ data: [{ b64_json: png.toString('base64'), media_type: 'image/png' }] });
  };
  const result = await imageAI('openrouter', 'test-key', '', 'Yakın plan', [{ role: 'Ürün', mime: 'image/png', buffer: png }]);
  assert.deepEqual(result, { buffer: png, ext: 'png' });
});

test('Kapak konseptleri üç eksiksiz başlık, yazı ve görsel talimatı gerektirir', () => {
  const { parseCoverConcepts } = require('../desktop/services.cjs');
  const concepts = ['Yakın plan', 'Karşılaştırma', 'Detay'].map(name => ({ name, title: 'Bir haftalık deneyim', overlay: 'BİR HAFTA', prompt: name }));
  assert.deepEqual(parseCoverConcepts(JSON.stringify({ concepts })), concepts);
  assert.throws(() => parseCoverConcepts(JSON.stringify({ concepts: concepts.slice(0, 2) })), /üç eksiksiz/);
});

test('Kütüphane yeniden açılabilir; görsel silme tüm proje referanslarını temizler', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstudio-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const s = new Store(dir);
  const a = s.addAsset(png, 'png', { name: 'Referans', note: 'Yüzümü koru.' });
  const folder = s.save('folders', { name: 'İncelemeler' });
  const p = s.save('projects', { name: 'Bölüm 1', folderId: folder.id, references: [a.id], coverId: a.id, editor: { logo: a.id, background: a.id } });
  assert.equal(new Store(dir).state.projects[0].name, 'Bölüm 1');
  const file = s.assetPath(a.id);
  s.remove('assets', a.id);
  assert.equal(fs.existsSync(file), false);
  assert.deepEqual(s.state.projects[0].references, []);
  assert.equal(s.state.projects[0].coverId, '');
  assert.equal(s.state.projects[0].editor.logo, '');
  s.remove('folders', folder.id);
  assert.equal(s.state.projects[0].folderId, '');
  assert.equal(s.state.projects[0].id, p.id);
  assert.throws(() => s.save('settings', {}));
  assert.throws(() => s.addAsset(Buffer.from('<svg/>'), 'png'));
  assert.throws(() => s.assetPath('../../secret'));
});

test('Bozuk kütüphane sessizce sıfırlanmaz', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstudio-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'library.json'), '{broken');
  assert.throws(() => new Store(dir));
  assert.equal(fs.readFileSync(path.join(dir, 'library.json'), 'utf8'), '{broken');
});

test('AI JSON doğrulaması ve platform sınırları', () => {
  const c = parseContent('```json\n' + JSON.stringify({ titles: ['a'.repeat(150)], description: 'b'.repeat(6000), tags: Array.from({ length: 100 }, (_, i) => `etiket-${i}`), coverPrompt: 'Kapak' }) + '\n```');
  assert.equal(c.titles[0].length, 100);
  assert.equal(c.description.length, 5000);
  assert.ok(c.tags.join(', ').length <= 500);
  assert.throws(() => parseContent('{"titles": [1]}'));
  assert.throws(() => parseContent('Geçerli JSON değil.'));
});

test('Tüm metin sağlayıcıları kendi API biçimi ve güvenli başlıklarla çağrılır', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const outputs = {
    openai: { output: [{ content: [{ type: 'output_text', text: 'yanıt' }] }] },
    anthropic: { content: [{ type: 'text', text: 'yanıt' }] },
    gemini: { candidates: [{ content: { parts: [{ text: 'yanıt' }] } }] }
  };
  for (const provider of ['openai', 'anthropic', 'gemini', 'deepseek', 'xai', 'mistral', 'groq', 'openrouter']) {
    let captured;
    global.fetch = async (url, opts) => { captured = { url, opts, body: JSON.parse(opts.body) }; return Response.json(outputs[provider] || { choices: [{ message: { content: 'yanıt' } }] }); };
    assert.equal(await textAI(provider, 'secret', 'custom-model', [{ role: 'user', content: 'soru' }], 'sistem'), 'yanıt');
    assert.ok(captured.url.startsWith('https://'));
    assert.ok(!captured.url.includes('secret'));
    if (provider === 'openai') { assert.equal(captured.body.store, false); assert.equal(captured.body.model, 'custom-model'); }
    else if (provider === 'gemini') assert.equal(captured.body.contents[0].parts[0].text, 'soru');
    else assert.equal(captured.body.model, 'custom-model');
  }
  await assert.rejects(textAI('openai', '', '', [], ''), /anahtar/);
});

test('Referans görsel OpenAI düzenleme isteğine dosya ve kullanım notuyla eklenir', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async (url, opts) => {
    assert.ok(url.endsWith('/images/edits'));
    assert.equal(opts.body.getAll('image[]').length, 1);
    assert.match(opts.body.get('prompt'), /Yüzümü koru/);
    assert.equal(opts.headers.Authorization, 'Bearer key');
    return Response.json({ data: [{ b64_json: png.toString('base64') }] });
  };
  const r = await imageAI('openai', 'key', '', 'Kapak', [{ role: 'Kişi', note: 'Yüzümü koru', mime: 'image/png', buffer: png }]);
  assert.deepEqual(r.buffer, png);
});

test('Gemini görsel parçaları gönderilir ve görsel yanıtı alınır', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/png');
    return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] });
  };
  const r = await imageAI('gemini', 'key', '', 'Kapak', [{ role: 'Kişi', mime: 'image/png', buffer: png }]);
  assert.deepEqual(r.buffer, png);
});

test('OAuth yenilemesi refresh token bilgisini korur', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async (url, opts) => { assert.equal(opts.body.get('refresh_token'), 'refresh'); return Response.json({ access_token: 'new', expires_in: 3600 }); };
  const result = await refreshOAuth({ expiresAt: 0, refresh_token: 'refresh' }, 'client', 'client-secret');
  assert.equal(result.refresh_token, 'refresh');
  assert.equal(result.access_token, 'new');
  await assert.rejects(refreshOAuth({ expiresAt: 0 }, 'client', ''), /Yeniden bağlanın/);
});

test('OAuth akışında PKCE, salt okuma izinleri ve state doğrulaması vardır', async () => {
  await assert.rejects(createOAuth({ clientId: 'test', timeoutMs: 100, openExternal: async url => {
    const auth = new URL(url);
    assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(auth.searchParams.get('scope').includes('youtube.readonly'));
    assert.ok(!auth.searchParams.get('scope').includes('youtube.upload'));
    const callback = new URL(auth.searchParams.get('redirect_uri'));
    callback.searchParams.set('state', 'wrong'); callback.searchParams.set('code', 'stolen');
    assert.equal((await fetch(callback)).status, 400);
  } }), /süresi doldu/);
});

test('Kanal raporu API verisinden oluşturulur ve saatlik veri varmış gibi davranmaz', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  global.fetch = async url => {
    if (url.includes('/channels?')) return Response.json({ items: [{ snippet: { title: 'Kanal' }, statistics: { subscriberCount: '10' }, contentDetails: {} }] });
    return Response.json({ rows: [['2026-01-01', 12, 30, 1, 150]] });
  };
  const c = await channelData('token');
  assert.equal(c.name, 'Kanal'); assert.equal(c.reports.rows[0][1], 12);
  assert.match(c.limitation, /saatlik/);
  assert.equal((new Date(c.period.end) - new Date(c.period.start)) / 86400000, 27);
});

test('Sürüm karşılaştırması ön sürümleri ve eski sürümleri güncelleme saymaz', () => {
  assert.equal(newerVersion('0.2.0', 'v0.3.0'), true);
  assert.equal(newerVersion('0.2.0', '0.10.0'), true);
  assert.equal(newerVersion('0.2.0', '0.2.0'), false);
  assert.equal(newerVersion('0.2.0', 'v0.1.9'), false);
  assert.equal(newerVersion('0.2.0', 'v0.3.0-beta'), false);
});

test('OpenRouter, eşleşen state ve PKCE doğrulayıcısıyla anahtar verir', async t => {
  const { connectOpenRouter } = require('../desktop/services.cjs');
  const { createHash } = require('node:crypto');
  const realFetch = global.fetch;
  t.after(() => { global.fetch = realFetch; });
  let challenge;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/auth/keys');
    const body = JSON.parse(options.body);
    assert.equal(body.code, 'test-code');
    assert.equal(body.code_challenge_method, 'S256');
    assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'), challenge);
    return Response.json({ key: 'test-key' });
  };
  const key = await connectOpenRouter(async url => {
    const authorization = new URL(url);
    challenge = authorization.searchParams.get('code_challenge');
    const callback = new URL(authorization.searchParams.get('callback_url'));
    callback.searchParams.set('code', 'test-code');
    callback.searchParams.set('state', 'wrong-state');
    assert.equal((await realFetch(callback)).status, 400);
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    assert.equal((await realFetch(callback)).status, 200);
  }, 3000);
  assert.equal(key, 'test-key');
});
