# WhatsApp Focus Auto Reply | WhatsApp Odak Modu Otomatik Yanıt

**[English](#english) · [Türkçe](#türkçe)**

> **Unofficial project / Resmî olmayan proje.** Not affiliated with WhatsApp, Meta, or Apple. Uses `whatsapp-web.js`; platform changes and account restrictions are possible. / WhatsApp, Meta veya Apple ile bağlantılı değildir. `whatsapp-web.js` kullanır; platform değişiklikleri ve hesap kısıtlamaları mümkündür.

---

<a id="english"></a>
## English

### What does it do?

Automatically sends a customizable WhatsApp reply to **selected contacts only** when an iPhone Focus Mode turns on, using a Windows computer, iOS Shortcuts, Node.js and Tailscale. It stops replying when Focus Mode turns off. Each eligible contact receives **at most one reply attempt per Focus session**. Group chats are excluded.

### Requirements

- Windows computer with **Node.js 22+** and npm
- iPhone with the **Shortcuts** app and Focus automations
- **Tailscale** installed and connected on both devices (same tailnet)
- A WhatsApp account that can authorize a linked device by QR code
- The PC must remain awake, connected to the internet, and running the program while automation is needed. **Publishing on GitHub does not host the bot.**

### 1. Connect both devices

1. Install [Node.js](https://nodejs.org/) on your Windows PC.
2. Install [Tailscale](https://tailscale.com/download) on both the PC and iPhone. Sign in to the same tailnet and turn the connection on.
3. Find the **PC's** Tailscale IPv4 address (typically `100.x.x.x`). Do not use your iPhone's address. Your phone can use cellular data; both devices do not need to share Wi-Fi.

### 2. Set up the app (Windows)

1. Download the project with **Code → Download ZIP** and extract it to a permanent folder. Do not launch scripts from inside the ZIP.
2. Double-click **`KURULUM.cmd`**. When prompted, enter the PC Tailscale IP and the **allowed contact numbers** in international format, separated by commas (illustrative numbers only: `+905321234567,+420123456789`).
3. Setup creates **`config.json`** and **`IPHONE-AYARLARI.txt`** on your computer. They contain personal details and a secret API token and are deliberately excluded from Git.
4. Optionally edit the `message` property in local **`config.json`** to customize the reply, then restart the app. Rerunning setup restores the default reply text.
5. Double-click **`BASLAT.cmd`**, then open **WhatsApp → Settings → Linked Devices → Link a Device** on your phone and scan the QR code shown in the terminal. Wait for the WhatsApp-ready message.

**Terminal alternative:** `npm ci` → `npm run setup` → `npm start`. Run tests with `npm test`.

### 3. Create iPhone Shortcuts automations (important)

Open the locally generated **`IPHONE-AYARLARI.txt`** to find your **exact URL and Bearer token**. Do not publish or send this file to others.

**Automation A — when Focus turns ON**

1. Open **Shortcuts → Automation → +**, choose the Focus Mode you use (e.g., Do Not Disturb), and select **When Turning On**.
2. Choose **Run Immediately**, then create a new blank automation.
3. Add **Get Contents of URL** (`URL İçeriğini Al`). Set the URL to `http://<PC-TAILSCALE-IP>:8787/focus` (replace the placeholder with the PC address from your file).
4. Expand the action settings and set **Method: POST**.
5. Add the request header **`Authorization`** with value **`Bearer <YOUR-LOCAL-TOKEN>`** (one space after `Bearer`). Copy the exact value from `IPHONE-AYARLARI.txt`.
6. Set **Request Body: JSON**. Add key **`active`**, type **Boolean**, value **`true`**. Do **not** use a text/string field.
7. Temporarily add **Show Result** to inspect the response. Success includes `ok: true` and `focus: true`. Save the automation, approve network access if prompted, and test while locked too.

**Automation B — when Focus turns OFF**

Repeat the steps above, but choose **When Turning Off**, and send **`active` = Boolean `false`** to the same URL with the same Bearer header. Success should include `focus: false`.

Create a matching on/off pair for every Focus Mode you want to support. Start testing with just one Focus Mode; if modes overlap or change rapidly, the last successfully delivered request controls the state.

### 4. Check the connection and test

1. Keep the PC app running and the Tailscale connection on both devices active.
2. On iPhone (try using cellular data), open `http://<PC-TAILSCALE-IP>:8787/health` in Safari. Look for `whatsappReady: true`. The health URL **does not** switch the automation on.
3. With Focus off, ask an allowed contact to message you: no auto-reply should be sent.
4. Enable Focus and verify the request succeeded. After a few seconds, ask that contact to send a **new private message**: they should get one reply.
5. Have them send a second message during that Focus session: no second reply. Non-allowed contacts and group conversations should not receive replies.
6. Turn Focus off and verify its request succeeded. Further messages should not trigger replies.

### Troubleshooting and security

- **Can't reach `/health`:** Confirm Tailscale is running on both devices, check the PC's IP, and ensure the PC is awake. If necessary, permit inbound TCP port 8787 **from Tailscale addresses only** using an administrator PowerShell:

  ```powershell
  New-NetFirewallRule -DisplayName "WhatsApp Focus Tailscale" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787 -RemoteAddress 100.64.0.0/10 -Profile Any
  ```

  Remove this optional rule with `Remove-NetFirewallRule -DisplayName "WhatsApp Focus Tailscale"`.
- **WhatsApp not ready:** Keep `BASLAT.cmd` open and check QR linking and internet access.
- **No reply:** Verify both Focus automations use POST, the exact Bearer header, JSON request body, and **Boolean** `active` (not a string). Check the allowlist and WhatsApp-ready status.
- **Focus turned off but bot remains active:** An offline iPhone, unavailable PC or interrupted Tailscale connection can prevent the OFF request from reaching the PC. Restore connectivity and toggle Focus to resynchronize. This version does not continuously poll Focus state.
- **After restarting the app or losing WhatsApp connection, auto-reply is off** by default. Toggle Focus off and on after everything reconnects.
- Do **not** commit `config.json`, `IPHONE-AYARLARI.txt`, `.wwebjs_auth/`, `.wwebjs_cache/`, or `node_modules/`. The project's `.gitignore` excludes them from new ordinary commits. Screenshots and logs can also expose identities.
- A leaked API token or WhatsApp linked session must be revoked/rotated. `/health` is unauthenticated; access should be limited to trusted tailnet devices.
- The app never sends messages just because Focus is enabled. A **new allowed private message** is required. Send attempts are limited to once per allowed contact per Focus session, and failed attempts are not automatically retried.
- This is an **unofficial** WhatsApp integration; compatibility and account availability cannot be guaranteed. Use only with an account you control and in compliance with platform rules.

---

<a id="türkçe"></a>
## Türkçe

### Bu proje ne yapar?

Windows bilgisayarı, iPhone Kestirmeler, Node.js ve Tailscale kullanarak **iPhone Odak Modu açıldığında** yalnızca **izin verdiğiniz kişilerin** yeni WhatsApp özel mesajlarına otomatik yanıt gönderir. Odak kapatıldığında yanıt vermeyi durdurur. Her Odak oturumunda, kişi başına **en fazla bir gönderim denemesi** yapılır. Gruplara yanıt gönderilmez.

### Gereksinimler

- Windows bilgisayar ve **Node.js 22+** / npm
- **Kestirmeler** uygulaması ve Odak otomasyonları bulunan iPhone
- İki cihazda da kurulu ve aynı tailnet'e bağlı **Tailscale**
- QR kodla bağlantı kurulabilen WhatsApp hesabı
- Otomasyonun çalışması için bilgisayarın açık, uyanık, internete bağlı olması ve uygulamanın çalışması gerekir. **GitHub kodu otomatik olarak çalıştıran bir sunucu değildir.**

### 1. Cihazları bağlayın

1. Windows'a [Node.js](https://nodejs.org/) kurun.
2. Hem PC'ye hem iPhone'a [Tailscale](https://tailscale.com/download) kurun; aynı hesaba/tailnet'e bağlanıp bağlantıyı açın.
3. Bilgisayarın Tailscale IPv4 adresini (`100.x.x.x`) bulun. **iPhone'un IP'sini kullanmayın.** Telefon mobil veride de olabilir; aynı Wi-Fi zorunlu değildir.

### 2. Windows kurulumu

1. GitHub'dan **Code → Download ZIP** ile indirin, ZIP'i kalıcı bir klasöre çıkarın; içinden doğrudan çalıştırmayın.
2. **`KURULUM.cmd`** dosyasını çalıştırın. İstendiğinde PC'nin Tailscale IP adresini ve otomatik yanıt izni verdiğiniz telefon numaralarını **ülke koduyla ve virgülle ayrılmış** biçimde girin (temsili örnek: `+905321234567,+420123456789`).
3. Kurulum yalnızca sizin bilgisayarınızda **`config.json`** ile **`IPHONE-AYARLARI.txt`** dosyalarını üretir. Bu dosyalar numaralarınızı ve gizli API anahtarını içerir; GitHub'a eklenmez.
4. İsterseniz `config.json` içindeki `message` alanından otomatik yanıt metnini düzenleyin ve programı yeniden başlatın. Kurulumu tekrar çalıştırırsanız mesaj varsayılan metne döner.
5. **`BASLAT.cmd`** dosyasını çalıştırın. iPhone'da **WhatsApp → Ayarlar → Bağlı Cihazlar → Cihaz Bağla** menüsüyle terminaldeki QR kodu okutun. WhatsApp hazır mesajını bekleyin.

**Terminal alternatifi:** `npm ci` → `npm run setup` → `npm start`. Testleri çalıştırmak için `npm test`.

### 3. iPhone Kestirmeler otomasyonları (önemli)

Kurulumla oluşturulan **`IPHONE-AYARLARI.txt`** dosyasını açın. Kendi **URL adresiniz** ve **Bearer anahtarınız** oradadır. Bu dosyayı paylaşmayın.

**Otomasyon A — Odak açıldığında**

1. **Kestirmeler → Otomasyon → + → kullandığınız Odak modu** (ör. Rahatsız Etme) yolunu açın; **Açıldığında** seçin.
2. **Hemen Çalıştır** seçeneğini seçip yeni boş otomasyon oluşturun.
3. **URL İçeriğini Al (Get Contents of URL)** eylemini ekleyin. URL alanına dosyanızdaki `http://<PC-TAILSCALE-IP>:8787/focus` adresini yazın (yer tutucuyu PC'nizin gerçek adresiyle değiştirin).
4. Eylemin ayrıntılarında **Yöntem: POST** seçin.
5. Başlık (**Header**) ekleyin: anahtar **`Authorization`**, değer **`Bearer <YEREL-GIZLI-ANAHTAR>`**. `Bearer` ile anahtar arasında bir boşluk olmalı; tam değeri `IPHONE-AYARLARI.txt` dosyasından kopyalayın.
6. **İstek Gövdesi: JSON** seçin. Alan adı **`active`**, türü **Boolean / Boole**, değeri **`true` (doğru)** olmalı. Metin türü seçmeyin.
7. İlk denemede **Sonucu Göster** ekleyin. Başarılı yanıtta `ok: true` ve `focus: true` görünür. Otomasyonu kaydedin; ağ erişimi iznini verin ve kilit ekranında da deneyin.

**Otomasyon B — Odak kapandığında**

Yukarıdaki adımları ikinci bir otomasyonda tekrarlayın: bu kez **Kapatıldığında** seçin, aynı URL ve Bearer başlığıyla **`active` = Boolean `false` (yanlış)** gönderin. Başarılı yanıtta `focus: false` görünür.

Birden fazla Odak modu kullanıyorsanız her biri için açılma/kapanma çifti oluşturun. Önce tek Odak ile test edin; hızlı Odak değişimlerinde sunucuya **en son ulaşan** istek geçerli olur.

### 4. Bağlantı testi

1. Program ve Tailscale iki cihazda da açık olsun.
2. iPhone Safari'de (mümkünse mobil veriyle) `http://<PC-TAILSCALE-IP>:8787/health` adresini açın. `whatsappReady: true` görmelisiniz. **Bu adres otomatik yanıtı açmaz.**
3. Odak kapalıyken izinli kişiden mesaj isteyin: yanıt gitmemeli.
4. Odak'ı açıp isteğin başarılı olduğunu doğrulayın. Birkaç saniye sonra izinli kişi **yeni bir özel mesaj** atsın: bir otomatik yanıt almalı.
5. Aynı kişi yeniden yazdığında ikinci yanıt gitmemeli. İzinli olmayan numaralara ve gruplara da yanıt gitmemeli.
6. Odak'ı kapatıp kapatma isteğinin başarılı olduğunu doğrulayın. Sonraki mesajlarda otomatik yanıt olmamalı.

### Sorun giderme ve güvenlik

- **`/health` açılmıyor:** Her iki cihazda Tailscale'i, PC IP'sini ve bilgisayarın uyku durumunu kontrol edin. Gerekirse yalnızca Tailscale IP aralığından gelen TCP 8787 bağlantılarına izin vermek için yönetici PowerShell kullanın:

  ```powershell
  New-NetFirewallRule -DisplayName "WhatsApp Focus Tailscale" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787 -RemoteAddress 100.64.0.0/10 -Profile Any
  ```

  Bu isteğe bağlı kuralı kaldırmak için: `Remove-NetFirewallRule -DisplayName "WhatsApp Focus Tailscale"`.
- **WhatsApp hazır değil:** `BASLAT.cmd` açık kalsın; QR eşlemesini ve interneti kontrol edin.
- **Yanıt gelmiyor:** Her iki otomasyonda da POST, doğru Bearer başlığı, JSON gövdesi ve metin değil **Boolean** `active` kullandığınızdan emin olun. İzinli kişi listesini ve WhatsApp bağlantısını kontrol edin.
- **Odak kapalı ama yanıt devam ediyor:** Kapanış isteği internet/Tailscale/PC bağlantısı nedeniyle ulaşmamış olabilir. Bağlantıyı düzeltip Odak'ı açıp kapatarak eşitleyin. Bu sürüm Odak durumunu sürekli sorgulamaz.
- **Program yeniden başladığında veya WhatsApp bağlantısı koptuğunda** otomatik yanıt güvenlik için kapalı başlar. Bağlantı sağlanınca Odak'ı kapatıp tekrar açın.
- **`config.json`, `IPHONE-AYARLARI.txt`, `.wwebjs_auth/`, `.wwebjs_cache/`, `node_modules/` dosya/klasörlerini GitHub'a yüklemeyin.** `.gitignore` normal yeni commit'lerde bunları dışlar. Loglarda ve ekran görüntülerinde de numaralar bulunabilir.
- API anahtarınız veya WhatsApp oturumunuz açığa çıktıysa yenileyin / bağlı cihaz oturumunu iptal edin. `/health` kimlik doğrulaması gerektirmez; yalnızca güvenilir Tailscale cihazlarının erişebildiğinden emin olun.
- Odak açılınca kendiliğinden mesaj gönderilmez; **izinli kişiden yeni özel mesaj** gelmesi gerekir. Her kişi için oturum başına en fazla bir gönderim denemesi yapılır; başarısız gönderimler otomatik tekrarlanmaz.
- Bu **resmî olmayan** bir WhatsApp entegrasyonudur; uyumluluk ve hesap erişimi garanti edilemez. Yalnızca kontrolünüzdeki hesaplarda ve platform kurallarına uygun kullanın.

---

## Project files / Proje dosyaları

| File / Dosya | Purpose / Amaç |
|---|---|
| `app.cjs` | WhatsApp connection and HTTP API / WhatsApp bağlantısı ve HTTP API |
| `core.cjs` | Reply filters / Yanıt filtreleri |
| `core.test.cjs` | Unit tests / Birim testleri |
| `setup.cjs` | Local settings + token / Yerel ayarlar ve token |
| `KURULUM.cmd` | Windows setup / Windows kurulumu |
| `BASLAT.cmd` | Launch application / Uygulamayı başlatma |

## Contributing / Katkı

Issues and pull requests are welcome. **Never publish personal phone numbers, API tokens, WhatsApp QR codes or session directories in bug reports.** / Issue ve pull request açabilirsiniz. **Hata raporlarında özel numara, token, QR kod veya oturum dosyası paylaşmayın.**

**License / Lisans:** No open-source license has been selected yet. Add a `LICENSE` file to grant reuse/distribution rights. / Henüz açık kaynak lisansı seçilmedi. Yeniden kullanım/dağıtım haklarını belirlemek için `LICENSE` dosyası ekleyin.

References / Kaynaklar: [whatsapp-web.js guide](https://wwebjs.dev/guide/creating-your-bot/), [Tailscale](https://tailscale.com/download).
