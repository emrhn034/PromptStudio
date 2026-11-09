const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');

const platforms = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' };
const mimeTypes = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };

function videoFile(file, platform) {
  const mime = mimeTypes[path.extname(file || '').toLowerCase()];
  const info = file && fs.statSync(file, { throwIfNoEntry: false });
  if (!mime || !info?.isFile() || !info.size) throw new Error('Geçerli bir video dosyası seçin.');
  if (platform === 'tiktok' && info.size > 4 * 1024 ** 3) throw new Error('TikTok videosu en fazla 4 GB olabilir.');
  return { file, mime, size: info.size, modifiedAt: info.mtimeMs };
}

function reelUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Herkese açık bir HTTPS video adresi girin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Herkese açık bir HTTPS video adresi girin.');
  return url.href;
}

function chunkPlan(size) {
  const chunkSize = Math.min(size, 32 * 1024 ** 2);
  return { chunkSize, count: Math.floor(size / chunkSize) };
}

async function send(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(180000), ...options });
  } catch {
    throw new Error('Platform yanıt vermedi. Yeniden göndermeden önce hesabındaki gönderileri kontrol et.');
  }
  if (!res.ok && res.status !== 308) throw new Error(`Platform isteği reddetti (HTTP ${res.status}). Hesap yetkisini ve medya koşullarını kontrol et.`);
  return res;
}

async function json(url, token, data) {
  const options = { headers: { Authorization: `Bearer ${token}` } };
  if (data) {
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }
  const result = await (await send(url, options)).json();
  if (result.error?.code && result.error.code !== 'ok') throw new Error('Platform isteği reddetti. Hesap yetkisini ve medya koşullarını kontrol et.');
  return result;
}

async function accountIdentity(platform, token) {
  if (platform === 'youtube') {
    const result = await json('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', token);
    const channel = result.items?.[0];
    if (!channel?.id) throw new Error('Bağlı YouTube kanalı bulunamadı.');
    return { id: channel.id, name: channel.snippet.title };
  }
  if (platform === 'instagram') {
    const result = await json('https://graph.instagram.com/v25.0/me?fields=user_id,username', token);
    if (!/^\d+$/.test(result.user_id) || !result.username) throw new Error('Profesyonel Instagram hesabı bulunamadı.');
    return { id: String(result.user_id), name: result.username };
  }
  const result = await json('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', token);
  const user = result.data?.user;
  if (!user?.open_id) throw new Error('TikTok hesabı doğrulanamadı. user.info.basic iznini kontrol et.');
  return { id: user.open_id, name: user.display_name };
}

async function transfer(url, media, chunkSize, count, mime = media.mime) {
  const file = await fs.promises.open(media.file, 'r');
  try {
    let result;
    for (let i = 0, offset = 0; i < count; i++) {
      const length = i === count - 1 ? media.size - offset : chunkSize;
      const body = Buffer.alloc(length);
      const read = await file.read(body, 0, length, offset);
      if (read.bytesRead !== length) throw new Error('Video dosyası aktarım sırasında değişti.');
      result = await send(url, { method: 'PUT', headers: {
        'Content-Type': mime, 'Content-Length': String(length),
        'Content-Range': `bytes ${offset}-${offset + length - 1}/${media.size}`
      }, body });
      if (result.status === 308) {
        const range = result.headers.get('range');
        if (i === count - 1 || range !== `bytes=0-${offset + length - 1}`) throw new Error('Platform yüklemenin tamamını almadı.');
      } else if (i < count - 1 && result.status !== 206) throw new Error('Platform beklenmeyen aktarım yanıtı verdi.');
      offset += length;
    }
    return result;
  } finally {
    await file.close();
  }
}

function checkedUrl(value, host) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || !host.test(url.hostname)) throw new Error('Platform geçerli bir yükleme adresi döndürmedi.');
  return url.href;
}

async function publishYouTube(job, token, media, coverPath) {
  const init = await send('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=false', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Length': String(media.size), 'X-Upload-Content-Type': media.mime },
    body: JSON.stringify({
      snippet: { title: job.title, description: job.description, tags: job.tags, categoryId: '22' },
      status: { privacyStatus: job.visibility, selfDeclaredMadeForKids: job.madeForKids }
    })
  });
  const url = checkedUrl(init.headers.get('location'), /^(?:[\w-]+\.)*googleapis\.com$/);
  const size = 8 * 1024 ** 2;
  const response = await transfer(url, media, size, Math.ceil(media.size / size));
  const video = await response.json();
  if (!video.id) throw new Error('YouTube bir video kimliği döndürmedi. Kanalını kontrol et.');
  let notice = 'YouTube videoyu kabul etti. İşleme durumunu YouTube Studio’da kontrol edebilirsin.';
  if (coverPath) {
    try {
      const cover = await fs.promises.readFile(coverPath);
      if (cover.length > 2 * 1024 ** 2) throw new Error('Kapak boyutu');
      await send(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?uploadType=media&videoId=${encodeURIComponent(video.id)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': coverPath.endsWith('.png') ? 'image/png' : 'image/jpeg' }, body: cover
      });
    } catch {
      notice += ' Kapak uygulanamadı. YouTube Studio’da ekleyebilirsin.';
    }
  }
  return { status: 'sent', remoteId: video.id, notice };
}

async function publishInstagram(job, token) {
  const base = 'https://graph.instagram.com/v25.0';
  const container = await json(`${base}/${encodeURIComponent(job.account.id)}/media`, token, {
    media_type: 'REELS', video_url: reelUrl(job.videoUrl), caption: job.description
  });
  if (!container.id) throw new Error('Instagram video kapsayıcısı oluşturamadı.');
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await json(`${base}/${encodeURIComponent(container.id)}?fields=status_code`, token);
    if (result.status_code === 'FINISHED') {
      const published = await json(`${base}/${encodeURIComponent(job.account.id)}/media_publish`, token, { creation_id: container.id });
      if (!published.id) throw new Error('Instagram gönderi kimliği döndürmedi. Hesabını kontrol et.');
      return { status: 'sent', remoteId: published.id, notice: 'Instagram Reels gönderisi oluşturuldu.' };
    }
    if (['ERROR', 'EXPIRED'].includes(result.status_code)) throw new Error('Instagram videoyu işleyemedi.');
    await sleep(15000);
  }
  throw new Error('Instagram videoyu beklenen sürede işlemedi. Gönderiyi yeniden oluşturmadan önce hesabını kontrol et.');
}

async function uploadTikTok(job, token, media) {
  const { chunkSize, count } = chunkPlan(media.size);
  const result = await json('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', token, {
    source_info: { source: 'FILE_UPLOAD', video_size: media.size, chunk_size: chunkSize, total_chunk_count: count }
  });
  const upload = result.data;
  if (!upload?.publish_id) throw new Error('TikTok bir yükleme kimliği döndürmedi.');
  const url = checkedUrl(upload.upload_url, /^(?:[\w-]+\.)+tiktokapis\.com$/);
  const response = await transfer(url, media, chunkSize, count);
  if (response.status !== 201) throw new Error('TikTok aktarımın tamamlandığını doğrulamadı.');
  return { status: 'sent', remoteId: upload.publish_id, notice: 'Video TikTok’a gönderildi. TikTok gelen kutusundaki bildirimden metni ekleyip paylaşımı tamamla.' };
}

module.exports = { platforms, videoFile, reelUrl, chunkPlan, accountIdentity, publishYouTube, publishInstagram, uploadTikTok };
