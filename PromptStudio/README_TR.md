# PromptStudio · Windows içerik stüdyosu

Türkçe arayüzlü, üyelik gerektirmeyen YouTube içerik hazırlama uygulaması. Kullanıcı videonun konusunu anlatıp kendi AI API anahtarıyla başlık, açıklama, etiket ve kapak üretir. Hazır videolar ayrı Yayın kuyruğu ekranından platformlara gönderilebilir.

## Çalıştırma

- Hazır paket: [GitHub Releases](https://github.com/emrhn034/PromptStudio/releases/latest). Son kullanıcı için Node.js veya Python gerekmez.
- Bu klasörde hızlı başlangıç: `BASLAT.bat`. Hazır uygulama varsa onu açar, yoksa geliştirme sürümünü çalıştırır.
- Kaynaktan geliştirme: Node.js 22.12+; `npm ci`, `node node_modules/electron/install.js`, ardından `npm start`.
- Kontroller: `npm run check`, `npm test`, `npm run test:desktop`.
- Windows paketi: `EXE_OLUSTUR.bat` veya `npm run dist -- --publish never`.

## Kullanım

1. Ayarlar → Yapay zekâ bağlantıları bölümünden kendi anahtarını ekle. Metin ve görsel üretimi için ayrı sağlayıcı seçebilirsin.
2. Yeni içerik oluştur. Videonun konusunu birkaç cümleyle anlat. Hedef kitle, ton, senaryo ve önemli noktalar isteğe bağlıdır.
3. Başlık, açıklama ve etiketleri üret; düzenle, kopyala veya metin dosyası olarak dışa aktar.
4. Referans görsellerini kütüphaneye ekle. Her görsele kişi, ürün, logo, stil veya arka plan rolü; serbest yönlendirme ve etiketler yaz.
5. Kapak stüdyosunda AI görseli üret veya kütüphaneden görsel seç. İstersen yazı ve logo ekle, sürükle, renk ve font değiştir. 1280 × 720 PNG indir veya kütüphaneye kaydet.
6. Koleksiyonlar serilerini gruplamak içindir. Profiller hedef kitle, ton, kapak stili, açıklama şablonu ve bağlantıları tekrar kullanmanı sağlar.

Metin sağlayıcıları: OpenAI, Claude, Gemini, DeepSeek, xAI, Mistral, Groq, OpenRouter. Görsel üretimi: OpenAI ve Gemini. Diğer sağlayıcılarda görsel üretme desteği iddia edilmez. Model kimlikleri Ayarlar’dan düzenlenebilir; erişim sağlayıcı hesabına bağlıdır. Anahtar testi de küçük bir ücretli API isteğidir. Uygulama hiçbir sağlayıcıya ait aboneliği içermez.

## İçerik paketi ve seri şablonları

Ana ekrandaki Kapak ve metin hazırla düğmesiyle hızlı üretimi aç. İlk kullanımda ChatGPT ile giriş yap. Resmi Codex CLI kurulu değilse açılan kurulum kılavuzunu izle. Geçerli bir ChatGPT oturumu, metin ve görsel üretimi için birlikte kullanılır. Kullanım hesabının Codex sınırlarına bağlıdır.

Video konunu yaz, en fazla beş referans seç ve Kapak ve metin oluştur düğmesine bas. Kapak stüdyosundaki Bu kapağı seri örneği yap düğmesi, seçili kanal profiline referanslarla birlikte onaylı kapağı kaydeder. Sonraki videoda aynı şablonu seçtiğinde bu görseller yeniden kullanılır.

İçerik metinlerinde paket için başlığı seç. Başlık alternatifi ekleyebilir, açıklamayı veya etiketleri ayrı ayrı yenileyebilirsin. Kapak stüdyosunda düzeni seçip kapağı onayla. Yayına hazırla sekmesinde seçili metni kopyalayabilir veya indirebilir, kapağı PNG olarak alabilir ve mevcut projeyi yayın kuyruğu onay ekranına taşıyabilirsin.

Kanal profillerindeki Bu şablonla yeni içerik düğmesi, profili ve kayıtlı kapak düzenini yeni projeye taşır. Var olan bir projede Seri şablonu uygula düğmesini kullan. Proje kartındaki Devam et, eksik adımdan açılır. Kanal analizinde Bu videodan yeni fikir oluştur düğmesi, seçili videonun kaynağını yeni taslağa ekler.

## Kapak varyasyonları, video raporu ve fikir araştırması

Kapak stüdyosunda Üç konsept öner ile başlık, kısa kapak yazısı ve görsel fikri içeren üç aday al. Birini seçip Kapak üret düğmesine bas. Düzenlediğin kapak seçili başlıkla küçük bir YouTube kartında görünür. OpenRouter’ı hızlı kurulumdan bağlamak, metin ve kapak üretimini aynı hesaba bağlar.

- Kapak editöründe A/B/C karşılaştır ile mevcut görsel ve yazıdan üç düzen oluştur. Düzeni seçip düzenleyebilir, kanal profiline renk, yazı tipi ve yerleşim şablonu olarak kaydedebilirsin. Bu işlem yeni bir görsel üretim isteği göndermez.
- Kanal analizinde YouTube verilerini yenile. Video raporu bölümünden bir video seçerek izleyici tutma eğrisini ve trafik kaynaklarını aç.
- Fikir laboratuvarında bir konu yaz. Bağlı YouTube hesabını veya ayrı Data API anahtarını ve seçili metin sağlayıcını kullanarak ilgili videolardan ve herkese açık yorumlardan kaynaklı fikirler al. Bir fikri çekim planıyla projeye dönüştürebilirsin.

## Yayın kuyruğu

Sol menüde Yayın kuyruğu’nu aç. Hedef hesabı bağla, Gönderim oluştur ile projeyi ve videoyu seç, hedef hesabı kontrol et ve gönderimi onayla. Tarihi boş bırakırsan aktarım sıradaki kuyruk kontrolünde başlar. Kuyruk yerelde saklanır. Uygulama, bilgisayar ve internet açık olmalıdır. On dakikadan uzun gecikmede kayıt kontrol için bekletilir. Aktarımı kesilen kayıt otomatik tekrar gönderilmez.

- YouTube için Ayarlar’daki Google Masaüstü OAuth istemcisini kullan ve Yayın kuyruğu’ndan ayrıca yükleme izni ver. Yerel MP4, MOV veya WebM dosyası kullanılır. Görünürlük ve çocuklara özel içerik seçimi zorunludur. Uygun kayıtlı PNG/JPEG kapak varsa aktarım sonrası uygulanması denenir. Kanal Analizi bağlantısı ayrı kalır.
- Instagram için profesyonel hesap, Meta uygulamasından alınan Instagram kullanıcı belirteci ve `instagram_business_basic` ile `instagram_business_content_publish` izinleri gerekir. Meta’nın erişebileceği doğrudan HTTPS video adresi kullanılır. Meta video işlemesini bitirince Reels yayımlanır.
- TikTok için `video.upload` ile `user.info.basic` izinleri olan geliştirici uygulaması kullanıcı belirteci gerekir. Yerel dosya TikTok gelen kutusuna gönderilir. Gönderiyi TikTok uygulamasında açıp açıklamayı ekle ve paylaşımı tamamla.

Yayın hesabı belirteçleri mevcut güvenli anahtar depolamasıyla tutulur. Kuyruk, seçilen yerel dosyanın yolunu saklar, dosyayı kopyalamaz. Dosyayı planlanan zamana kadar taşımayın veya değiştirmeyin. Gerçek platform bağlantıları ve aktarım, geçerli hesaplar ve uygulama izinleriyle ayrıca doğrulanmalıdır.

## YouTube analiz bağlantısı

Geliştirici kurulumu gerektirir; bir API anahtarı Google OAuth istemcisinin yerine geçmez.

1. Google Cloud projesinde YouTube Data API v3 ve YouTube Analytics API etkinleştirilir.
2. OAuth izin ekranı yapılandırılır. Test aşamasında kullanılacak Google hesapları test kullanıcılarına eklenir.
3. Desktop app / Masaüstü uygulaması türünde OAuth istemcisi oluşturulur. İstemci kimliği ve Google’ın verdiği istemci gizli değeri Ayarlar’a girilir.
4. Kanal Analizi → YouTube hesabını bağla seçilir. Tarayıcıda kullanıcı kendi hesabıyla yetkilendirir.
5. Herkese dağıtımdan önce Google’ın geçerli OAuth doğrulama, gizlilik politikası ve uygulama yayımlama gereklilikleri tamamlanmalıdır. Test modundaki OAuth bağlantıları kalıcı dağıtım çözümü değildir.

PKCE ve rastgele state kullanılır, yönlendirme yalnızca 127.0.0.1 üzerindeki geçici bir porta yapılır. İzinler yalnızca youtube.readonly ve yt-analytics.readonly; video yükleme/değiştirme izni istenmez. Tokenlar Windows güvenli depolamasıyla şifrelenir. Bağlantı kaldırıldığında Google token iptali denenir; yerel token, rapor ve kanal sohbeti silinir. Ağ yüzünden iptal başarısızsa Google hesabından iznin kaldırılabileceği bildirilir.

Analiz: son tamamlanmış 28 günlük rapor (gecikmeli veriler için son üç gün hariç), günlük görüntülenme, izlenme süresi, kazanılan abone ve son 30 video. Asistan bu verileri bağlam olarak kullanır. Saatlik “izleyicilerin ne zaman YouTube’da olduğu” verisi API’den alınmaz. Yayın saati önerileri deney/çıkarım olarak sunulur, kesin en iyi saat iddia edilmez. Videoların ömür boyu toplamları yaş ve içerik farklılıklarından etkilenir.

## GitHub ve güncellemeler

Kaynaklar `PromptStudio/` altındadır. Windows sürümleri [emrhn034/PromptStudio](https://github.com/emrhn034/PromptStudio) deposunda yayımlanır.

1. Kaynakları kendi GitHub depona ekle. node_modules, release, API anahtarları ve kullanıcı verilerini gönderme.
2. Dağıtım için `PromptStudio/desktop/distribution.json` içindeki `githubRepo` alanına `kullanici/depo` yaz. Boş bırakılırsa güncelleme denetimi yapılmaz.
3. Yeni sürüm için PromptStudio/package.json sürümünü artır; kilit dosyasını da güncelle. Aynı sürümle v0.2.1 gibi bir Git etiketi gönder.
4. Üst klasördeki .github/workflows/release.yml Windows üzerinde kontrolleri çalıştırır, NSIS kurulum dosyası oluşturur ve GitHub Release’e ekler.
5. Uygulama açılışta son kararlı Release’i denetler; yeni sürüm varsa bildirim verir. Ayarlar’dan elle denetlenebilir. Sürüm sayfası açılır; kullanıcı yeni kurulum dosyasını indirip çalıştırır. Sessiz/otomatik kurulum yapılmaz.

Denetim herkese açık GitHub deposu içindir. Sıradan commit oluşturmak güncelleme bildirimi göndermez; Release yayımlamak gerekir. Kurulum paketi şu anda kod imzasızdır. GitHub Actions üçüncü taraf eylemleri kullanır.

## Yerel saklama ve silme

Veriler Electron’un kullanıcı veri klasöründeki library.json ve assets/ içinde saklanır (Windows’ta genellikle %APPDATA%/promptstudio). API/OAuth anahtarları Windows hesabına bağlı Electron safeStorage ile şifreli ayrı dosyalardır; arayüz sürecine geri verilmez. Güvenli depolama kullanılamazsa anahtarlar yalnızca bellekte tutulur ve arayüzde belirtilir.

Projeler otomatik kaydedilir. Görsel silmek uygulama içindeki kopyasını fiziksel olarak kaldırır ve projelerdeki referanslarını temizler. Bir projeyi silmek ortak görsel kütüphanesini silmez. Koleksiyon silmek projeleri koleksiyonsuz bırakır. Seçilen orijinal görseller değiştirilmez. Uygulama kaldırıldığında çalışmaların korunması güncellemeler için varsayılandır; uygulama içindeki silme işlemleri yerel veriyi kaldırır. Diskte adli olarak geri getirilemez silme garantisi verilmez.

AI çağrılarında ilgili metinler seçilen sağlayıcıya; kapak üretiminde seçilen referans görselleri de görsel sağlayıcısına gönderilir. Kanal sohbetinde kanal raporu, son video bilgileri ve son sohbet mesajları seçilen metin sağlayıcısına gönderilir. Yerel kayıt bulut eşitlemesi yapmaz. Telemetri veya kullanıcı hesabı yoktur. GitHub deposu tanımlanırsa açılışta sürüm denetimi ağ isteği gönderir.

## Doğrulama

- Veri kalıcılığı/silme, JSON yanıt doğrulama, sekiz sağlayıcının istek biçimleri, referanslı görsel üretimi istekleri, OAuth PKCE/state, token yenileme, kanal raporu ve sürüm karşılaştırması otomatik testlerle kapsanır.
- Gerçek Electron arayüzünde proje oluşturma, koleksiyon/profil kaydı, görsel notu, kapak düzenleme/PNG kaydı, yerel görsel yükleme, tema ve eksik anahtar hatası sınanır. Testler ayrı bir yerel kütüphane kullanır.
- Ücretli AI servisleri ve canlı Google hesabı, kullanıcı anahtarları/yetkilendirmesi olmadan uçtan uca doğrulanmış değildir. Model erişimi, kota ve OAuth yayımlama ayarları canlı kurulumda ayrıca doğrulanmalıdır.
- Eski Python prototipi prompt_studio.py içinde korunur; yeni uygulama bunu çalıştırmaz ve eski SQLite verisini otomatik taşımaz.

## Kaynak belgeler

- [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [OpenAI image edits](https://developers.openai.com/api/reference/resources/images/methods/edit)
- [Gemini generateContent](https://ai.google.dev/api/generate-content)
- [Claude Messages](https://platform.claude.com/docs/en/api/messages)
- [Google Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app)
- [YouTube Analytics boyutları](https://developers.google.com/youtube/analytics/dimensions)

### Dağıtım varsayılanları

Herkese paylaşmadan önce `desktop/distribution.json` dosyasına GitHub deposunu ve doğrulanmış Google Masaüstü OAuth istemci bilgilerini girip yeniden paketleyin. Yeni kurulumlar bunları hazır alır; kullanıcıların kendi Google Cloud projesini oluşturması gerekmez. Kullanıcıların AI API anahtarları bu dosyaya yazılmaz. Masaüstü OAuth istemci gizli değeri dağıtılan uygulamadan çıkarılabilir; Google’ın yerel uygulamalar modelinde gizli sunucu anahtarı sayılmaz. PKCE bu nedenle kullanılır. Google servis hesabı veya sunucu gizli anahtarı gömmeyin.
