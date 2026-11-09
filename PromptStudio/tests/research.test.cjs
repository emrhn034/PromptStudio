const { test } = require('node:test');
const assert = require('node:assert/strict');
const { videoReports, searchEvidence, parseIdeas } = require('../desktop/research.cjs');

function mockFetch(t, handler) {
  const original = global.fetch;
  global.fetch = handler;
  t.after(() => { global.fetch = original; });
}

test('Video raporları aynı video filtresini kullanır ve kısmi sonucu gösterir', async t => {
  mockFetch(t, async (url, options) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get('filters'), 'video==abcdefghijk');
    assert.equal(params.get('startDate'), '2026-10-01');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    if (params.get('dimensions') === 'elapsedVideoTimeRatio') return Response.json({ rows: [[0.1, 1.04]] });
    assert.equal(params.get('dimensions'), 'insightTrafficSourceType');
    return Response.json({ error: { message: 'Rapor kullanılamıyor' } }, { status: 403 });
  });
  const result = await videoReports('test-token', 'abcdefghijk', { start: '2026-10-01', end: '2026-10-28' });
  assert.deepEqual(result.retention.rows, [[0.1, 1.04]]);
  assert.match(result.traffic.error, /403/);
});

test('Fikir araştırması resmi arama sonucunu yorumlarla eşleştirir', async t => {
  mockFetch(t, async (url, options) => {
    const api = new URL(url);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    if (api.pathname.endsWith('/search')) {
      assert.equal(api.searchParams.get('q'), '3D yazıcı');
      return Response.json({ items: [{ id: { videoId: 'abcdefghijk' }, snippet: { title: 'Kurulum', channelTitle: 'Kanal' } }] });
    }
    assert.equal(api.searchParams.get('videoId'), 'abcdefghijk');
    return Response.json({ items: [{ snippet: { topLevelComment: { id: 'comment1', snippet: { textDisplay: 'Nozul ayarı nasıl yapılır?' } } } }] });
  });
  const result = await searchEvidence(' 3D yazıcı ', { token: 'test-token' });
  assert.equal(result.sources[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(result.sources[0].comments[0].id, 'comment1');
  assert.equal(result.incompleteComments, false);
});

test('Yapay zekâ tarafından uydurulan kaynaklar projeye taşınmaz', () => {
  const idea = { title: 'Nozul ayarı', reason: 'Yorumdaki soru', brief: 'Üç adımı göster' };
  const valid = parseIdeas(JSON.stringify({ ideas: [{ ...idea, sources: [1, 9, 1] }, { ...idea, sources: [7] }] }), 2);
  assert.deepEqual(valid, [{ ...idea, sources: [1] }]);
  assert.throws(() => parseIdeas('JSON yok', 2));
});
