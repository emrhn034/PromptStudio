const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');

const PROVIDERS = {
  openai: { name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', imageModel: 'gpt-image-1', image: true },
  anthropic: { name: 'Claude', base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5' },
  gemini: { name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash', imageModel: 'gemini-2.5-flash-image', image: true },
  deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com', model: 'deepseek-chat' },
  xai: { name: 'xAI · Grok', base: 'https://api.x.ai/v1', model: 'grok-3-mini' },
  mistral: { name: 'Mistral', base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  groq: { name: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4.1-mini', imageModel: 'openai/gpt-image-2', image: true }
};
async function request(url, options = {}) {
  let res;
  try { res = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(180000) }); }
  catch (e) { throw new Error(e.name === 'TimeoutError' ? 'İstek zaman aşımına uğradı. Tekrar deneyin.' : 'Servise ulaşılamadı. İnternet bağlantınızı kontrol edin.'); }
  let data;
  try { data = await res.json(); } catch { throw new Error(`Servis geçerli bir yanıt vermedi (HTTP ${res.status}).`); }
  if (!res.ok) {
    const hint = data.error?.message || data.message || 'İstek başarısız.';
    throw new Error(`HTTP ${res.status}: ${String(hint).replace(/(?:sk-|AIza)[\w-]+/g, '[gizli]').slice(0, 500)}`);
  }
  return data;
}
const jsonPost = (headers, body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
async function textAI(provider, key, model, messages, system) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error('Sağlayıcı seçin.');
  if (!key) throw new Error(`${p.name} API anahtarınızı Ayarlar bölümünden ekleyin.`);
  model ||= p.model;
  if (provider === 'anthropic') {
    const r = await request(`${p.base}/messages`, jsonPost({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }, { model, max_tokens: 4096, system, messages }));
    return r.content.filter(x => x.type === 'text').map(x => x.text).join('\n');
  }
  if (provider === 'gemini') {
    const r = await request(`${p.base}/models/${encodeURIComponent(model)}:generateContent`, jsonPost({ 'x-goog-api-key': key }, { systemInstruction: { parts: [{ text: system }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) }));
    const result = r.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('');
    if (!result) throw new Error('Model metin döndürmedi. Güvenlik ayarlarını veya model seçimini kontrol edin.');
    return result;
  }
  if (provider === 'openai') {
    const r = await request(`${p.base}/responses`, jsonPost({ Authorization: `Bearer ${key}` }, { model, instructions: system, input: messages, store: false }));
    const text = (r.output || []).flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('\n');
    if (!text) throw new Error('Model metin döndürmedi.');
    return text;
  }
  const r = await request(`${p.base}/chat/completions`, jsonPost({ Authorization: `Bearer ${key}` }, { model, messages: [{ role: 'system', content: system }, ...messages] }));
  const result = r.choices?.[0]?.message?.content;
  if (!result) throw new Error('Model metin döndürmedi.');
  return result;
}
function parseContent(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  let result;
  try { result = JSON.parse(text.slice(start, end + 1)); } catch { throw new Error('Model beklenen içerik biçimini döndürmedi. Tekrar deneyin veya farklı model seçin.'); }
  if (!Array.isArray(result.titles) || !result.titles.every(x => typeof x === 'string') || typeof result.description !== 'string' || !Array.isArray(result.tags) || !result.tags.every(x => typeof x === 'string')) throw new Error('Model yanıtında başlık, açıklama veya etiketler eksik.');
  result.titles = result.titles.slice(0, 8).map(x => x.slice(0, 100));
  result.tags = result.tags.filter(Boolean);
  while (result.tags.join(', ').length > 500) result.tags.pop();
  result.description = result.description.slice(0, 5000);
  result.coverPrompt = typeof result.coverPrompt === 'string' ? result.coverPrompt : '';
  if (typeof result.coverText === 'string') result.coverText = result.coverText.trim().slice(0, 42);
  return result;
}
async function imageAI(provider, key, model, prompt, references) {
  if (!key) throw new Error('Görsel sağlayıcısının API anahtarını Ayarlar bölümünden ekleyin.');
  const p = PROVIDERS[provider];
  if (!p?.image) throw new Error('Görsel üretimini destekleyen bir sağlayıcı seçin.');
  const instruction = `${prompt}\nYouTube kapak kompozisyonu, yatay 16:9, mobilde okunaklı.\n` + references.map((x, i) => `Referans ${i + 1}: ${x.role}. Kullanım talimatı: ${x.note || 'Bu rolü dikkate al.'}`).join('\n');
  if (provider === 'openrouter') {
    const body = { model: model || p.imageModel, prompt: instruction, aspect_ratio: '16:9', n: 1, output_format: 'png' };
    if (references.length) body.input_references = references.map(ref => ({
      type: 'image_url', image_url: { url: `data:${ref.mime};base64,${ref.buffer.toString('base64')}` }
    }));
    const result = await request(`${p.base}/images`, jsonPost({ Authorization: `Bearer ${key}` }, body));
    const image = result.data?.[0];
    if (typeof image?.b64_json !== 'string' || !image.b64_json) throw new Error('OpenRouter görsel döndürmedi.');
    const formats = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    const ext = image.media_type ? formats[image.media_type] : 'png';
    if (!ext) throw new Error('Görsel biçimi desteklenmiyor. PNG, JPEG veya WebP kullanın.');
    return { buffer: Buffer.from(image.b64_json, 'base64'), ext };
  }
  if (provider === 'gemini') {
    const parts = [{ text: instruction }, ...references.map(x => ({ inlineData: { mimeType: x.mime, data: x.buffer.toString('base64') } }))];
    const r = await request(`${p.base}/models/${encodeURIComponent(model || p.imageModel)}:generateContent`, jsonPost({ 'x-goog-api-key': key }, { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }));
    const image = r.candidates?.[0]?.content?.parts?.find(x => x.inlineData?.data)?.inlineData;
    if (!image) throw new Error('Model görsel üretmedi. Görsel destekleyen bir model seçin.');
    return { buffer: Buffer.from(image.data, 'base64'), ext: image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType === 'image/webp' ? 'webp' : 'png' };
  }
  let opts;
  if (references.length) {
    const form = new FormData();
    form.append('model', model || p.imageModel); form.append('prompt', instruction); form.append('size', '1536x1024');
    for (const ref of references) form.append('image[]', new Blob([ref.buffer], { type: ref.mime }), `reference.${ref.mime.split('/')[1]}`);
    opts = { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form };
  } else opts = jsonPost({ Authorization: `Bearer ${key}` }, { model: model || p.imageModel, prompt: instruction, size: '1536x1024', n: 1 });
  const r = await request(`${p.base}/images/${references.length ? 'edits' : 'generations'}`, opts);
  if (!r.data?.[0]?.b64_json) throw new Error('Model görsel döndürmedi. GPT Image uyumlu bir model kullanın.');
  return { buffer: Buffer.from(r.data[0].b64_json, 'base64'), ext: 'png' };
}
function createOAuth({ clientId, clientSecret, openExternal, timeoutMs = 180000, scope = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly' }) {
  if (!clientId) return Promise.reject(new Error('Ayarlar bölümünde Google Masaüstü OAuth istemci kimliğini girin.'));
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(32).toString('hex');
    const verifier = crypto.randomBytes(48).toString('base64url');
    let redirect, timer, finished = false;
    const finish = (err, data) => { if (finished) return; finished = true; clearTimeout(timer); server.close(); err ? reject(err) : resolve(data); };
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
      if (url.searchParams.get('state') !== state) { res.writeHead(400); res.end('Gecersiz yetkilendirme durumu.'); return; }
      if (url.searchParams.has('error') || !url.searchParams.get('code')) { res.end('Baglanti iptal edildi.'); finish(new Error('YouTube bağlantısı iptal edildi.')); return; }
      try {
        const body = new URLSearchParams({ client_id: clientId, code: url.searchParams.get('code'), code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirect });
        if (clientSecret) body.set('client_secret', clientSecret);
        const tokens = await request('https://oauth2.googleapis.com/token', { method: 'POST', body });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<body style="background:#101014;color:#f4f4f5;font:20px system-ui;padding:80px"><h1>Bağlantı tamamlandı.</h1>PromptStudio’ya dönebilirsiniz.</body>');
        finish(null, { ...tokens, expiresAt: Date.now() + tokens.expires_in * 1000 });
      } catch (e) { res.end('Baglanti tamamlanamadi. Uygulamaya donun.'); finish(e); }
    });
    server.on('error', e => finish(e));
    server.listen(0, '127.0.0.1', () => {
      redirect = `http://127.0.0.1:${server.address().port}/callback`;
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope, state, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' });
      timer = setTimeout(() => finish(new Error('Bağlantı süresi doldu. Tekrar deneyin.')), timeoutMs);
      Promise.resolve(openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)).catch(e => finish(e));
    });
  });
}
async function refreshOAuth(tokens, clientId, clientSecret) {
  if (tokens.expiresAt > Date.now() + 60000) return tokens;
  if (!tokens.refresh_token) throw new Error('YouTube bağlantınızın süresi doldu. Yeniden bağlanın.');
  const body = new URLSearchParams({ client_id: clientId, refresh_token: tokens.refresh_token, grant_type: 'refresh_token' });
  if (clientSecret) body.set('client_secret', clientSecret);
  const r = await request('https://oauth2.googleapis.com/token', { method: 'POST', body });
  return { ...tokens, ...r, expiresAt: Date.now() + r.expires_in * 1000 };
}
async function channelData(token) {
  const headers = { Authorization: `Bearer ${token}` };
  const end = new Date(); end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 27);
  const iso = d => d.toISOString().slice(0, 10);
  const channels = await request('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true', { headers });
  const channel = channels.items?.[0];
  if (!channel) throw new Error('Bu Google hesabında YouTube kanalı bulunamadı.');
  const params = new URLSearchParams({ ids: 'channel==MINE', startDate: iso(start), endDate: iso(end), metrics: 'views,estimatedMinutesWatched,subscribersGained,averageViewDuration', dimensions: 'day', sort: 'day' });
  const reports = await request(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, { headers });
  const playlist = channel.contentDetails?.relatedPlaylists?.uploads;
  let videos = [];
  if (playlist) {
    const list = await request(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=30&playlistId=${encodeURIComponent(playlist)}`, { headers });
    const ids = (list.items || []).map(x => x.contentDetails.videoId).join(',');
    if (ids) videos = (await request(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(ids)}`, { headers })).items || [];
  }
  return { name: channel.snippet.title, statistics: channel.statistics, reports, videos, period: { start: iso(start), end: iso(end) }, syncedAt: new Date().toISOString(), limitation: 'API saatlik izleyici çevrimiçi tablosunu sağlamaz. Yayın saati önerileri kesin en iyi saat değildir; geçmiş yayın saatleri ve toplam performanstan çıkarılan deney önerileridir. Video yaşları farklıdır ve nedensellik göstermez. Günlük raporların zaman dilimi YouTube raporlama standardıdır.' };
}
function newerVersion(current, tag) {
  if (!/^v?\d+\.\d+\.\d+$/.test(tag)) return false;
  const a = current.split('.').map(Number), b = tag.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (b[i] !== a[i]) return b[i] > a[i]; }
  return false;
}
async function checkUpdate(repo, version) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('GitHub deposunu kullanici/depo biçiminde girin.');
  const r = await request(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'PromptStudio' } });
  return { available: newerVersion(version, r.tag_name), version: r.tag_name, url: `https://github.com/${repo}/releases/latest`, notes: r.body || '' };
}
async function connectOpenRouter(openExternal, timeoutMs = 180000) {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const state = crypto.randomBytes(32).toString('hex');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const controller = new AbortController();
  let timer;
  let server;
  let exchanging = false;
  try {
    return await new Promise((resolve, reject) => {
      server = http.createServer(async (req, res) => {
        const callback = new URL(req.url, 'http://localhost');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        const code = callback.searchParams.get('code');
        if (req.method !== 'GET' || callback.pathname !== '/callback' ||
            callback.searchParams.get('state') !== state || !code || exchanging) {
          res.writeHead(400).end('Geçersiz OpenRouter bağlantı isteği.');
          return;
        }
        exchanging = true;
        try {
          const result = await request('https://openrouter.ai/api/v1/auth/keys', {
            ...jsonPost({}, { code, code_verifier: verifier, code_challenge_method: 'S256' }),
            signal: controller.signal
          });
          if (typeof result.key !== 'string' || !result.key.trim()) throw new Error('OpenRouter bağlantıyı tamamlayamadı.');
          res.end('OpenRouter yetkilendirildi. PromptStudio’ya dönebilirsin.');
          resolve(result.key);
        } catch {
          res.writeHead(502).end('Yetkilendirme tamamlanamadı. PromptStudio’dan tekrar dene.');
          reject(new Error('OpenRouter yetkilendirmesi tamamlanamadı.'));
        }
      });
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const params = new URLSearchParams({
          callback_url: `http://localhost:${server.address().port}/callback`,
          code_challenge: challenge, code_challenge_method: 'S256', state, key_label: 'PromptStudio'
        });
        Promise.resolve().then(() => openExternal(`https://openrouter.ai/auth?${params}`)).catch(reject);
      });
      timer = setTimeout(() => reject(new Error('OpenRouter bağlantı süresi doldu. Tekrar deneyin.')), timeoutMs);
    });
  } finally {
    clearTimeout(timer);
    controller.abort();
    server?.close();
  }
}
function parseCoverConcepts(text) {
  let concepts;
  try { concepts = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).concepts; }
  catch { throw new Error('Sağlayıcı geçerli kapak konsepti döndürmedi.'); }
  const lengths = { name: 60, title: 100, overlay: 42, prompt: 1400 };
  if (!Array.isArray(concepts) || concepts.length !== 3 || concepts.some(concept =>
    !concept || Object.keys(lengths).some(key => typeof concept[key] !== 'string' || !concept[key].trim()))) {
    throw new Error('Sağlayıcı üç eksiksiz kapak konsepti döndürmedi.');
  }
  return concepts.map(concept => Object.fromEntries(Object.entries(lengths).map(([key, length]) => [key, concept[key].trim().slice(0, length)])));
}
module.exports = { PROVIDERS, request, textAI, parseContent, parseCoverConcepts, imageAI, createOAuth, refreshOAuth, channelData, newerVersion, checkUpdate, connectOpenRouter };
