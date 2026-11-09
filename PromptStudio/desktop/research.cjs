const { request } = require('./services.cjs');

const videoId = value => /^[A-Za-z0-9_-]{11}$/.test(value || '');

async function videoReports(token, id, period) {
  if (!videoId(id)) throw new Error('Geçerli bir video seç.');
  const headers = { Authorization: `Bearer ${token}` };
  const query = fields => request(`https://youtubeanalytics.googleapis.com/v2/reports?${new URLSearchParams({
    ids: 'channel==MINE', startDate: period.start, endDate: period.end, filters: `video==${id}`, ...fields
  })}`, { headers });
  const results = await Promise.allSettled([
    query({ dimensions: 'elapsedVideoTimeRatio', metrics: 'audienceWatchRatio', sort: 'elapsedVideoTimeRatio' }),
    query({ dimensions: 'insightTrafficSourceType', metrics: 'views,estimatedMinutesWatched', sort: '-views' })
  ]);
  return Object.fromEntries(['retention', 'traffic'].map((name, i) => {
    const result = results[i];
    return [name, result.status === 'fulfilled' ? { rows: result.value.rows || [] } : { error: result.reason.message }];
  }));
}

async function searchEvidence(topic, { token, key }) {
  const query = String(topic || '').trim();
  if (!query || query.length > 160) throw new Error('1–160 karakterlik bir konu yaz.');
  if (!token && !key) throw new Error('Kanal Analizi’nden YouTube hesabını bağla veya Fikir Laboratuvarı’na bir Data API anahtarı ekle.');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const get = (endpoint, fields) => {
    const params = new URLSearchParams(fields);
    if (!token) params.set('key', key);
    return request(`https://www.googleapis.com/youtube/v3/${endpoint}?${params}`, { headers });
  };
  const search = await get('search', { part: 'snippet', type: 'video', q: query, maxResults: '6' });
  const videos = (search.items || []).filter(item => videoId(item.id?.videoId));
  const comments = await Promise.allSettled(videos.slice(0, 3).map(item => get('commentThreads', {
    part: 'snippet', videoId: item.id.videoId, maxResults: '5', order: 'relevance', textFormat: 'plainText'
  })));
  const sources = videos.map((item, index) => ({
    id: item.id.videoId, title: item.snippet.title, channel: item.snippet.channelTitle,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    comments: (comments[index]?.value?.items || []).map(thread => {
      const comment = thread.snippet.topLevelComment;
      return { text: comment.snippet.textDisplay.slice(0, 350), id: comment.id };
    })
  }));
  return { query, sources, incompleteComments: comments.some(result => result.status === 'rejected') };
}

function parseIdeas(text, sourceCount) {
  let ideas;
  try { ideas = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).ideas; }
  catch { throw new Error('Yapay zekâ geçerli fikir verisi döndürmedi. Tekrar dene.'); }
  if (!Array.isArray(ideas)) throw new Error('Yapay zekâ fikir listesi döndürmedi.');
  const valid = ideas.filter(idea => idea && ['title', 'reason', 'brief'].every(key => typeof idea[key] === 'string' && idea[key].trim())
    && Array.isArray(idea.sources)).map(idea => ({
    title: idea.title.trim().slice(0, 100),
    reason: idea.reason.trim().slice(0, 750),
    brief: idea.brief.trim().slice(0, 1500),
    sources: [...new Set(idea.sources.filter(i => Number.isInteger(i) && i >= 1 && i <= sourceCount))]
  })).filter(idea => idea.sources.length).slice(0, 5);
  if (!valid.length) throw new Error('Yapay zekâ doğrulanabilir kaynak içeren fikir döndürmedi.');
  return valid;
}

module.exports = { videoReports, searchEvidence, parseIdeas };
