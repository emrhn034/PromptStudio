const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../desktop/store.cjs');
const { videoFile, reelUrl, chunkPlan, publishYouTube, publishInstagram, uploadTikTok } = require('../desktop/publishing.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'promptstudio-publication-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'test.mp4');
  fs.writeFileSync(file, 'mock-video');
  return { directory, media: videoFile(file) };
}

function mockFetch(t, handler) {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options, calls.length);
  };
  return calls;
}

test('Eski kütüphanede kuyruk açılır ve tarih ile hedef hesap diskte saklanır', t => {
  const { directory } = fixture(t);
  fs.writeFileSync(path.join(directory, 'library.json'), JSON.stringify({ schema: 1, projects: [{ id: 'original' }] }));
  const store = new Store(directory);
  assert.deepEqual(store.state.publications, []);
  store.save('publications', { account: { id: 'channel' }, status: 'queued', scheduledAt: '2027-01-01T09:00:00.000Z' });
  const reopened = new Store(directory);
  assert.equal(reopened.state.projects[0].id, 'original');
  assert.equal(reopened.state.publications[0].account.id, 'channel');
  assert.equal(reopened.state.publications[0].scheduledAt, '2027-01-01T09:00:00.000Z');
});

test('YouTube başlık, açıklama, etiket ve gizlilik seçimiyle video yükler', async t => {
  const { media } = fixture(t);
  const requests = mockFetch(t, (_url, _options, n) => n === 1
    ? new Response(null, { headers: { location: 'https://www.googleapis.com/session' } })
    : Response.json({ id: 'video-id' }));
  const job = { title: 'Deneme', description: 'Açıklama', tags: ['etiket'], visibility: 'private', madeForKids: false };
  const result = await publishYouTube(job, 'test-token', media);
  assert.equal(result.remoteId, 'video-id');
  const metadata = JSON.parse(requests[0].options.body);
  assert.equal(metadata.status.privacyStatus, 'private');
  assert.equal(metadata.status.selfDeclaredMadeForKids, false);
  assert.deepEqual(metadata.snippet.tags, ['etiket']);
  assert.equal(requests[1].options.headers['Content-Range'], 'bytes 0-9/10');
  assert.equal(requests[1].options.body.toString(), 'mock-video');
});

test('Instagram videoyu hazır bildirimi geldikten sonra yayımlar', async t => {
  const responses = [{ id: 'container' }, { status_code: 'FINISHED' }, { id: 'reel' }];
  const calls = mockFetch(t, (_url, _options, n) => Response.json(responses[n - 1]));
  const result = await publishInstagram({ account: { id: '123' }, videoUrl: 'https://example.test/reel.mp4', description: 'Reel' }, 'test-token');
  assert.equal(result.remoteId, 'reel');
  assert.equal(JSON.parse(calls[0].options.body).media_type, 'REELS');
  assert.equal(JSON.parse(calls[2].options.body).creation_id, 'container');
  assert.throws(() => reelUrl('file:///local/reel.mp4'));
});

test('TikTok dosyayı gelen kutusuna gönderir ve kimliği kaydeder', async t => {
  const { media } = fixture(t);
  const calls = mockFetch(t, (_url, _options, n) => n === 1
    ? Response.json({ data: { publish_id: 'inbox-id', upload_url: 'https://open-upload.tiktokapis.com/video/' }, error: { code: 'ok' } })
    : new Response(null, { status: 201 }));
  const result = await uploadTikTok({}, 'test-token', media);
  assert.equal(result.remoteId, 'inbox-id');
  assert.match(calls[0].url, /inbox\/video\/init/);
  assert.equal(JSON.parse(calls[0].options.body).source_info.total_chunk_count, 1);
  assert.equal(calls[1].options.headers['Content-Length'], String(media.size));
  assert.deepEqual(chunkPlan(70 * 1024 ** 2), { chunkSize: 32 * 1024 ** 2, count: 2 });
});
