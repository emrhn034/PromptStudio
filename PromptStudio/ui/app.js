'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  projects: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L4 21"/>',
  chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  settings: '<path d="m9 3-.5 3-2 1.2-2.8-1.1L1 11l2.5 2v2L2 17l3 4 3-1 2 1 .5 2h5l.5-3 2-1 3 1 2-5-2-2v-2l2-2-3-4-3 1-2-1-.5-3Z" transform="translate(1 0) scale(.9)"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4"/>',
  folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 4V3H3v13h1"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  chat: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z"/><path d="M7 8h10M7 12h7"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/>',
  text: '<path d="M4 4h16M12 4v16M8 20h8"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
const assetURL = id => id ? `studio://app/assets/${encodeURIComponent(id)}` : '';
let state, route = 'home', project = null, activeTab = 'text', filterFolder = '', query = '', saveQueue = Promise.resolve(), debounce, toastTimer, pending = new Set();
let canvasImages = new Map();
const roles = ['Kapakta kullanılacak kişi', 'Ürün', 'Logo', 'Stil örneği', 'Arka plan'];
async function call(name, ...args) {
  if (!window.studio) throw new Error('Bu ekranı BASLAT.bat üzerinden masaüstü uygulamasında açın.');
  const r = await window.studio.call(name, ...args);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
function toast(message, error = false) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').className = error ? 'error' : ''; $('#toast').style.display = 'block'; toastTimer = setTimeout(() => { $('#toast').style.display = 'none'; }, error ? 9000 : 4000); }
async function run(name, button, fn) {
  if (pending.has(name)) return;
  pending.add(name); const old = button?.innerHTML;
  if (button) { button.disabled = true; button.classList.add('loading'); button.textContent = 'İşleniyor…'; }
  try { return await fn(); } catch (e) { toast(e.message, true); }
  finally { pending.delete(name); if (button?.isConnected) { button.disabled = false; button.classList.remove('loading'); button.innerHTML = old; } }
}
async function refresh() { state = await call('state'); applyTheme(); renderNavigation(); }
function applyTheme() { const light = state.settings.theme === 'light' || state.settings.theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches; document.body.classList.toggle('light', light); }
function renderNavigation() {
  const nav = [['home', 'home', 'Genel bakış'], ['projects', 'projects', 'İçeriklerim'], ['library', 'image', 'Görsel kütüphanesi'], ['analytics', 'chart', 'Kanal analizi'], ['profiles', 'profile', 'Kanal profilleri']];
  nav.push(['publications', 'youtube', 'Yayın kuyruğu']);
  nav.push(['ideas', 'spark', 'Fikir laboratuvarı']);
  $('#navigation').innerHTML = nav.map(([id, i, title]) => `<button class="nav-item ${route === id || route === 'studio' && id === 'projects' ? 'active' : ''}" data-route="${id}"><span class="nav-icon">${icon(i)}</span>${title}${id === 'projects' ? `<span class="nav-count">${state.projects.length}</span>` : ''}</button>`).join('');
  $('#folder-nav').innerHTML = state.folders.length ? state.folders.map(f => `<button class="nav-item" data-folder="${esc(f.id)}"><span class="folder-dot"></span>${esc(f.name)}<span class="nav-count">${state.projects.filter(p => p.folderId === f.id).length}</span></button>`).join('') : '<div class="muted" style="font-size:10px;padding:0 12px">Serilerine kendi alanını aç.</div>';
  document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = icon(e.dataset.icon); });
}
function heading(title, subtitle, action = '') { return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }
function empty(title, text, action = '', i = 'projects') { return `<div class="empty-state">${icon(i)}<h3>${title}</h3><p>${text}</p>${action}</div>`; }
const newButton = '<button class="button primary" data-action="new-project">＋ Yeni içerik</button>';
function formatDate(d) { return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); }
function folderName(id) { return state.folders.find(x => x.id === id)?.name || 'Koleksiyonsuz'; }
function chosenTitle(p) {
  return p.titles?.[p.selectedTitle]?.trim() || p.titles?.find(title => title.trim()) || '';
}
function projectProgress(p) {
  if (p.quickStart && (!chosenTitle(p) || !p.coverId)) return { tab: 'quick', label: 'Video paketi hazırlanıyor' };
  if (!chosenTitle(p)) return { tab: 'text', label: 'Başlık bekliyor' };
  if (!p.description?.trim() || !p.tags?.length) return { tab: 'text', label: 'Başlık hazır · Metin paketi eksik' };
  if (!p.coverId || p.coverDirty) return { tab: 'cover', label: p.coverDirty ? 'Metin hazır · Kapak onayı bekliyor' : 'Metin hazır · Kapak seçilmedi' };
  return { tab: 'delivery', label: 'İçerik paketi hazır' };
}
function projectCard(p) {
  return `<article class="panel project-card" data-project="${p.id}" tabindex="0" role="button">
    <div class="project-cover">${p.coverId ? `<img src="${assetURL(p.coverId)}" alt="Proje kapağı">` : icon('image')}<span class="pill">${esc(folderName(p.folderId))}</span></div>
    <div class="project-info"><h3>${esc(p.name)}</h3><p>${esc((p.brief || 'Fikrini yaz, üretmeye başla.').slice(0, 90))}</p>
    <div class="project-meta"><span>${esc(projectProgress(p).label)}</span><span>${formatDate(p.updatedAt)}</span></div><span class="text-button">Devam et →</span></div></article>`;
}
function renderHome() {
  const configured = Object.values(state.keys).some(Boolean);
  $('#content').innerHTML = `${heading('Hoş geldin, üretici.', 'Yeni fikirler, daha güçlü içerikler. Bugün ne üretiyoruz?', `<span class="pill">${state.projects.length} içerik · ${state.assets.length} görsel</span>`)}
    <section class="hero"><div class="hero-copy"><div class="eyebrow">${icon('spark')} FİKİRDEN YAYINA, SENİN STÜDYON</div><h2>Bir sonraki harika içerik<br><em>senin fikrinle başlar.</em></h2><p>Başlık, açıklama, etiket ve dikkat çeken kapaklar.<br>Yapay zekâyla üret, kendi tarzınla son dokunuşu yap.</p><button class="button primary" data-action="new-project">İçerik oluşturmaya başla ${icon('arrow')}</button></div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="orbit second"></div><div class="floating top"><span>✦</span> Bir fikir, birçok olasılık.</div><div class="art-card"><small>SIRADAKİ VİDEON</small><strong>İYİ FİKİRLER<br>İZ BIRAKIR.</strong></div><div class="floating bottom"><span>✓</span> Senin tarzın. Senin imzan.</div></div></section>
    <section class="quick-grid"><button class="quick-card" data-action="new-project"><span class="feature-icon">${icon('text')}</span><div><h3>Kelimelerin gücünü kullan</h3><p>Başlık, açıklama ve etiketleri<br>tek bir fikirden oluştur.</p></div><span class="arrow">↗</span></button><button class="quick-card" data-route="library"><span class="feature-icon purple">${icon('image')}</span><div><h3>İlk bakışta dikkat çek</h3><p>Referanslarını biriktir,<br>kapaklarına karakter kat.</p></div><span class="arrow">↗</span></button><button class="quick-card" data-route="analytics"><span class="feature-icon orange">${icon('chart')}</span><div><h3>Kanalının sesini dinle</h3><p>Verilerini anlamlandır,<br>sonraki adımını birlikte planla.</p></div><span class="arrow">↗</span></button></section>
    <div class="bottom-grid"><section><div class="section-head"><h2>Kaldığın yerden devam et <span class="badge-number">${state.projects.length}</span></h2><button class="text-button" data-route="projects">Tüm içerikler ↗</button></div><div class="panel">${state.projects.length ? state.projects.slice(0, 3).map(p => `<div class="mini-project" data-project="${p.id}" role="button" tabindex="0"><div class="mini-cover">${p.coverId ? `<img src="${assetURL(p.coverId)}" alt="">` : icon('image')}</div><div><strong>${esc(p.name)}</strong><small>${esc(projectProgress(p).label)} · ${formatDate(p.updatedAt)}</small></div><span class="arrow">Devam et ↗</span></div>`).join('') : empty('İlk fikrine yer açalım.', 'Oluşturduğun içerikler burada seni bekleyecek. Bir seri başlat veya tek bir fikirle yola çık.', '<button class="button small" data-action="new-project">＋ İlk içeriğini oluştur</button>', 'folder')}</div></section><section><div class="section-head"><h2>Stüdyonu kişiselleştir</h2><span class="pill purple">SANA ÖZEL</span></div><div class="panel insight"><span class="pill lime">${configured ? 'BİR SONRAKİ ADIM' : 'HIZLI BAŞLANGIÇ'}</span><h3>${configured ? 'Her içerikte aynı imza.' : 'Yaratıcılık sende.<br>Model seçimi de.'}</h3><p>${configured ? 'Kanalının dilini, hedef kitleni ve görsel tarzını bir profile kaydet. Her projede yeniden anlatman gerekmesin.' : 'Kendi API anahtarını ekle, çalışmak istediğin yapay zekâyı seç. Uygulama ücretsiz; servis kullanımı kendi hesabından karşılanır.'}</p><button class="button small subtle" data-route="${configured ? 'profiles' : 'settings'}">${configured ? 'Kanal profili oluştur' : 'Yapay zekâ bağlantılarını kur'} ${icon('arrow')}</button></div></section></div><div class="status-strip"><span>${icon('lock')} Yerel kütüphane</span><span>${icon('check')} Üyelik gerekmez</span><span>${icon('spark')} Kendi API anahtarların</span></div>`;
  const start = $('.hero-copy [data-action="new-project"]');
  start.dataset.action = 'quick-project';
  start.textContent = 'Kapak ve metin hazırla →';
}
function renderProjects() {
  const folder = state.folders.find(x => x.id === filterFolder);
  const items = state.projects.filter(p => (!filterFolder || p.folderId === filterFolder) && `${p.name} ${p.brief}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
  $('#content').innerHTML = `${heading(esc(folder?.name || 'İçeriklerim'), 'Fikirlerini projelere, projelerini kendi serilerine dönüştür.', newButton)}<div class="toolbar"><input id="project-search" placeholder="İçeriklerinde ara…" value="${esc(query)}" aria-label="İçerik ara"><select id="folder-filter" style="width:210px"><option value="">Tüm koleksiyonlar</option>${state.folders.map(f => `<option value="${f.id}" ${filterFolder === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select><span class="spacer"></span><button class="button small" data-action="new-folder">＋ Koleksiyon</button>${folder ? `<button class="button small" data-action="edit-folder" data-id="${folder.id}">Koleksiyonu düzenle</button>` : ''}</div><div class="project-grid">${items.map(projectCard).join('')}</div>${!items.length ? `<div class="panel">${empty(query ? 'Eşleşen içerik yok.' : 'Bu alan senin fikirlerini bekliyor.', query ? 'Başka bir kelimeyle aramayı dene.' : 'Yeni bir içerik oluştur; konu metnini, kapaklarını ve tüm alternatiflerini birlikte sakla.', newButton, 'folder')}</div>` : ''}`;
}
function field(label, name, value = '', placeholder = '', type = 'input') { return `<div class="field"><label for="${name}">${label}</label>${type === 'textarea' ? `<textarea id="${name}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input id="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}">`}</div>`; }
function selectOptions(items, selected) { return items.map(x => `<option value="${esc(x.id)}" ${selected === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join(''); }
function renderStudio() {
  if (!project) { navigate('projects'); return; }
  const p = project;
  if (activeTab === 'quick') { renderQuickStudio(p); return; }
  $('#content').innerHTML = `<div class="page-heading studio-heading"><div><input id="project-name" aria-label="Proje adı" value="${esc(p.name)}"><div class="save-status" id="save-status">${icon('check')} Uygulama kütüphanesine kaydedildi</div></div><div class="inline-actions"><button class="button small" data-action="export-content">${icon('download')} Metni dışa aktar</button><button class="icon-button" title="Projeyi sil" data-action="delete-project">${icon('trash')}</button></div></div><div class="studio-layout"><section class="panel"><div class="panel-title"><h2><span class="number">01</span> İçeriğini anlat</h2><span class="pill lime">BAŞLANGIÇ NOKTASI</span></div>${field('Video ne hakkında?', 'brief', p.brief, 'Örn. Bir haftadır kullandığım telefonun kamerasını, pilini ve oyun performansını değerlendiriyorum.', 'textarea')}<div class="field-row"><div class="field"><label for="project-folder">Koleksiyon</label><select id="project-folder"><option value="">Koleksiyonsuz</option>${selectOptions(state.folders, p.folderId)}</select></div><div class="field"><label for="project-profile">Kanal profili <span class="optional">İsteğe bağlı</span></label><select id="project-profile"><option value="">Profil seçilmedi</option>${selectOptions(state.profiles, p.profileId)}</select></div></div><details ${p.audience || p.points ? 'open' : ''}><summary>İsteğe bağlı ayrıntılar</summary>${field('Hedef kitle', 'audience', p.audience, 'Bu videoyu kimler izlesin?')}${field('Anlatım tarzı', 'tone', p.tone, 'Samimi, eğlenceli, bilgilendirici…')}${field('Önemli noktalar / senaryo', 'points', p.points, 'Mutlaka değinilecek konular, kendi notların…', 'textarea')}</details><button class="button primary full-width" data-action="generate-content">${icon('spark')} Başlık, açıklama ve etiket üret</button><div class="welcome-note">${icon('spark')} ${esc(state.providers[state.settings.provider]?.name)} · ${esc(state.settings.models[state.settings.provider] || state.providers[state.settings.provider]?.model)}</div><div class="sidebar-line" style="margin:23px 0"></div><div class="panel-title"><h2>Kapak referansları</h2><span class="optional">İsteğe bağlı</span></div><p class="muted" style="font-size:11px">Kişi, ürün veya bir tasarım örneği ekle. Her görselin nasıl kullanılacağını sen belirle.</p><div class="refs">${(p.references || []).map(id => { const a = state.assets.find(x => x.id === id); return a ? `<div class="ref-thumb"><img src="${assetURL(id)}" alt="${esc(a.name)}"><button data-action="remove-ref" data-id="${id}" title="Referansı çıkar">×</button><span>${esc(a.role)}</span></div>` : ''; }).join('')}</div><div class="inline-actions"><button class="button small" data-action="pick-refs">${icon('image')} Kütüphaneden seç</button><button class="button small subtle" data-action="import-assets">＋ Görsel ekle</button></div><div class="hint">Referans görseller yalnızca kapak üretirken seçtiğin görsel sağlayıcısına gönderilir. Metin üretiminde görseller gönderilmez.</div></section><section class="panel"><div class="tabs"><button class="tab ${activeTab === 'text' ? 'active' : ''}" data-tab="text">İçerik metinleri</button><button class="tab ${activeTab === 'cover' ? 'active' : ''}" data-tab="cover">Kapak stüdyosu</button></div><div id="studio-output">${activeTab === 'text' ? renderTextOutput() : renderCoverOutput()}</div></section></div>`;
  if (activeTab === 'cover') {
    $('#studio-output').insertAdjacentHTML('afterbegin', coverConceptMarkup(p));
    $('#studio-output').insertAdjacentHTML('beforeend', coverComparisonControls());
    $('#studio-output').insertAdjacentHTML('beforeend', youtubePreviewMarkup(p));
    drawCover();
  }
  const tabs = $('.studio-layout .tabs');
  tabs.insertAdjacentHTML('beforeend', `<button class="tab ${activeTab === 'delivery' ? 'active' : ''}" data-tab="delivery">Yayına hazırla</button>`);
  if (activeTab === 'delivery') {
    $('#studio-output').innerHTML = deliveryMarkup(p);
    drawYouTubePreview(p);
  }
  const firstPanel = $('.studio-layout > section');
  firstPanel.insertAdjacentHTML('afterbegin', `<div class="inline-actions space-top"><span class="pill" id="project-progress">${esc(projectProgress(p).label)}</span>
    ${state.profiles.length ? '<button class="button small" data-action="series-template">Seri şablonu uygula</button>' : ''}</div>`);
  if (p.sourceVideo) firstPanel.insertAdjacentHTML('afterbegin', `<div class="hint">Kaynak video · ${esc(p.sourceVideo.title)}
    <button class="text-button" data-action="research-open-source" data-id="${esc(p.sourceVideo.id)}">YouTube’da aç ↗</button></div>`);
  if (activeTab === 'text') renderPackageControls();
}
function renderQuickStudio(p) {
  $('#content').innerHTML = `${heading('Kapak ve metin hazırla', 'Video konunu anlat, görsellerini ekle ve paketini oluştur.')}
    <section class="panel quick-create-panel">
      ${field('Video ne hakkında?', 'brief', p.brief, 'Örn. Uygun fiyatlı bir 3D yazıcıyı bir hafta denedim.', 'textarea')}
      ${state.profiles.length ? `<div class="field"><label for="quick-series">Seri şablonu</label><select id="quick-series"><option value="">Şablon seç</option>${selectOptions(state.profiles, p.profileId)}</select></div>` : ''}
      <h3>Referans görseller</h3>
      <p class="muted">Kendini, ürünü veya örnek almak istediğin kapak stilini ekle. ChatGPT üretiminde en fazla beş referans kullanabilirsin.</p>
      <div class="refs">${(p.references || []).map(id => {
        const asset = state.assets.find(item => item.id === id);
        return asset ? `<div class="ref-thumb"><img src="${assetURL(id)}" alt="${esc(asset.name)}"><button data-action="remove-ref" data-id="${esc(id)}" title="Referansı çıkar">×</button><span>${esc(asset.role)}</span></div>` : '';
      }).join('')}</div>
      <div class="inline-actions"><button class="button small" data-action="import-assets">＋ Görsel ekle</button><button class="button small" data-action="pick-refs">Kütüphaneden seç</button></div>
      <div class="inline-actions space-top">
        <button class="button primary" data-action="${state.settings.chatgptMode ? 'quick-generate' : 'chatgpt-connect'}">${state.settings.chatgptMode ? 'Kapak ve metin oluştur' : 'ChatGPT ile giriş yap'}</button>
        ${state.settings.chatgptMode ? '<button class="button small" data-action="chatgpt-connect">ChatGPT bağlantısı</button>' : ''}
        <button class="button small" data-tab="text">Ayrıntılı düzenleme</button>
        ${p.titles?.length ? '<button class="button small" data-tab="delivery">Hazır metinleri gör</button>' : ''}
      </div>
      <p class="muted" id="save-status">Taslak otomatik kaydedilir.</p>
    </section>`;
}
function renderPackageControls() {
  const p = project;
  const output = $('#studio-output');
  if (!output) return;
  $('#package-controls')?.remove();
  output.insertAdjacentHTML('afterbegin', `<div id="package-controls" class="inline-actions">
    ${p.titles?.length ? `<label for="chosen-title">Paketin başlığı</label><select id="chosen-title">${p.titles.map((title, i) => `<option value="${i}" ${i === (p.selectedTitle ?? p.titles.findIndex(value => value.trim())) ? 'selected' : ''}>${esc(title || 'Boş başlık')}</option>`).join('')}</select>` : ''}
    ${['title', 'description', 'tags'].map((part, i) => `<button class="button small" data-action="regenerate-part" data-id="${part}">${['Başlık öner', 'Açıklamayı yenile', 'Etiketleri yenile'][i]}</button>`).join('')}
    <button class="button small" data-tab="cover">Kapağa geç →</button>
  </div>`);
}
function deliveryMarkup(p) {
  return `<div class="panel-title"><h2>Yayın paketi</h2><span class="pill">${esc(projectProgress(p).label)}</span></div>
    ${youtubePreviewMarkup(p)}
    ${p.coverDirty ? '<p class="hint">Editördeki son değişiklikleri kullanmak için kapağı onayla.</p>' : ''}
    <h3>Seçili başlık</h3><p>${esc(chosenTitle(p) || 'Henüz seçilmedi.')}</p>
    <h3>Açıklama</h3><p class="delivery-description">${esc(p.description || 'Henüz yazılmadı.')}</p>
    <h3>Etiketler</h3><p>${esc((p.tags || []).join(', ') || 'Henüz eklenmedi.')}</p>
    <div class="inline-actions">
      <button class="button small" data-action="copy-package">Metni kopyala</button>
      <button class="button small" data-action="export-package">Metni indir</button>
      <button class="button small" data-action="delivery-cover">Kapak PNG indir</button>
      <button class="button primary" data-action="publish-project">Yayın kuyruğuna ekle</button>
    </div>`;
}
function coverConceptMarkup(p) {
  const concepts = p.coverConcepts || [];
  return `<section class="cover-concept-section">
    <div class="panel-title"><h2>Kapak fikrini seç</h2><button class="button primary small" data-action="cover-concepts">${concepts.length ? 'Yeni üç fikir öner' : 'Üç konsept öner'}</button></div>
    <p class="muted">Video konundan üç ayrı konsept hazırla. Birini seç, ardından sadece o görseli üret.</p>
    ${concepts.length ? `<div class="cover-concept-grid">${concepts.map((concept, index) => `<article class="panel ${p.coverConceptIndex === index ? 'cover-concept-selected' : ''}">
      <span class="pill">${'ABC'[index]}</span><h3>${esc(concept.name)}</h3>
      <strong>${esc(concept.title)}</strong><p class="muted">Kapak yazısı: ${esc(concept.overlay)}</p>
      <details><summary>Görsel fikri</summary><p>${esc(concept.prompt)}</p></details>
      <button class="button small" data-action="select-cover-concept" data-index="${index}">${p.coverConceptIndex === index ? 'Seçili' : 'Bu konsepti kullan'}</button>
    </article>`).join('')}</div>` : ''}
  </section>`;
}
function youtubePreviewMarkup(p) {
  const channelName = state.profiles.find(item => item.id === p.profileId)?.name || state.channel?.name || 'Kanalın';
  return `<section class="youtube-preview space-top">
    <h3>YouTube kartı önizlemesi</h3>
    <div class="youtube-preview-card">
      <canvas class="youtube-preview-canvas" width="1280" height="720" aria-label="Kapağın küçük boyuttaki görünümü"></canvas>
      <strong>${esc(chosenTitle(p) || p.name || 'Video başlığın')}</strong>
      <span class="muted">${esc(channelName)}</span>
    </div>
  </section>`;
}
async function drawYouTubePreview(p) {
  const canvas = $('.youtube-preview-canvas');
  if (!canvas) return;
  const editor = { ...defaultEditor(), ...p.editor };
  const saved = p.coverId && !p.coverDirty ? await loadCanvasImage(p.coverId) : null;
  if (!canvas.isConnected) return;
  if (saved) canvas.getContext('2d').drawImage(saved, 0, 0, 1280, 720);
  else {
    const [bg, logo] = await Promise.all([loadCanvasImage(editor.background ?? p.coverId), loadCanvasImage(editor.logo)]);
    if (canvas.isConnected) paintCover(canvas.getContext('2d'), editor, bg, logo);
  }
}
function renderTextOutput() {
  const p = project;
  if (!p.titles?.length && !p.description && !p.tags?.length) return empty('İyi bir başlıkla başla.', 'Soldaki alanda videonu anlat. Yapay zekâ, kanalının tarzına uygun alternatifleri burada hazırlasın.', '<span class="pill">Tüm sonuçlar düzenlenebilir</span>', 'text');
  return `<div class="panel-title"><h2>Başlık alternatifleri</h2><span class="pill">${p.titles?.length || 0} SEÇENEK</span></div>${(p.titles || []).map((t, i) => `<div class="title-option"><span class="index">0${i + 1}</span><textarea data-title-index="${i}" aria-label="Başlık ${i + 1}" maxlength="100">${esc(t)}</textarea><button class="icon-button" data-action="copy-title" data-index="${i}" title="Başlığı kopyala">${icon('copy')}</button></div>`).join('')}<div class="section-head"><h2>Açıklama</h2><button class="text-button" data-action="copy-description">Kopyala ↗</button></div><textarea id="description" style="min-height:200px" maxlength="5000" aria-label="Video açıklaması">${esc(p.description)}</textarea><div class="section-head"><h2>Etiketler</h2><button class="text-button" data-action="copy-tags">Tümünü kopyala ↗</button></div><textarea id="tags" style="min-height:80px" aria-label="Video etiketleri">${esc((p.tags || []).join(', '))}</textarea><small class="muted" id="tag-count">${(p.tags || []).join(', ').length}/500 karakter · Virgülle ayırabilirsin.</small><div class="hint lime">Önerileri kendi içeriğine göre kontrol et. Başlık ve kapak, videonun gerçekten sunduğu şeyi anlatmalı.</div>`;
}
function defaultEditor() { return { text: '', x: 80, y: 480, size: 100, color: '#ffffff', outline: '#101114', backgroundColor: '#222a1c', font: 'Segoe UI', logoX: 1080, logoY: 40, logoSize: 150 }; }
function renderCoverOutput() {
  const e = { ...defaultEditor(), ...project.editor };
  return `<canvas id="cover-canvas" class="cover-canvas" width="1280" height="720" aria-label="Kapak önizlemesi; metni fareyle sürükleyebilirsiniz"></canvas><div class="hint">1280 × 720 · Görsel çerçeveyi dolduracak şekilde kırpılır. Metni ve logoyu önizleme üzerinde sürükleyebilirsin.</div>${field('Kapak için yönlendirmen', 'coverPrompt', project.coverPrompt, 'Nasıl bir kapak istiyorsun? Kompozisyonu, atmosferi ve vurgulanacak konuyu anlat.', 'textarea')}<div class="inline-actions"><button class="button primary" data-action="generate-image">${icon('spark')} Kapak üret</button><button class="button small" data-action="pick-background">Görsel seç</button></div><div class="welcome-note">${state.settings.chatgptMode ? 'ChatGPT · Codex hesabının kullanım sınırlarına tabidir.' : `${esc(state.providers[state.settings.imageProvider]?.name)} · Ücretli API isteği oluşturur.`}</div><details class="editor-tools" ${project.editor?.text ? 'open' : ''}><summary>Elle düzenle <span class="optional">İsteğe bağlı</span></summary>${field('Kapak üzerindeki yazı', 'editor-text', e.text, 'Kısa, güçlü bir ifade…', 'textarea')}<div class="field-row"><div class="field"><label for="editor-font">Yazı tipi</label><select id="editor-font">${['Segoe UI', 'Arial', 'Impact', 'Georgia', 'Verdana'].map(f => `<option ${e.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div class="field"><label for="editor-size">Yazı boyutu</label><input id="editor-size" type="range" min="24" max="180" value="${e.size}"></div></div><div class="field-row"><div class="field"><label for="editor-color">Yazı rengi</label><input id="editor-color" type="color" value="${e.color}"></div><div class="field"><label for="editor-outline">Yazı kenarlığı</label><input id="editor-outline" type="color" value="${e.outline}"></div></div><div class="field"><label for="editor-backgroundColor">Arka plan rengi</label><input id="editor-backgroundColor" type="color" value="${e.backgroundColor}"></div><div class="inline-actions"><button class="button small" data-action="pick-logo">＋ Logo yerleştir</button><button class="button small subtle" data-action="remove-logo">Logoyu kaldır</button></div><div class="field space-top"><label for="editor-logoSize">Logo boyutu</label><input id="editor-logoSize" type="range" min="40" max="400" value="${e.logoSize}"></div></details><div class="form-actions"><button class="button small" data-action="save-cover">Kütüphaneye kaydet</button><button class="button small" data-action="export-cover">${icon('download')} PNG indir</button></div>`;
}
function renderLibrary() {
  const items = state.assets.filter(a => `${a.name} ${a.tags} ${a.role}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
  $('#content').innerHTML = `${heading('Görsel kütüphanesi', 'Yüzler, ürünler, ilhamlar. Görsel dünyanı bir arada tut.', '<button class="button primary" data-action="import-assets">＋ Görsel ekle</button>')}<div class="toolbar"><input id="asset-search" placeholder="Ad, kullanım amacı veya etiketle ara…" aria-label="Görsel ara" value="${esc(query)}"><span class="spacer"></span><span class="pill">${items.length} GÖRSEL</span></div><div class="asset-grid">${items.map(a => `<article class="panel asset-card"><img loading="lazy" src="${assetURL(a.id)}" alt="${esc(a.name)}"><div class="asset-info"><h3>${esc(a.name)}</h3><span class="pill">${esc(a.role)}</span><p>${esc(a.note || 'Kullanım açıklaması eklenmedi.')}</p><div class="asset-actions"><button class="text-button" data-action="edit-asset" data-id="${a.id}">Düzenle ↗</button><button class="icon-button" data-action="delete-asset" data-id="${a.id}" title="Görseli sil">${icon('trash')}</button></div></div></article>`).join('')}</div>${!items.length ? `<div class="panel">${empty('Bir görsel, birçok yeni fikir.', 'Referans görsellerini ekle, nasıl kullanılacaklarını belirt. Kapak üretirken tekrar tekrar kullan.', '<button class="button" data-action="import-assets">＋ İlk görselini ekle</button>', 'image')}</div>` : ''}`;
}
function renderProfiles() {
  $('#content').innerHTML = `${heading('Kanal profilleri', 'Kanalının dilini bir kez anlat. Her içerikte kendi imzan olsun.', '<button class="button primary" data-action="new-profile">＋ Yeni profil</button>')}<div class="profile-grid">${state.profiles.map(p => `<article class="panel profile-card"><div class="profile-top"><span class="avatar">${esc(p.name.charAt(0).toUpperCase())}</span><div><h3>${esc(p.name)}</h3><span class="pill">${esc(p.tone || 'Özel profil')}</span></div></div><p>${esc(p.audience || 'Hedef kitle henüz eklenmedi.')}</p><p>${esc(p.style || 'Görsel tarzını ekleyebilirsin.')}</p><button class="button small full-width" data-action="edit-profile" data-id="${p.id}">Profili düzenle</button></article>`).join('')}</div>${!state.profiles.length ? `<div class="panel">${empty('Her kanalın kendine ait bir sesi var.', 'Hedef kitleni, anlatım tarzını, bağlantılarını ve kapak stilini kaydet. Proje oluştururken istediğin profili seç.', '<button class="button" data-action="new-profile">＋ İlk profilini oluştur</button>', 'profile')}</div>` : ''}`;
  for (const button of document.querySelectorAll('[data-action="edit-profile"]')) {
    button.insertAdjacentHTML('afterend', `<button class="button primary small full-width space-top" data-action="new-from-series" data-id="${esc(button.dataset.id)}">Bu şablonla yeni içerik</button>`);
  }
}
function renderSettings() {
  const s = state.settings;
  const connection = (purpose, label, id) => `<div class="provider-row">
    <div class="provider-name"><strong>${label}</strong><small>${esc(state.providers[id]?.name || '')} · ${state.keys[id] ? 'Bağlı' : 'Bağlantı gerekli'}</small></div>
    <button class="button small" data-action="ai-setup" data-id="${purpose}">${state.keys[id] ? 'Değiştir' : 'Bağla'}</button>
  </div>`;
  $('#content').innerHTML = `${heading('Stüdyo ayarları', 'Bağlantılarını ve görünümü yönet.')}
    <div class="settings-grid">
      <section class="panel">
        <h2>Yapay zekâ bağlantıları</h2>
        <div class="provider-row"><div class="provider-name"><strong>ChatGPT hesabı</strong><small>${s.chatgptMode ? 'Metin ve kapak için seçili' : 'Codex üzerinden tek hesapla bağlan'}</small></div>
        <button class="button ${s.chatgptMode ? 'small' : 'primary'}" data-action="chatgpt-connect">${s.chatgptMode ? 'Oturumu kontrol et' : 'ChatGPT ile giriş yap'}</button></div>
        ${s.chatgptMode ? '<button class="button small" data-action="chatgpt-disable">API bağlantılarına geç</button>' : ''}
        <details class="space-top"><summary>API bağlantıları</summary>
        ${connection('text', 'Başlık, açıklama ve sohbet', s.provider)}
        ${connection('image', 'Kapak görseli üretimi', s.imageProvider)}
        </details>
        <p class="muted">Anahtarlar ${state.secureStorage ? 'Windows güvenli depolamasıyla şifrelenir.' : 'bu oturumda bellekte tutulur.'} Üretim ücretleri sağlayıcının kendi tarifesine bağlıdır.</p>
        <details class="space-top"><summary>Sağlayıcıları ve modelleri yönet</summary>
          ${Object.entries(state.providers).map(([id, p]) => `<div class="provider-row">
            <div class="provider-name">${esc(p.name)}<small>${state.keys[id] ? 'Anahtar kayıtlı' : 'Bağlı değil'}</small></div>
            <button class="button small" data-action="provider" data-id="${id}">${state.keys[id] ? 'Yönet' : 'Bağla'}</button>
          </div>`).join('')}
        </details>
      </section>
      <div class="settings-stack">
        <section class="panel"><h2>Görünüm</h2>
          <div class="field"><label for="setting-theme">Tema</label><select id="setting-theme">
            ${selectOptions([{ id: 'dark', name: 'Koyu' }, { id: 'light', name: 'Açık' }, { id: 'system', name: 'Windows temasını izle' }], s.theme)}
          </select></div>
        </section>
        <section class="panel"><h2>YouTube bağlantı ayarları</h2>
          <p class="muted">Kanal analizi ve yayın için Google Masaüstü OAuth istemcisi gerekir.</p>
          ${field('OAuth istemci kimliği', 'oauth-client', s.oauthClientId, '…apps.googleusercontent.com')}
          <div class="field"><label for="oauth-secret">OAuth istemci gizli değeri</label><input id="oauth-secret" type="password" placeholder="${state.oauthSecret ? 'Kayıtlı; değiştirmek için yazın' : 'Google istemci dosyasındaki client_secret'}" autocomplete="off"></div>
          <button class="button small" data-action="save-oauth">Bağlantı ayarlarını kaydet</button>
        </section>
        <section class="panel"><h2>Sürüm</h2><span class="pill">PROMPTSTUDIO ${esc(state.version)}</span>
          ${state.updateConfigured ? '<div class="space-top"><button class="button small" data-action="check-update">Güncellemeleri kontrol et</button></div>' : ''}
        </section>
      </div>
    </div>`;
}
function renderAnalytics() {
  const c = state.channel;
  let analytics = '';
  if (c) {
    const rows = c.reports.rows || [];
    const sum = i => rows.reduce((a, r) => a + (Number(r[i]) || 0), 0);
    const max = Math.max(1, ...rows.map(r => r[1]));
    const fmt = n => Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    analytics = `<div class="stats"><div class="panel stat"><small>Görüntülenme</small><strong>${fmt(sum(1))}</strong><span>Rapor döneminde</span></div><div class="panel stat"><small>İzlenme süresi</small><strong>${fmt(sum(2) / 60)} <span>saat</span></strong><span>Rapor döneminde</span></div><div class="panel stat"><small>Kazanılan aboneler</small><strong>${fmt(sum(3))}</strong><span>Net değişim değildir</span></div><div class="panel stat"><small>Toplam aboneler</small><strong>${c.statistics.hiddenSubscriberCount ? 'Gizli' : fmt(c.statistics.subscriberCount || 0)}</strong><span>Kanalın toplamı</span></div></div><div class="hint">Rapor dönemi: ${esc(c.period.start)} — ${esc(c.period.end)}. Verilerin tamamlanması için son 3 gün hariç tutulur. Son eşitleme: ${new Date(c.syncedAt).toLocaleString('tr-TR')}.</div>`;
    analytics += `<div class="analytics-grid"><div class="settings-stack"><section class="panel"><div class="panel-title"><h2>Görüntülenmelerin ritmi</h2><span class="pill">GÜNLÜK</span></div>${rows.length ? `<div class="chart">${rows.map(r => `<div class="chart-bar" style="height:${Math.max(1, r[1] / max * 100)}%" title="${esc(r[0])}: ${fmt(r[1])} görüntülenme"></div>`).join('')}</div><div class="chart-axis"><span>${esc(rows[0][0])}</span><span>${esc(rows.at(-1)[0])}</span></div>` : empty('Bu dönem için veri yok.', 'Kanalın veri toplamaya başladığında burada görebilirsin.', '', 'chart')}</section><section class="panel"><h2>Son videoların arasında öne çıkanlar</h2><p class="muted" style="font-size:10px;margin-top:6px">En son 30 video · Toplam görüntülenmeye göre · Video yaşları farklıdır.</p>${[...c.videos].sort((a, b) => Number(b.statistics?.viewCount || 0) - Number(a.statistics?.viewCount || 0)).slice(0, 6).map((v, i) => `<div class="video-row"><span>0${i + 1}</span><div><strong>${esc(v.snippet.title)}</strong><small>${formatDate(v.snippet.publishedAt)} · ${fmt(v.statistics?.viewCount || 0)} görüntülenme</small></div></div>`).join('')}</section><div class="hint">${esc(c.limitation)}</div></div>${renderChat()}</div>`;
  } else {
    analytics = `<div class="analytics-grid"><section class="panel channel-connect"><div class="feature-icon orange">${icon('youtube')}</div><span class="pill purple">KANALINLA TANIŞALIM</span><h2 class="space-top">Verilerin bir hikâye anlatıyor.</h2><p>YouTube hesabını bağla; izlenmelerini ve içerik performansını birlikte değerlendirelim. Yalnızca okuma izni istenir.</p><button class="button primary" data-action="youtube-connect">${icon('youtube')} YouTube hesabını bağla</button><div class="hint">${state.settings.oauthClientId ? 'Bağlantı güvenli tarayıcı penceresinde tamamlanır.' : 'İlk bağlantıdan önce Ayarlar → YouTube bağlantı ayarlarını tamamlayın.'}</div><button class="text-button" data-route="settings">Bağlantı ayarlarına git ↗</button></section>${renderChat()}</div>`;
  }
  $('#content').innerHTML = `${heading('Kanal analizi', 'Rakamları anlamlandır. Fikirlerini verilerinle güçlendir.', state.connected ? '<button class="button" data-action="youtube-sync">Verileri yenile ↻</button>' : '')}${state.connected ? `<div class="connected-banner"><span class="feature-icon orange">${icon('youtube')}</span><div>${esc(c?.name || 'YouTube hesabı bağlı')}<small>Yalnızca okuma izni · İçerik yükleme yetkisi yok</small></div><span class="spacer"></span><button class="text-button" data-action="youtube-disconnect">Bağlantıyı kaldır</button></div>` : ''}${analytics}`;
  const m = $('.chat-messages'); if (m) m.scrollTop = m.scrollHeight;
  if (state.connected && c?.videos?.length) {
    $('#content').insertAdjacentHTML('beforeend', `<section class="panel space-top">
      <h2>Video raporu</h2>
      <div class="field space-top"><label for="report-video">Kanalından bir video seç</label>
      <select id="report-video">${c.videos.map(video => `<option value="${esc(video.id)}">${esc(video.snippet.title)}</option>`).join('')}</select></div>
      <div class="inline-actions"><button class="button primary" data-action="video-report">Raporu getir</button>
      <button class="button small" data-action="analysis-project">Bu videodan yeni fikir oluştur</button></div>
      <p class="muted space-top">Rapor dönemi: ${esc(c.period.start)} – ${esc(c.period.end)}</p>
      <div id="video-report-results" aria-live="polite"></div>
    </section>`);
    $('#report-video').onchange = () => { $('#video-report-results').textContent = ''; };
  }
}
function videoReportMarkup(report) {
  const retention = report.retention.rows || [];
  const traffic = report.traffic.rows || [];
  const max = Math.max(1, ...retention.map(row => Number(row[1]) || 0));
  const points = retention.map(([position, ratio]) => `${Math.max(0, Math.min(1, Number(position) || 0)) * 570 + 15},${155 - (Math.max(0, Number(ratio) || 0) / max) * 140}`).join(' ');
  const format = value => Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const labels = { YT_SEARCH: 'YouTube araması', RELATED_VIDEO: 'Önerilen videolar', SHORTS: 'Shorts akışı', EXT_URL: 'Harici bağlantılar', SUBSCRIBER: 'Ana sayfa ve abonelikler', NOTIFICATION: 'Bildirimler', PLAYLIST: 'Oynatma listeleri', YT_CHANNEL: 'Kanal sayfaları' };
  return `<div class="analytics-grid space-top">
    <div><h3>İzleyici tutma</h3>${retention.length ? `
      <svg class="retention-plot" viewBox="0 0 600 170" role="img" aria-label="Video ilerlemesine göre izlenme oranı">
        <path d="M15 15 V155 H585" fill="none" stroke="currentColor" opacity=".25"/>
        <polyline points="${points}" fill="none" stroke="#a3e635" stroke-width="3" vector-effect="non-scaling-stroke"/>
      </svg><div class="chart-axis"><span>Başlangıç</span><span>Video ilerlemesi</span><span>Bitiş</span></div>
      <p class="muted">Grafik üst sınırı %${format(max * 100)}. Tekrar izlemelerde oran %100’ü aşabilir.</p>` : `<p class="hint">${esc(report.retention.error || 'Bu dönem için yeterli izleyici tutma verisi yok.')}</p>`}</div>
    <div><h3>Trafik kaynakları</h3>${traffic.length ? traffic.map(([label, views, minutes]) => `<div class="video-row"><div><strong>${esc(labels[label] || label)}</strong><small>${format(views)} görüntülenme · ${format(minutes)} dakika</small></div></div>`).join('') : `<p class="hint">${esc(report.traffic.error || 'Bu dönem için trafik kaynağı verisi yok.')}</p>`}</div>
  </div>`;
}
function renderChat() {
  return `<section class="panel chat-panel"><div class="panel-title"><h2>${icon('spark')} Kanal asistanın</h2><button class="text-button" data-action="clear-chat">Temizle</button></div><div class="chat-messages">${state.chat.length ? state.chat.map(m => `<div class="message ${m.role}"><small>${m.role === 'user' ? 'SEN' : 'STÜDYO ASİSTANI'}</small>${esc(m.content)}</div>`).join('') : empty('Birlikte düşünelim.', state.channel ? 'Kanalınla ilgili sorularını sor. Önerileri mevcut veriler ve açıkça belirtilen çıkarımlarla değerlendirelim.' : 'Kanalını bağlamadan da genel içerik önerileri alabilirsin. Kanalına özel analiz için bağlantı gerekir.', '', 'chat')}</div><div class="suggestions"><button class="button small" data-question="Kanal verilerime göre hangi konulara ağırlık verebilirim?">Ne tür içerikler üretmeliyim?</button><button class="button small" data-question="Mevcut verilerin sınırlarını belirterek yayın saatleri için nasıl bir deney planlayabilirim?">Yayın saatimi nasıl seçeyim?</button></div><div class="chat-entry"><textarea id="chat-question" placeholder="Kanalın hakkında bir soru sor…" aria-label="Asistana sorun"></textarea><button class="button primary" data-action="send-chat" title="Mesajı gönder">${icon('arrow')}</button></div><small class="muted" style="font-size:9px;margin-top:9px">Seçili AI sağlayıcısına soru, son sohbet ve varsa kanal raporu gönderilir.</small></section>`;
}
function render() {
  renderNavigation();
  const names = { home: 'Genel bakış', projects: 'İçeriklerim', library: 'Görsel kütüphanesi', analytics: 'Kanal analizi', profiles: 'Kanal profilleri', settings: 'Ayarlar', studio: 'İçerik stüdyosu', publications: 'Yayın kuyruğu', ideas: 'Fikir laboratuvarı' };
  $('#breadcrumb').innerHTML = `Çalışma alanı <span>/</span> ${names[route] || 'Genel bakış'}`;
  ({ home: renderHome, projects: renderProjects, library: renderLibrary, profiles: renderProfiles, settings: renderSettings, studio: renderStudio, analytics: renderAnalytics, publications: renderPublications, ideas: renderIdeas }[route] || renderHome)();
}

let ideaResults;
let ideaTopic = '';
function renderIdeas() {
  $('#content').innerHTML = `${heading('Fikir laboratuvarı', 'YouTube videoları ve yorumlarından yola çıkarak yeni içerik fikirleri geliştir.')}
    <section class="panel">
      ${field('Araştırılacak konu', 'idea-topic', ideaTopic, 'Örn. Evde 3D yazıcı kurulumu')}
      <div class="inline-actions">
        <button class="button primary" data-action="research-ideas">${icon('spark')} Fikir araştır</button>
        <button class="button small" data-action="research-key">Data API anahtarı ${state.researchKey ? '· Kayıtlı' : ''}</button>
      </div>
      <p class="hint">YouTube hesabın bağlıysa mevcut bağlantıyı kullanabilirsin. Arama sonuçlarının başlıkları ve sınırlı sayıda herkese açık yorum, fikir oluşturmak için seçili metin sağlayıcısına gönderilir.</p>
    </section>
    <div id="idea-results" class="space-top" aria-live="polite"></div>`;
  drawIdeas();
}
function drawIdeas() {
  const target = $('#idea-results');
  if (!target || !ideaResults) return;
  const { query, ideas, sources, incompleteComments } = ideaResults;
  target.innerHTML = `<div class="section-head"><h2>${esc(query)}</h2><span class="pill">${sources.length} video kaynağı</span></div>
    ${incompleteComments ? '<p class="hint">Bazı videoların yorumlarına erişilemedi. Öneriler eldeki kaynaklarla hazırlandı.</p>' : ''}
    <div class="profile-grid">${ideas.map((idea, index) => `<article class="panel profile-card">
      <h3>${esc(idea.title)}</h3><p>${esc(idea.reason)}</p>
      <p><strong>Çekim planı</strong><br>${esc(idea.brief)}</p>
      <div class="inline-actions">${idea.sources.map(number => `<button class="button small" data-action="research-open-source" data-id="${esc(sources[number - 1].id)}">Kaynak ${number}</button>`).join('')}</div>
      <button class="button primary small space-top" data-action="idea-project" data-index="${index}">Projeye dönüştür</button>
    </article>`).join('')}</div>
    ${!ideas.length ? '<p class="hint">Bu konu için sonuç bulunamadı. Daha belirgin bir arama dene.</p>' : ''}
    ${sources.length ? `<section class="panel space-top"><h2>İncelenen kaynaklar</h2>
      ${sources.map((source, index) => `<details class="space-top"><summary>${index + 1}. ${esc(source.title)} · ${esc(source.channel)}</summary>
        <button class="button small" data-action="research-open-source" data-id="${esc(source.id)}">Videoyu aç ↗</button>
        ${source.comments.map(comment => `<div class="video-row"><div>${esc(comment.text)}</div><button class="text-button" data-action="research-open-source" data-id="${esc(source.id)}" data-comment="${esc(comment.id)}">Yorumu aç ↗</button></div>`).join('')}
      </details>`).join('')}</section>` : ''}`;
}
function researchKeyModal() {
  ideaTopic = $('#idea-topic').value;
  modal('YouTube Data API anahtarı', `<p>Google Cloud projenin YouTube Data API v3 hizmeti etkin olmalı. Anahtarın varsa burada kaydet.</p>
    <div class="field"><label for="research-api-key">API anahtarı</label><input id="research-api-key" type="password" autocomplete="off" placeholder="${state.researchKey ? 'Anahtar kayıtlı' : 'Anahtarını yapıştır'}"></div>
    <div class="form-actions">${state.researchKey ? '<button id="remove-research-key" class="button small">Anahtarı kaldır</button>' : ''}<button id="save-research-key" class="button primary">Kaydet</button></div>`);
  const save = async value => {
    await call('research-key', value);
    closeModal();
    await refresh();
    renderIdeas();
  };
  $('#save-research-key').onclick = event => run('research-key', event.currentTarget, async () => {
    const value = $('#research-api-key').value.trim();
    if (!value) throw new Error('Bir API anahtarı gir.');
    await save(value);
  });
  if ($('#remove-research-key')) $('#remove-research-key').onclick = event => run('research-key', event.currentTarget, () => save(''));
}

const publishingPlatforms = { youtube: 'YouTube', instagram: 'Instagram Reels', tiktok: 'TikTok' };
const publicationStatuses = { queued: 'Bekliyor', sending: 'Gönderiliyor', sent: 'Platforma gönderildi', failed: 'Başarısız', review: 'Kontrol gerekli', cancelled: 'İptal edildi' };

function publicationCards() {
  return state.publications.length ? state.publications.map(job => `
    <article class="panel profile-card">
      <div class="panel-title"><h3>${esc(job.title || job.projectName)}</h3><span class="pill">${esc(publicationStatuses[job.status])}</span></div>
      <p>${publishingPlatforms[job.platform]} · ${esc(job.account.name)}</p>
      <p>${esc(new Date(job.scheduledAt).toLocaleString('tr-TR'))}</p>
      ${job.notice ? `<div class="hint">${esc(job.notice)}</div>` : ''}
      ${job.remoteId ? `<p>İşlem kimliği: ${esc(job.remoteId)}</p>` : ''}
      ${job.status === 'queued' ? `<button class="button small" data-action="cancel-publication" data-id="${esc(job.id)}">Gönderimi iptal et</button>` : ''}
    </article>`).join('') : '<div class="panel empty-state"><p>Henüz bir yayın planı yok.</p></div>';
}

function renderPublications() {
  $('#content').innerHTML = `${heading('Yayın kuyruğu', 'Projelerini platformlara gönder veya gönderim saatini planla.', '<button class="button primary" data-action="new-publication">＋ Gönderim oluştur</button>')}
    <div class="hint">Planlanan saatte PromptStudio açık, bilgisayar uyanık ve internete bağlı olmalı. Saat 10 dakikadan fazla geçtiyse kayıt kontrol için bekletilir. Planlanan saat aktarımın başlangıcıdır.</div>
    <div class="profile-grid">${Object.entries(publishingPlatforms).map(([id, name]) => {
      const account = state.publishingAccounts[id];
      return `<article class="panel profile-card"><h3>${name}</h3><p>${account ? esc(account.name) : 'Yayın hesabı bağlı değil'}</p>
        <button class="button small" data-action="${account ? 'disconnect-publication' : 'connect-publication'}" data-id="${id}">${account ? 'Bağlantıyı kaldır' : 'Hesabı bağla'}</button></article>`;
    }).join('')}</div>
    <div class="section-head"><h2>Gönderimler</h2><button class="button small" data-action="refresh-publications">Yenile</button></div>
    <div id="publication-list" class="profile-grid">${publicationCards()}</div>`;
}

function publicationAccountModal(platform) {
  const instructions = {
    youtube: 'Ayarlar’daki Google Masaüstü OAuth istemcisi kullanılır. Açılan tarayıcıda hedef kanalı seçip yükleme iznini ver.',
    instagram: 'Meta uygulamasından profesyonel hesabın için instagram_business_basic ve instagram_business_content_publish izinli Instagram kullanıcı erişim belirtecini al.',
    tiktok: 'TikTok geliştirici uygulamandan user.info.basic ve video.upload izinli kullanıcı erişim belirtecini al. Dosya TikTok gelen kutusuna iletilir, paylaşımı TikTok’ta tamamlarsın.'
  };
  modal(`${publishingPlatforms[platform]} hesabını bağla`, `<p>${instructions[platform]}</p>
    ${platform !== 'youtube' ? '<div class="field"><label for="publication-token">Kullanıcı erişim belirteci</label><input type="password" id="publication-token" autocomplete="off"></div>' : ''}
    <div class="form-actions"><button class="button primary" id="publication-connect">Bağla</button></div>`);
  $('#publication-connect').onclick = event => run('publication-connect', event.currentTarget, async () => {
    await call('publication-account', platform, $('#publication-token')?.value);
    closeModal();
    await refresh();
    renderPublications();
  });
}

function publicationModal(projectId) {
  const accounts = Object.entries(state.publishingAccounts).filter(([, account]) => account);
  if (!accounts.length) {
    modal('Önce yayın hesabını bağla', '<p>Yayın kuyruğunda hedef platformun hesabını bağla. Taslağın kayıtlı.</p><button class="button primary" data-action="open-publication-accounts">Yayın kuyruğunu aç →</button>');
    return;
  }
  if (!state.projects.length) { toast('Önce bir içerik projesi oluştur.', true); return; }
  let selectedVideo;
  modal('Gönderim oluştur', `<div class="field"><label for="publication-platform">Platform ve hedef hesap</label>
    <select id="publication-platform">${accounts.map(([id, a]) => `<option value="${id}">${publishingPlatforms[id]} · ${esc(a.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="publication-project">İçerik projesi</label><select id="publication-project">${selectOptions(state.projects, projectId)}</select></div>
    ${field('Başlık', 'publication-title')}${field('Açıklama', 'publication-description', '', '', 'textarea')}
    <div id="publication-options"></div>
    <div class="field"><label for="publication-date">Gönderim zamanı (yerel saat)</label><input type="datetime-local" id="publication-date"><small>Hemen göndermek için boş bırak.</small></div>
    <label><input style="width:auto" type="checkbox" id="publication-consent"> Seçtiğim videonun yukarıdaki hesaba gönderilmesini onaylıyorum.</label>
    <div class="form-actions"><button class="button primary" id="publication-submit">Kuyruğa ekle</button></div>`);
  const fillProject = () => {
    const selected = state.projects.find(p => p.id === $('#publication-project').value);
    $('#publication-title').value = chosenTitle(selected) || selected.name;
    $('#publication-description').value = selected.description || '';
    $('#publication-consent').checked = false;
  };
  const fillOptions = () => {
    const platform = $('#publication-platform').value;
    selectedVideo = null;
    $('#publication-consent').checked = false;
    $('#publication-options').innerHTML = platform === 'instagram'
      ? field('Herkese açık HTTPS video adresi', 'publication-url', '', 'https://…/video.mp4')
      : '<div class="field"><button class="button small" id="publication-pick">Video dosyası seç</button> <span id="publication-file"></span></div>';
    if (platform === 'youtube') $('#publication-options').insertAdjacentHTML('beforeend', `
      <div class="field-row">
        <div class="field"><label for="publication-visibility">Görünürlük</label><select id="publication-visibility"><option value="">Seç</option><option value="private">Gizli</option><option value="unlisted">Liste dışı</option><option value="public">Herkese açık</option></select></div>
        <div class="field"><label for="publication-kids">Çocuklara özel mi?</label><select id="publication-kids"><option value="">Seç</option><option value="yes">Evet</option><option value="no">Hayır</option></select></div>
      </div><p>Projedeki etiketler ve uygun kayıtlı kapak görseli de kullanılır.</p>`);
    if (platform === 'tiktok') $('#publication-options').insertAdjacentHTML('beforeend', '<div class="hint">Bu işlem videoyu TikTok gelen kutusuna gönderir. Başlığı ve açıklamayı TikTok’ta ekleyip paylaşımı oradan tamamlarsın.</div>');
    if ($('#publication-pick')) $('#publication-pick').onclick = event => run('publication-pick', event.currentTarget, async () => {
      const result = await call('publication-pick');
      if (result && $('#publication-file')) { selectedVideo = result; $('#publication-file').textContent = result.name; $('#publication-consent').checked = false; }
    });
  };
  $('#publication-platform').onchange = fillOptions;
  $('#publication-project').onchange = fillProject;
  fillProject();
  fillOptions();
  $('#publication-submit').onclick = event => run('publication-add', event.currentTarget, async () => {
    const platform = $('#publication-platform').value;
    const date = $('#publication-date').value;
    const kids = $('#publication-kids')?.value;
    await call('publication-add', {
      platform, projectId: $('#publication-project').value, accountId: state.publishingAccounts[platform].id,
      title: $('#publication-title').value, description: $('#publication-description').value,
      videoId: selectedVideo?.id, videoUrl: $('#publication-url')?.value,
      visibility: $('#publication-visibility')?.value, madeForKids: kids ? kids === 'yes' : undefined,
      scheduledAt: date ? new Date(date).toISOString() : '', confirmed: $('#publication-consent').checked
    });
    closeModal();
    await refresh();
    if (route === 'publications') renderPublications();
    toast('Gönderim kuyruğa eklendi.');
  });
}

setInterval(async () => {
  if (route !== 'publications' || $('#modal').open) return;
  try {
    const snapshot = await call('state');
    if (route !== 'publications' || $('#modal').open) return;
    state.publications = snapshot.publications;
    const list = $('#publication-list');
    const cards = publicationCards();
    if (list.dataset.rendered !== cards) {
      list.innerHTML = cards;
      list.dataset.rendered = cards;
    }
  } catch { /* Keep the existing queue visible if refresh fails. */ }
}, 5000);
async function navigate(next) { await flushSave(); project = null; route = next; query = ''; if (next !== 'projects') filterFolder = ''; render(); window.scrollTo(0, 0); }
function queueSave() {
  clearTimeout(debounce);
  const status = $('#save-status');
  if (status) status.textContent = 'Kaydediliyor…';
  const progress = $('#project-progress');
  if (progress && project) progress.textContent = projectProgress(project).label;
  debounce = setTimeout(() => { flushSave().catch(e => toast(e.message, true)); }, 450);
}
async function flushSave() {
  clearTimeout(debounce);
  debounce = null;
  if (!project) return;
  const value = structuredClone(project);
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const saved = await call('save', 'projects', value);
    const index = state.projects.findIndex(p => p.id === saved.id);
    if (index >= 0) state.projects[index] = saved; else state.projects.unshift(saved);
    const s = $('#save-status'); if (s) s.textContent = '✓ Uygulama kütüphanesine kaydedildi';
  });
  await saveQueue;
}
function modal(title, body) { $('#modal-content').innerHTML = `<div class="modal-head"><h2>${title}</h2><button class="icon-button" data-action="close-modal" title="Kapat">×</button></div>${body}`; if (!$('#modal').open) $('#modal').showModal(); }
function closeModal() { $('#modal').close(); }
function confirmAction(title, text, action) { modal(title, `<p>${text}</p><div class="form-actions"><button class="button" data-action="close-modal">Vazgeç</button><button class="button danger" id="confirm-delete">Sil</button></div>`); $('#confirm-delete').onclick = async () => { await run('delete', $('#confirm-delete'), action); closeModal(); }; }
function folderModal(id) { const f = state.folders.find(x => x.id === id) || {}; modal(id ? 'Koleksiyonu düzenle' : 'Yeni koleksiyon', `<p>Video serine veya kendi düzenine uygun bir isim ver.</p>${field('Koleksiyon adı', 'folder-name', f.name, 'Örn. Telefon incelemeleri / 2026')}<div class="form-actions">${id ? '<button class="button danger" id="remove-folder">Koleksiyonu sil</button>' : ''}<button class="button primary" id="save-folder">Kaydet</button></div>`); $('#save-folder').onclick = () => run('folder', $('#save-folder'), async () => { const name = $('#folder-name').value.trim(); if (!name) throw new Error('Koleksiyon adı yazın.'); await call('save', 'folders', { ...f, name }); closeModal(); await refresh(); render(); }); if (id) $('#remove-folder').onclick = () => confirmAction('Koleksiyon silinsin mi?', 'İçerikler silinmez, koleksiyonsuz olarak kalır.', async () => { await call('remove', 'folders', id); filterFolder = ''; await refresh(); render(); }); }
function profileModal(id) { const p = state.profiles.find(x => x.id === id) || {}; modal(id ? 'Kanal profilini düzenle' : 'Yeni kanal profili', `${field('Profil adı', 'profile-name', p.name, 'Kanalım / Seri adı')}${field('Hedef kitle', 'profile-audience', p.audience)}${field('Anlatım tarzı', 'profile-tone', p.tone, 'Samimi, teknik, mizahi…')}${field('Kapak stili, renkler ve marka notları', 'profile-style', p.style, 'Minimal, yeşil tonları, büyük başlıklar…', 'textarea')}${field('Varsayılan açıklama şablonu', 'profile-template', p.template, 'Her açıklamada bulunmasını istediğin metin…', 'textarea')}${field('Sosyal medya ve diğer bağlantılar', 'profile-links', p.links, 'Kendi bağlantılarını yaz…', 'textarea')}<div class="form-actions">${id ? '<button class="button danger" id="remove-profile">Profili sil</button>' : ''}<button class="button primary" id="save-profile">Profili kaydet</button></div>`); $('#save-profile').onclick = () => run('profile', $('#save-profile'), async () => { const value = { ...p }; for (const name of ['name', 'audience', 'tone', 'style', 'template', 'links']) value[name] = $(`#profile-${name}`).value.trim(); if (!value.name) throw new Error('Profil adı yazın.'); await call('save', 'profiles', value); closeModal(); await refresh(); render(); }); if (id) $('#remove-profile').onclick = () => confirmAction('Profil silinsin mi?', 'Projeler korunur; bu profil artık seçilemez.', async () => { await call('remove', 'profiles', id); await refresh(); render(); }); }
function assetForm(a = {}) { return `${a.id ? field('Görsel adı', 'asset-name', a.name) : ''}<div class="field"><label for="asset-role">Bu görsel ne için kullanılacak?</label><select id="asset-role">${[...roles, ...(a.role && !roles.includes(a.role) ? [a.role] : [])].map(r => `<option ${r === a.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>${field('Özel yönlendirmen', 'asset-note', a.note, 'Örn. Yüzümü koru; yalnızca arka planı değiştir.', 'textarea')}${field('Etiketler', 'asset-tags', a.tags, 'Örn. kanalım, telefon, sezon 1')}`; }
function importAssets() { modal('Referans görsel ekle', `<p>Görsellerin kopyası uygulamanın kütüphanesine alınır. Orijinal dosyalar yerinde kalır.</p>${assetForm()}<div class="form-actions"><button class="button primary" id="choose-files">Görselleri seç ve ekle</button></div>`); $('#choose-files').onclick = () => run('import', $('#choose-files'), async () => { const assets = await call('import-assets', { role: $('#asset-role').value, note: $('#asset-note').value, tags: $('#asset-tags').value }); if (!assets.length) return; if (route === 'studio') { project.references = [...new Set([...(project.references || []), ...assets.map(x => x.id)])]; await flushSave(); } closeModal(); await refresh(); render(); toast(`${assets.length} görsel kütüphaneye eklendi.`); }); }
function editAsset(id) { const a = state.assets.find(x => x.id === id); modal('Görselin kullanımını düzenle', `${assetForm(a)}<div class="form-actions"><button class="button primary" id="save-asset">Kaydet</button></div>`); $('#save-asset').onclick = () => run('asset', $('#save-asset'), async () => { await call('asset-info', { ...a, name: $('#asset-name').value.trim() || a.name, role: $('#asset-role').value, note: $('#asset-note').value, tags: $('#asset-tags').value }); closeModal(); await refresh(); render(); }); }
function picker(mode) {
  const selected = new Set(mode === 'refs' ? project.references || [] : []);
  modal(mode === 'refs' ? 'Kapak referanslarını seç' : mode === 'logo' ? 'Logo seç' : 'Kapak görselini seç', `<p>${mode === 'refs' ? 'Görsellerin kullanım amacını kütüphaneden düzenleyebilirsin.' : 'Seçtiğin görsel kapak çalışma alanına yerleşir.'}</p><div class="asset-grid">${state.assets.map(a => `<article class="panel asset-card ${selected.has(a.id) ? 'selected' : ''}" data-pick="${a.id}"><img src="${assetURL(a.id)}" alt="${esc(a.name)}"><div class="asset-info"><h3>${esc(a.name)}</h3><span class="pill">${esc(a.role)}</span></div></article>`).join('')}</div>${!state.assets.length ? '<p>Kütüphane boş. Önce bir referans görsel ekle.</p>' : ''}<div class="form-actions"><button class="button primary" id="apply-pick">Seçimi uygula</button></div>`);
  document.querySelectorAll('[data-pick]').forEach(el => { el.onclick = () => { const id = el.dataset.pick; if (mode !== 'refs') { selected.clear(); document.querySelectorAll('[data-pick]').forEach(x => x.classList.remove('selected')); } if (selected.has(id)) selected.delete(id); else selected.add(id); el.classList.toggle('selected', selected.has(id)); }; });
  $('#apply-pick').onclick = async () => {
    if (mode === 'refs') project.references = [...selected];
    else {
      project.editor ||= defaultEditor();
      const id = [...selected][0] || '';
      project.editor[mode === 'logo' ? 'logo' : 'background'] = id;
      if (mode === 'background') project.coverId = id;
      project.coverDirty = mode === 'logo' || Boolean(project.editor.text?.trim() || project.editor.logo);
    }
    closeModal();
    await flushSave();
    renderStudio();
  };
}
function providerChoices(purpose) {
  return Object.entries(state.providers)
    .filter(([, provider]) => purpose === 'text' || provider.image)
    .map(([id, provider]) => ({ id, name: `${provider.name}${state.keys[id] ? ' · Bağlı' : ''}` }));
}
function setupAI(purpose) {
  const current = purpose === 'image' ? state.settings.imageProvider : state.settings.provider;
  const choices = providerChoices(purpose);
  const suggested = state.keys[current] ? current
    : choices.find(item => state.keys[item.id])?.id || 'openrouter';
  providerModal(suggested, purpose);
}
function requireAI(purpose) {
  if (state.settings.chatgptMode) return true;
  const id = purpose === 'image' ? state.settings.imageProvider : state.settings.provider;
  if (state.keys[id]) return true;
  setupAI(purpose);
  return false;
}
async function chatgptModal() {
  const connection = await call('chatgpt-status');
  modal('ChatGPT ile giriş yap', `<p>${!connection.installed
    ? 'Kapak üretimi için resmi Codex CLI’ı bir kez kur. Kurulumdan sonra bu pencereye dön.'
    : connection.connected ? 'Bu bilgisayarda ChatGPT oturumu açık. PromptStudio’da kullanabilirsin.'
    : 'Tarayıcıda açılan OpenAI girişini tamamla. Bu hesap metin ve kapak üretiminde kullanılacak.'}</p>
    <div class="form-actions">${connection.installed
      ? `<button class="button primary" id="connect-chatgpt">${connection.connected ? 'Bu hesabı kullan' : 'Tarayıcıda giriş yap'}</button>`
      : '<button class="button small" data-action="chatgpt-connect">Kurulumu kontrol et</button><button class="button primary" data-action="chatgpt-install">Codex kurulumunu aç ↗</button>'}</div>`);
  if ($('#connect-chatgpt')) $('#connect-chatgpt').onclick = event => run('chatgpt-login', event.currentTarget, async () => {
    await call('chatgpt-connect');
    closeModal();
    await refresh();
    render();
    toast('ChatGPT metin ve kapak üretimi için seçildi.');
  });
}
function providerModal(id, purpose) {
  const p = state.providers[id];
  const browserLogin = id === 'openrouter' && !state.keys[id];
  const keyField = `<div class="field"><label for="provider-key">API anahtarı</label><input id="provider-key" type="password" autocomplete="off" placeholder="${state.keys[id] ? 'Kayıtlı · değiştirmek için yeni anahtarı yapıştır' : 'API anahtarını yapıştır'}"></div>`;
  modal(purpose === 'image' ? 'Kapak üretimini bağla' : purpose === 'text' ? 'Yapay zekâyı bağla' : `${esc(p.name)} bağlantısı`, `
    ${purpose ? `<div class="field"><label for="setup-provider">Sağlayıcı seç</label><select id="setup-provider">${selectOptions(providerChoices(purpose), id)}</select></div>` : ''}
    ${browserLogin ? '<button class="button primary full-width" id="provider-browser-login">OpenRouter hesabıyla bağlan</button><p class="muted">Tarayıcıda izin ver. Kullanım kendi OpenRouter hesabına yansır.</p>' : ''}
    ${purpose && id === 'openrouter' ? '<p class="hint">Bu bağlantı metin ve kapak üretimi için birlikte kullanılacak.</p>' : ''}
    ${purpose ? '<button class="button small space-top" data-action="chatgpt-connect">ChatGPT hesabıyla bağlan</button>' : ''}
    ${browserLogin ? `<details><summary>API anahtarım var</summary>${keyField}</details>` : keyField}
    <details class="space-top"><summary>Gelişmiş model ayarları</summary>
      ${field('Metin / sohbet modeli', 'provider-model', state.settings.models[id] || p.model)}
      ${p.image ? field('Görsel modeli', 'provider-image', state.settings.imageModels[id] || p.imageModel) : ''}
      ${state.keys[id] ? '<button class="button small" id="test-key">Test et</button><p class="muted">Test küçük bir ücretli istek gönderir.</p>' : ''}
    </details>
    <div class="form-actions">${state.keys[id] && !purpose ? '<button class="button danger" id="remove-key">Anahtarı kaldır</button>' : ''}
      <button class="button ${browserLogin ? 'small' : 'primary'}" id="save-key">${purpose ? 'Kaydet ve kullan' : 'Kaydet'}</button></div>`);
  if (purpose) $('#setup-provider').onchange = event => providerModal(event.target.value, purpose);
  const saveSettings = async () => {
    const models = { ...state.settings.models, [id]: $('#provider-model').value.trim() || p.model };
    const imageModels = { ...state.settings.imageModels };
    if (p.image) imageModels[id] = $('#provider-image').value.trim() || p.imageModel;
    const selection = !purpose ? {} : id === 'openrouter' ? { provider: id, imageProvider: id } : { [purpose === 'image' ? 'imageProvider' : 'provider']: id };
    await call('settings', { models, imageModels, ...selection });
  };
  const finish = async () => {
    closeModal();
    await refresh();
    if (route === 'settings' || route === 'studio') render();
    toast(purpose ? `${p.name} seçildi. Üretime devam edebilirsin.` : 'Bağlantı ayarları kaydedildi.');
  };
  $('#save-key').onclick = event => run('key', event.currentTarget, async () => {
    const key = $('#provider-key').value.trim();
    if (!key && !state.keys[id]) throw new Error('Bir API anahtarı yapıştır veya hesabınla bağlan.');
    if (key) await call('key', id, key);
    await saveSettings();
    await finish();
  });
  if ($('#provider-browser-login')) $('#provider-browser-login').onclick = event => run('openrouter-connect', event.currentTarget, async () => {
    const button = event.currentTarget;
    await call('openrouter-connect');
    if (button.isConnected && $('#modal').open) {
      await saveSettings();
      await finish();
    } else {
      await refresh();
      toast('OpenRouter hesabı bağlandı.');
    }
  });
  if ($('#test-key')) $('#test-key').onclick = event => run('test', event.currentTarget, async () => toast(await call('test-key', id)));
  if ($('#remove-key')) $('#remove-key').onclick = event => run('key', event.currentTarget, async () => { await call('key', id, ''); await finish(); });
}
async function loadCanvasImage(id) { if (!id) return null; if (!canvasImages.has(id)) canvasImages.set(id, new Promise(resolve => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = assetURL(id); })); return canvasImages.get(id); }
const coverStyleKeys = ['x', 'y', 'size', 'font', 'color', 'outline', 'backgroundColor', 'logo', 'logoX', 'logoY', 'logoSize'];
function coverComparisonControls() {
  const profile = state.profiles.find(item => item.id === project.profileId);
  return `<section class="space-top" id="cover-comparison-controls"><h3>Kapak varyasyonları</h3>
    <p class="muted">Mevcut kapak görselin ve yazınla üç düzeni yan yana karşılaştır.</p>
    <div class="inline-actions"><button class="button small" data-action="cover-compare">A / B / C karşılaştır</button>
    ${profile ? '<button class="button small" data-action="cover-save-template">Düzeni ve referansları şablona kaydet</button>' : ''}
    ${profile && project.coverId && !project.coverDirty ? '<button class="button small" data-action="cover-save-template" data-style="yes">Bu kapağı seri örneği yap</button>' : ''}
    ${profile?.coverLayout ? '<button class="button small" data-action="cover-apply-template">Kanal şablonunu uygula</button>' : ''}</div>
    ${profile ? `<p class="muted">${esc(profile.name)} · Şablon logoyu, yazı tipini, renkleri ve yerleşimi saklar.</p>` : '<p class="muted">Kanal şablonu kaydetmek için projeye bir kanal profili seç.</p>'}
    <div class="inline-actions space-top"><button class="button primary" data-action="approve-cover">Kapağı onayla ve devam et →</button></div>
  </section>`;
}
async function compareCovers() {
  const selectedProject = project;
  const editor = { ...defaultEditor(), ...project.editor };
  const text = editor.text.trim() || project.titles?.find(title => title.trim()) || project.name;
  const variants = [
    { ...editor, text, x: 76, y: 490, size: 118, color: '#FFFFFF', outline: '#141922' },
    { ...editor, text, x: 112, y: 222, size: 100, color: '#ECFCCB', outline: '#142410' },
    { ...editor, text, x: 515, y: 422, size: 104, color: '#FED7AA', outline: '#26162A' }
  ];
  const [bg, logo] = await Promise.all([loadCanvasImage(editor.background ?? project.coverId), loadCanvasImage(editor.logo)]);
  if (project !== selectedProject || route !== 'studio' || activeTab !== 'cover') return;
  modal('Kapakları karşılaştır', `<p>Aynı içerik için üç tasarım adayı. Seçtiğin düzeni editörde değiştirebilirsin.</p>
    <div class="cover-variant-grid">${variants.map((_, index) => `<article class="panel">
      <canvas data-cover-preview="${index}" width="1280" height="720" aria-label="${'ABC'[index]} kapak önizlemesi"></canvas>
      <button class="button small" data-cover-choice="${index}">${'ABC'[index]} düzenini uygula</button>
    </article>`).join('')}</div>`);
  const dialog = $('#modal');
  dialog.classList.add('wide-cover-modal');
  dialog.addEventListener('close', () => dialog.classList.remove('wide-cover-modal'), { once: true });
  for (const [index, variant] of variants.entries()) {
    paintCover($(`[data-cover-preview="${index}"]`).getContext('2d'), variant, bg, logo);
    $(`[data-cover-choice="${index}"]`).onclick = event => run('cover-choice', event.currentTarget, async () => {
      project.editor = variant;
      project.coverDirty = true;
      await flushSave();
      closeModal();
      renderStudio();
    });
  }
}
function paintCover(ctx, editor, bg, logo) {
  const e = editor;
  ctx.fillStyle = e.backgroundColor;
  ctx.fillRect(0, 0, 1280, 720);
  if (bg) {
    const scale = Math.max(1280 / bg.width, 720 / bg.height);
    ctx.drawImage(bg, (1280 - bg.width * scale) / 2, (720 - bg.height * scale) / 2, bg.width * scale, bg.height * scale);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
    gradient.addColorStop(0, '#b0cf4b22');
    gradient.addColorStop(1, '#13161c00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1280, 720);
    if (!e.text) {
      ctx.font = '26px Segoe UI';
      ctx.fillStyle = '#949c87';
      ctx.textAlign = 'center';
      ctx.fillText('Kapağın burada hayat bulacak.', 640, 360);
      ctx.textAlign = 'left';
    }
  }
  ctx.font = `800 ${e.size}px "${e.font}"`;
  ctx.lineWidth = Math.max(3, e.size / 13);
  ctx.strokeStyle = e.outline;
  ctx.fillStyle = e.color;
  ctx.lineJoin = 'round';
  const width = Math.max(1, 1240 - e.x);
  e.text.split('\n').forEach((line, index) => {
    const y = e.y + index * e.size * 1.15;
    ctx.strokeText(line, e.x, y, width);
    ctx.fillText(line, e.x, y, width);
  });
  if (logo) ctx.drawImage(logo, e.logoX, e.logoY, e.logoSize, logo.height / logo.width * e.logoSize);
}
let drawSequence = 0;
async function drawCover() {
  const canvas = $('#cover-canvas'); if (!canvas || !project) return;
  const seq = ++drawSequence, e = { ...defaultEditor(), ...project.editor };
  const [bg, logo] = await Promise.all([loadCanvasImage(e.background ?? project.coverId), loadCanvasImage(e.logo)]);
  if (seq !== drawSequence || !canvas.isConnected) return;
  const ctx = canvas.getContext('2d');
  paintCover(ctx, e, bg, logo);
  const preview = $('.youtube-preview-canvas');
  if (preview) preview.getContext('2d').drawImage(canvas, 0, 0);
  let drag;
  const coords = ev => { const r = canvas.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * 1280, y: (ev.clientY - r.top) / r.height * 720 }; };
  canvas.onpointerdown = ev => { const pos = coords(ev); const isLogo = logo && pos.x >= e.logoX && pos.x <= e.logoX + e.logoSize && pos.y >= e.logoY && pos.y <= e.logoY + logo.height / logo.width * e.logoSize; drag = { x: pos.x, y: pos.y, originalX: isLogo ? e.logoX : e.x, originalY: isLogo ? e.logoY : e.y, logo: isLogo }; canvas.setPointerCapture(ev.pointerId); };
  canvas.onpointermove = ev => { if (!drag) return; const pos = coords(ev); project.editor = { ...defaultEditor(), ...project.editor }; project.editor[drag.logo ? 'logoX' : 'x'] = Math.max(0, Math.min(1200, drag.originalX + pos.x - drag.x)); project.editor[drag.logo ? 'logoY' : 'y'] = Math.max(0, Math.min(700, drag.originalY + pos.y - drag.y)); paintDrag(); };
  function paintDrag() {
    paintCover(ctx, project.editor, bg, logo);
    if (preview) preview.getContext('2d').drawImage(canvas, 0, 0);
  }
  canvas.onpointerup = () => { if (drag) { drag = null; project.coverDirty = true; queueSave(); drawCover(); } }; canvas.onpointercancel = canvas.onpointerup;
}
async function copy(text) { await navigator.clipboard.writeText(text || ''); toast('Panoya kopyalandı.'); }
function applySeries(p, profile) {
  p.profileId = profile.id;
  if (!p.audience?.trim()) p.audience = profile.audience || '';
  if (!p.tone?.trim()) p.tone = profile.tone || '';
  if (!p.description?.trim()) p.description = profile.template || '';
  const available = new Set(state.assets.map(asset => asset.id));
  const savedReferences = [...(profile.coverReferences || []), profile.coverStyleAssetId].filter(id => available.has(id));
  p.references = [...new Set([...(p.references || []), ...savedReferences])];
  if (profile.coverLayout) {
    const layout = { ...profile.coverLayout };
    if (layout.logo && !state.assets.some(asset => asset.id === layout.logo)) delete layout.logo;
    p.editor = { ...defaultEditor(), ...p.editor, ...layout };
    if (p.coverId) p.coverDirty = true;
  }
}
function seriesModal() {
  modal('Seri şablonu uygula', `<p>Şablon kapak düzenini ve logoyu uygular, boş metin alanlarını kanal profilinden doldurur.</p>
    <div class="inline-actions">${state.profiles.map(profile => `<button class="button small" data-action="apply-series" data-id="${esc(profile.id)}">${esc(profile.name)} →</button>`).join('')}</div>`);
}
function analysisProjectModal() {
  const video = state.channel?.videos?.find(item => item.id === $('#report-video')?.value);
  if (!video) throw new Error('Bir kaynak video seç.');
  const suggestedProfile = state.profiles.find(profile => profile.name.toLocaleLowerCase('tr') === state.channel.name?.toLocaleLowerCase('tr'));
  modal('Kaynak videodan yeni proje', `<p>Kaynak: ${esc(video.snippet.title)}</p>
    ${field('Yeni video fikri', 'analysis-topic', '', 'Örn. İlk katman neden tutmuyor?', 'textarea')}
    <div class="field"><label for="analysis-profile">Seri şablonu</label><select id="analysis-profile"><option value="">Şablon seçilmedi</option>${selectOptions(state.profiles, suggestedProfile?.id)}</select></div>
    <div class="form-actions"><button class="button primary" id="analysis-create">Taslağı aç</button></div>`);
  $('#analysis-create').onclick = event => run('analysis-create', event.currentTarget, async () => {
    const brief = $('#analysis-topic').value.trim();
    const profile = state.profiles.find(item => item.id === $('#analysis-profile').value);
    closeModal();
    await newProject({ name: brief.slice(0, 90) || `${video.snippet.title} · Yeni fikir`, brief, sourceVideo: { id: video.id, title: video.snippet.title } }, profile);
    if (!brief) $('#brief').focus();
  });
}
async function newProject(values = {}, profile) {
  await flushSave();
  const draft = { name: 'İsimsiz içerik', brief: '', folderId: filterFolder || '', profileId: '', references: [], titles: [], tags: [], description: '', coverPrompt: '', editor: defaultEditor(), ...values };
  if (profile) applySeries(draft, profile);
  project = await call('save', 'projects', draft);
  await refresh();
  route = 'studio';
  activeTab = draft.quickStart ? 'quick' : 'text';
  render();
  window.scrollTo(0, 0);
  const input = $('#project-name') || $('#brief');
  input?.focus();
  input?.select();
}
async function outputCover(p, saveToLibrary) {
  const e = { ...defaultEditor(), ...p.editor };
  const background = e.background ?? p.coverId;
  const [bg, logo] = await Promise.all([loadCanvasImage(background), loadCanvasImage(e.logo)]);
  if (!bg && !logo && !e.text.trim()) throw new Error('Önce kapak için görsel veya yazı ekle.');
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  paintCover(canvas.getContext('2d'), e, bg, logo);
  return call('export-image', { data: canvas.toDataURL('image/png'), name: p.name, saveToLibrary });
}
async function approveCover(advance) {
  const current = project;
  const background = current.editor?.background ?? current.coverId ?? '';
  const asset = await outputCover(current, true);
  if (project !== current) return;
  current.editor = { ...defaultEditor(), ...current.editor, background };
  current.coverId = asset.id;
  current.coverDirty = false;
  await flushSave();
  await refresh();
  if (project !== current) return;
  if (advance) activeTab = 'delivery';
  renderStudio();
  toast('Kapak kütüphaneye kaydedildi.');
}
async function sendChat(button) {
  const question = $('#chat-question').value.trim();
  if (!question || !requireAI('text')) return;
  await run('chat', button, async () => { state.chat = await call('chat', question); renderAnalytics(); });
}
async function checkUpdates(button, silent = false) { await run('update', button, async () => { const r = await call('check-update'); if (r.available) { modal('Yeni bir sürüm hazır.', `<p>PromptStudio ${esc(r.version)} yayımlandı. Kaydettiğin projeler güncellemeden sonra uygulama kütüphanesinde kalır.</p><div class="hint">${esc(r.notes.slice(0, 1200))}</div><div class="form-actions"><button class="button" data-action="close-modal">Daha sonra</button><button class="button primary" data-action="open-release">Sürüm sayfasını aç ↗</button></div>`); } else if (!silent) toast('Güncel sürümü kullanıyorsun.'); }); }

document.addEventListener('click', async event => {
  const el = event.target.closest('button,[data-project],a.brand'); if (!el) return;
  try {
    if (el.matches('a.brand')) { event.preventDefault(); await navigate('home'); return; }
    if (el.dataset.route) { filterFolder = ''; await navigate(el.dataset.route); return; }
    if (el.dataset.folder) { filterFolder = el.dataset.folder; await navigate('projects'); return; }
    if (el.dataset.project) { await flushSave(); project = structuredClone(state.projects.find(p => p.id === el.dataset.project)); route = 'studio'; activeTab = projectProgress(project).tab; render(); window.scrollTo(0, 0); return; }
    if (el.dataset.tab) { await flushSave(); activeTab = el.dataset.tab; renderStudio(); return; }
    if (el.dataset.question) { $('#chat-question').value = el.dataset.question; return; }
    const action = el.dataset.action;
    if (!action) return;
    switch (action) {
      case 'new-project': await newProject(); break;
      case 'quick-project': await newProject({ quickStart: true }); break;
      case 'chatgpt-connect': await run('chatgpt-status', el, chatgptModal); break;
      case 'chatgpt-install': await call('chatgpt-install'); break;
      case 'chatgpt-disable': await call('chatgpt-disable'); await refresh(); render(); break;
      case 'quick-generate':
        await run('quick-generate', el, async () => {
          const current = project;
          if (!current.brief?.trim()) throw new Error('Önce videonun konusunu yaz.');
          if ((current.references || []).length > 5) throw new Error('En fazla beş referans görsel seç.');
          const request = structuredClone(current);
          const sameBrief = request.quickPreparedBrief === request.brief;
          const sameProfile = request.quickPreparedProfile === request.profileId;
          const result = sameBrief && sameProfile && request.coverPrompt ? request : await call('generate-content', request);
          if (project !== current || current.brief !== request.brief) return;
          Object.assign(current, {
            titles: result.titles, description: result.description, tags: result.tags, coverPrompt: result.coverPrompt,
            coverText: result.coverText, selectedTitle: 0, quickPreparedBrief: request.brief, quickPreparedProfile: request.profileId
          });
          if (current.name === 'İsimsiz içerik') current.name = chosenTitle(current) || current.brief.slice(0, 90);
          await flushSave();
          if (project !== current || current.brief !== request.brief) return;
          let asset;
          try {
            asset = await call('generate-image', { ...request, name: current.name, coverPrompt: result.coverPrompt });
          } catch (error) {
            if (project === current && activeTab === 'quick') renderStudio();
            throw error;
          }
          if (project !== current || current.brief !== request.brief) return;
          const overlay = result.coverText || chosenTitle(current).slice(0, 42);
          current.coverId = asset.id;
          current.editor = { ...defaultEditor(), ...current.editor, background: asset.id, text: overlay };
          current.coverDirty = true;
          await refresh();
          if (project === current) await approveCover(true);
        });
        break;
      case 'new-from-series': {
        const profile = state.profiles.find(item => item.id === el.dataset.id);
        if (profile) await run('new-series-project', el, () => newProject({}, profile));
        break;
      }
      case 'series-template': seriesModal(); break;
      case 'apply-series':
        await run('apply-series', el, async () => {
          const profile = state.profiles.find(item => item.id === el.dataset.id);
          if (!profile) return;
          applySeries(project, profile);
          await flushSave();
          closeModal();
          renderStudio();
          toast('Seri şablonu uygulandı.');
        });
        break;
      case 'analysis-project': analysisProjectModal(); break;
      case 'regenerate-part':
        if (!project.brief?.trim()) { toast('Önce videonun konusunu yaz.', true); break; }
        if (!requireAI('text')) break;
        await run('content', el, async () => {
          const current = project;
          const part = el.dataset.id;
          const originalValue = part === 'title' ? current.titles : current[part];
          const value = await call('generate-content', structuredClone(current), part);
          if (project !== current) return;
          if (part === 'title') {
            const hadTitle = Boolean(chosenTitle(current));
            current.titles = [...(current.titles || []), value];
            if (!hadTitle) current.selectedTitle = current.titles.length - 1;
          } else {
            if (current[part] !== originalValue) { toast('Alan değiştiği için yazdığın metin korundu.'); return; }
            current[part] = value;
          }
          await flushSave();
          renderStudio();
        });
        break;
      case 'copy-package':
        await copy([chosenTitle(project), project.description, (project.tags || []).join(', ')].filter(Boolean).join('\n\n'));
        break;
      case 'export-package':
        await flushSave();
        if (await call('export-content', { ...project, selectedOnly: true })) toast('İçerik paketi dışa aktarıldı.');
        break;
      case 'delivery-cover':
        await run('export', el, async () => { if (await outputCover(project, false)) toast('PNG kaydedildi.'); });
        break;
      case 'approve-cover': await run('export', el, () => approveCover(true)); break;
      case 'publish-project':
        await flushSave();
        publicationModal(project.id);
        break;
      case 'open-publication-accounts': closeModal(); await navigate('publications'); break;
      case 'new-folder': folderModal(); break;
      case 'edit-folder': folderModal(el.dataset.id); break;
      case 'close-modal': closeModal(); break;
      case 'new-profile': profileModal(); break;
      case 'edit-profile': profileModal(el.dataset.id); break;
      case 'import-assets': importAssets(); break;
      case 'edit-asset': editAsset(el.dataset.id); break;
      case 'provider': providerModal(el.dataset.id); break;
      case 'ai-setup': setupAI(el.dataset.id); break;
      case 'cover-compare': await run('cover-compare', el, compareCovers); break;
      case 'cover-concepts':
        if (!project.brief?.trim()) { toast('Önce videonun konusunu yaz.', true); break; }
        if (!requireAI('text')) break;
        await run('cover-concepts', el, async () => {
          const current = project;
          const concepts = await call('cover-concepts', structuredClone(current));
          if (project !== current) return;
          current.coverConcepts = concepts;
          delete current.coverConceptIndex;
          await flushSave();
          if (project === current && activeTab === 'cover') renderStudio();
        });
        break;
      case 'select-cover-concept':
        await run('select-cover-concept', el, async () => {
          const index = Number(el.dataset.index);
          const concept = project.coverConcepts?.[index];
          if (!concept) return;
          project.coverConceptIndex = index;
          project.titles ||= [];
          let titleIndex = project.titles.indexOf(concept.title);
          if (titleIndex < 0) titleIndex = project.titles.push(concept.title) - 1;
          project.selectedTitle = titleIndex;
          project.coverPrompt = `${concept.prompt}\nGörselin içinde yazı ve logo olmasın. Bunlar kapak editöründe eklenecek.`;
          project.editor = { ...defaultEditor(), ...project.editor, text: concept.overlay };
          project.coverDirty = true;
          await flushSave();
          renderStudio();
          $('#coverPrompt').scrollIntoView({ block: 'center' });
          toast('Konsept seçildi. Kapak üret düğmesiyle görseli oluştur.');
        });
        break;
      case 'cover-save-template':
        await run('cover-template', el, async () => {
          const profile = state.profiles.find(item => item.id === project.profileId);
          if (!profile) throw new Error('Önce bir kanal profili seç.');
          const editor = { ...defaultEditor(), ...project.editor };
          const coverLayout = Object.fromEntries(coverStyleKeys.map(key => [key, editor[key]]));
          const style = el.dataset.style === 'yes' && project.coverId && !project.coverDirty ? { coverStyleAssetId: project.coverId } : {};
          const coverReferences = (project.references || []).filter(id => id !== profile.coverStyleAssetId && id !== style.coverStyleAssetId);
          await call('save', 'profiles', { ...profile, coverLayout, coverReferences, ...style });
          await refresh();
          if (route === 'studio') renderStudio();
          toast('Kanal kapak şablonu kaydedildi.');
        });
        break;
      case 'cover-apply-template': {
        const profile = state.profiles.find(item => item.id === project.profileId);
        if (!profile?.coverLayout) break;
        applySeries(project, profile);
        project.coverDirty = true;
        await flushSave();
        renderStudio();
        break;
      }
      case 'video-report':
        await run('video-report', el, async () => {
          const video = $('#report-video');
          const id = video.value;
          const target = $('#video-report-results');
          target.textContent = 'Rapor getiriliyor…';
          try {
            const result = await call('video-report', id);
            if (target.isConnected && video.value === id) target.innerHTML = videoReportMarkup(result);
          } finally {
            if (target.textContent === 'Rapor getiriliyor…') target.textContent = '';
          }
        });
        break;
      case 'research-key': researchKeyModal(); break;
      case 'research-ideas':
        ideaTopic = $('#idea-topic').value.trim();
        if (!ideaTopic) { toast('Önce araştırılacak konuyu yaz.', true); break; }
        if (!requireAI('text')) break;
        await run('research-ideas', el, async () => {
          ideaResults = await call('research-ideas', ideaTopic);
          if (route === 'ideas') drawIdeas();
        });
        break;
      case 'research-open-source': await call('research-open-source', el.dataset.id, el.dataset.comment); break;
      case 'idea-project':
        await run('idea-project', el, async () => {
          const idea = ideaResults?.ideas[Number(el.dataset.index)];
          if (!idea) return;
          const saved = await call('save', 'projects', { name: idea.title, brief: idea.brief, titles: [idea.title], tags: [], references: [], editor: defaultEditor() });
          await refresh();
          if (route !== 'ideas') return;
          project = saved;
          route = 'studio';
          activeTab = 'text';
          render();
          window.scrollTo(0, 0);
        });
        break;
      case 'new-publication': publicationModal(); break;
      case 'connect-publication': publicationAccountModal(el.dataset.id); break;
      case 'disconnect-publication':
        await run('disconnect-publication', el, async () => {
          await call('publication-disconnect', el.dataset.id);
          await refresh();
          renderPublications();
        });
        break;
      case 'cancel-publication':
        await run('cancel-publication', el, async () => {
          await call('publication-cancel', el.dataset.id);
          await refresh();
          renderPublications();
        });
        break;
      case 'refresh-publications': await refresh(); renderPublications(); break;
      case 'theme': await call('settings', { theme: document.body.classList.contains('light') ? 'dark' : 'light' }); await refresh(); render(); break;
      case 'pick-refs': picker('refs'); break;
      case 'pick-background': picker('background'); break;
      case 'pick-logo': picker('logo'); break;
      case 'remove-logo': project.editor.logo = ''; project.coverDirty = true; queueSave(); drawCover(); break;
      case 'remove-ref': project.references = project.references.filter(x => x !== el.dataset.id); await flushSave(); renderStudio(); break;
      case 'delete-project': confirmAction('İçerik silinsin mi?', 'Bu proje ve içindeki metinler silinecek. Kütüphanedeki görseller ayrıca silinmediği sürece korunur.', async () => { await flushSave(); await call('remove', 'projects', project.id); project = null; await refresh(); await navigate('projects'); }); break;
      case 'delete-asset': confirmAction('Görsel silinsin mi?', 'Görsel uygulamanın depolamasından kaldırılacak ve projelerdeki referansları temizlenecek. Bilgisayarındaki orijinal dosya korunur.', async () => { await call('remove', 'assets', el.dataset.id); if (project) project = null; canvasImages.delete(el.dataset.id); await refresh(); render(); }); break;
      case 'generate-content':
        if (!project.brief?.trim()) { toast('Önce videonun konusunu yaz.', true); break; }
        if (!requireAI('text')) break;
        await run('content', el, async () => {
        const original = structuredClone(project);
        const result = await call('generate-content', original);
        result.selectedTitle = 0;
        const profile = state.profiles.find(p => p.id === original.profileId);
        if (profile?.style) result.coverPrompt += `\nKanalın kapak stili: ${profile.style}`;
        if (project?.id === original.id) { Object.assign(project, result); await flushSave(); activeTab = 'text'; renderStudio(); }
        else { const current = state.projects.find(p => p.id === original.id); if (current) { await call('save', 'projects', { ...current, ...result }); await refresh(); render(); } }
        toast('İçerik alternatiflerin projesine kaydedildi.');
      }); break;
      case 'generate-image':
        if (!project.coverPrompt?.trim()) { toast('Önce kapak için yönlendirmeni yaz.', true); break; }
        if (!requireAI('image')) break;
        await run('image', el, async () => {
        const id = project.id;
        const asset = await call('generate-image', structuredClone(project));
        await refresh();
        if (project?.id === id) {
          project.coverId = asset.id;
          project.editor = { ...defaultEditor(), ...project.editor, background: asset.id };
          project.coverDirty = Boolean(project.editor.text.trim() || project.editor.logo);
          await flushSave();
          renderStudio();
        }
        toast('Kapak kütüphaneye kaydedildi.');
      }); break;
      case 'copy-title': await copy(project.titles[Number(el.dataset.index)]); break;
      case 'copy-description': await copy(project.description); break;
      case 'copy-tags': await copy(project.tags.join(', ')); break;
      case 'export-content': await flushSave(); if (await call('export-content', project)) toast('İçerik metni dışa aktarıldı.'); break;
      case 'save-cover': await run('export', el, () => approveCover(false)); break;
      case 'export-cover': await run('export', el, async () => { if (await outputCover(project, false)) toast('PNG kaydedildi.'); }); break;
      case 'save-oauth': await run('oauth-settings', el, async () => { const id = $('#oauth-client').value.trim(); if (state.settings.oauthClientId && id !== state.settings.oauthClientId && state.connected) throw new Error('İstemciyi değiştirmeden önce Kanal Analizi ekranından YouTube bağlantısını kaldırın.'); await call('settings', { oauthClientId: id }); const secret = $('#oauth-secret').value.trim(); if (secret) await call('key', 'oauth-secret', secret); await refresh(); renderSettings(); toast('YouTube bağlantı ayarları kaydedildi.'); }); break;
      case 'check-update': await checkUpdates(el); break;
      case 'open-release': await call('open-release'); closeModal(); break;
      case 'youtube-connect': await run('youtube', el, async () => { await call('youtube-connect'); await refresh(); renderAnalytics(); toast('YouTube hesabı bağlandı.'); await run('sync', null, async () => { state.channel = await call('youtube-sync'); renderAnalytics(); }); }); break;
      case 'youtube-sync': await run('sync', el, async () => { state.channel = await call('youtube-sync'); renderAnalytics(); toast('Kanal verileri güncellendi.'); }); break;
      case 'youtube-disconnect': await run('disconnect', el, async () => { const r = await call('youtube-disconnect'); await refresh(); renderAnalytics(); toast(r.revocationFailed ? 'Yerel bağlantı silindi. Google hesabındaki uygulama iznini de kaldırabilirsin.' : 'YouTube bağlantısı ve yerel analiz verileri kaldırıldı.'); }); break;
      case 'send-chat': await sendChat(el); break;
      case 'clear-chat': await call('clear-chat'); state.chat = []; renderAnalytics(); break;
    }
  } catch (e) { toast(e.message, true); }
});
document.addEventListener('input', e => {
  const el = e.target, id = el.id;
  if (id === 'project-search' || id === 'asset-search') { query = el.value; const pos = el.selectionStart; id === 'project-search' ? renderProjects() : renderLibrary(); const next = $(`#${id}`); next.focus(); next.setSelectionRange(pos, pos); return; }
  if (route !== 'studio' || !project) return;
  if (['brief', 'audience', 'tone', 'points', 'description', 'coverPrompt'].includes(id)) project[id] = el.value;
  else if (id === 'project-name') project.name = el.value || 'İsimsiz içerik';
  else if (id === 'tags') { project.tags = el.value.split(',').map(x => x.trim()).filter(Boolean); $('#tag-count').textContent = `${project.tags.join(', ').length}/500 karakter · Virgülle ayırabilirsin.`; }
  else if (el.dataset.titleIndex !== undefined) {
    const index = Number(el.dataset.titleIndex);
    project.titles[index] = el.value;
    const option = $('#chosen-title')?.options[index];
    if (option) option.textContent = el.value || 'Boş başlık';
  }
  else if (id.startsWith('editor-')) { const prop = id.slice(7); project.editor = { ...defaultEditor(), ...project.editor, [prop]: ['size', 'logoSize'].includes(prop) ? Number(el.value) : el.value }; project.coverDirty = true; drawCover(); }
  else return;
  queueSave();
});
document.addEventListener('change', e => {
  if (e.target.id === 'quick-series' && project) {
    const profile = state.profiles.find(item => item.id === e.target.value);
    const oldProfile = state.profiles.find(item => item.id === project.profileId);
    project.references = (project.references || []).filter(id => !project.quickSeriesReferences?.includes(id));
    if (oldProfile) {
      if (project.audience === oldProfile.audience) project.audience = '';
      if (project.tone === oldProfile.tone) project.tone = '';
      if (project.description === oldProfile.template) project.description = '';
    }
    if (!project.coverId) project.editor = defaultEditor();
    project.profileId = '';
    const manual = new Set(project.references);
    if (profile) applySeries(project, profile);
    project.quickSeriesReferences = project.references.filter(id => !manual.has(id));
    queueSave();
    renderStudio();
    return;
  }
  if (e.target.id === 'chosen-title' && project) {
    project.selectedTitle = Number(e.target.value);
    queueSave();
    return;
  }
  if (e.target.id !== 'project-profile' || !project) return;
  project.profileId = e.target.value;
  const controls = $('#cover-comparison-controls');
  if (controls) controls.outerHTML = coverComparisonControls();
});
document.addEventListener('change', async e => { const el = e.target; try { if (el.id === 'folder-filter') { filterFolder = el.value; renderProjects(); } else if (el.id.startsWith('setting-')) { await call('settings', { [el.id.slice(8)]: el.value }); await refresh(); renderSettings(); } else if (route === 'studio' && ['project-folder', 'project-profile'].includes(el.id)) { project[el.id === 'project-folder' ? 'folderId' : 'profileId'] = el.value; queueSave(); } else if (el.id === 'editor-font') { project.editor.font = el.value; queueSave(); drawCover(); } } catch (err) { toast(err.message, true); } });
document.addEventListener('keydown', e => { const typing = e.target.matches('input,textarea,select,[contenteditable]'); if (e.key.toLowerCase() === 'n' && !typing && !$('#modal').open && !e.ctrlKey && !e.altKey) { e.preventDefault(); newProject().catch(err => toast(err.message, true)); } if (e.key === 'Enter' && e.target.id === 'chat-question' && !e.shiftKey) { e.preventDefault(); sendChat($('[data-action="send-chat"]')); } if (e.key === 'Enter' && e.target.dataset.project) e.target.click(); });
window.addEventListener('beforeunload', e => { if (debounce) { e.preventDefault(); e.returnValue = ''; flushSave().then(() => { debounce = null; window.close(); }); } });
(async () => { try { await refresh(); render(); if (state.updateConfigured) { const r = await call('check-update').catch(() => null); if (r?.available) toast(`Yeni sürüm ${r.version} hazır. Ayarlar’dan güncellemeleri kontrol edebilirsin.`); } } catch (e) { $('#content').innerHTML = `<section class="panel error-panel"><h2>Stüdyo başlatılamadı.</h2><p>${esc(e.message)}</p></section>`; } })();
