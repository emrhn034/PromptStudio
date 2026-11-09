# PromptStudio

Türkçe YouTube içerik ve kapak stüdyosu. Uygulama kaynakları `PromptStudio/` klasöründedir.

[Windows kurulum paketini GitHub Releases üzerinden indir](https://github.com/emrhn034/PromptStudio/releases/latest).

Ana ekrandaki **Kapak ve metin hazırla** akışı, video konusu ve referans görsellerinden kapak, başlık, açıklama ve etiket üretir. ChatGPT hesabıyla kullanım için [Codex CLI](https://developers.openai.com/codex/cli) gerekir. Mevcut seri şablonları görselleri, logoyu ve kapak stilini sonraki projeye taşır.

- Çalıştır: `PromptStudio/BASLAT.bat`
- Geliştirme: `cd PromptStudio`, `npm ci`, `node node_modules/electron/install.js`, `npm start`
- Kontrol: `npm run check`, `npm test`, `npm run test:desktop`
- Paketleme: `npm run dist -- --publish never`
- [Kullanım, YouTube kurulumu, veri saklama ve sürüm dağıtımı](PromptStudio/README_TR.md)

`v*.*.*` etiketi gönderildiğinde `.github/workflows/release.yml` Windows kurulum paketini oluşturup Release olarak yayımlar. Etiket `PromptStudio/package.json` sürümüyle eşleşmelidir. Uygulama yeni sürümleri bu deponun Release sayfasından kontrol eder. Kullanıcı anahtarları ve kişisel veriler yerelde tutulur.
