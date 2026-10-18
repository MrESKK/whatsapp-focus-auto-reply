# iPhone Odak → WhatsApp otomatik yanıt

Windows PC + iPhone iOS 26 için başlangıç paketi. Bilgisayar açık, uyanık, internete bağlı ve BASLAT.cmd penceresi açık kalmalıdır. Telefonun aynı Wi-Fi ağında olması gerekmez.

## 1. PC ve telefon bağlantısı

1. PC'ye Node.js 22 veya daha yeni LTS kurun: https://nodejs.org/
2. PC ve iPhone'a Tailscale kurun: https://tailscale.com/download
3. İkisinde de aynı hesapla giriş yapın ve bağlantıyı açın. iPhone mobil verideyken de Tailscale bağlı kalmalı. Başka VPN kullanımı bağlantıyı etkileyebilir.
4. PC'nin Tailscale uygulamasındaki **100.x.x.x IPv4 adresini** bulun. iPhone'un adresini kullanmayın.

Tailscale kişisel planı bu tür kişisel kullanım için ücretsizdir; güncel koşullar: https://tailscale.com/pricing

## 2. Programın kurulması

1. ZIP'i kalıcı bir klasöre çıkarın (ZIP'in içinden çalıştırmayın).
2. **KURULUM.cmd** dosyasına çift tıklayın. İlk kurulumda tarayıcı bileşeni indirileceğinden birkaç dakika sürebilir.
3. PC'nin Tailscale IP adresini girin.
4. Otomatik yanıt alacak kişilerin numaralarını ülke koduyla, virgülle ayırarak girin. Örnek: `+905321234567,+420123456789`. Türk numarasında +90'dan sonra baştaki 0'ı yazmayın. Bunlar örnek numaralardır; kendi seçiminizi girin.
5. **BASLAT.cmd** dosyasını açın.
6. iPhone → WhatsApp → Ayarlar → Bağlı Cihazlar → Cihaz Bağla yoluyla ekrandaki QR kodunu okutun.
7. Konsolda **WhatsApp hazır** mesajını bekleyin.

Program yalnızca PC'nin Tailscale IP adresinde dinler, internete açık bir port açmanız gerekmez. Windows güvenlik duvarı engellerse genel erişim vermek yerine yönetici PowerShell'de yalnızca Tailscale ağından bu porta izin verin:

```powershell
New-NetFirewallRule -DisplayName "WhatsApp Odak Tailscale" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8787 -RemoteAddress 100.64.0.0/10 -Profile Any
```

Bu kural yalnızca gerekirse eklenir. Kaldırmak için:

```powershell
Remove-NetFirewallRule -DisplayName "WhatsApp Odak Tailscale"
```

## 3. iPhone'da iki otomasyon

Kurulumdan sonra oluşan **IPHONE-AYARLARI.txt** dosyasını PC'de açın. URL ve gizli anahtar oradadır. Bu dosyayı veya QR kodunu kimseyle paylaşmayın.

### Odak açılınca

1. Kestirmeler → Otomasyon → + → kullandığınız Odak modu (ör. Rahatsız Etme).
2. **Açıldığında** seçin, **Hemen Çalıştır** seçin.
3. Yeni boş otomasyon oluşturun; **URL İçeriğini Al / Get Contents of URL** eylemini ekleyin.
4. URL: dosyadaki `http://100.x.x.x:8787/focus` adresi.
5. Ayrıntıları açın, yöntem **POST**.
6. Başlık ekleyin: anahtar **Authorization**, değer dosyadaki **Bearer ...** ifadesi. Bearer sözcüğü ile anahtar arasında bir boşluk olmalı.
7. İstek gövdesi **JSON**. Alan adı **active**, türü **Boolean / Boole**, değeri **doğru / true / açık**. Metin türünü seçmeyin.
8. Sonuna **Sonucu Göster / Show Result** ekleyin ve ilk denemede sonucu kontrol edin. Başarılı yanıt `ok: true` ve `focus: true` içerir. Kontrolden sonra bu gösterme eylemini kaldırabilirsiniz.
9. Kaydedin. İlk çalıştırmada ağ erişimi sorulursa izin verin; kilit ekranında da ayrıca test edin.

### Odak kapanınca

Aynı adımlarla ikinci otomasyon oluşturun; bu kez **Kapatıldığında**, JSON alanı **active = false** (Boolean) olsun. Başarı yanıtında `focus: false` görünür.

Birden fazla Odak kullanıyorsanız her biri için açılma ve kapanma otomasyonu ekleyin. Odak değişimleri hızlı gerçekleşirse son ulaşan istek geçerlidir; ilk kurulumu tek Odak üzerinde test edin.

## 4. Gerçek test

1. Odak kapalıyken seçili kişiden mesaj isteyin: yanıt gitmemeli.
2. iPhone'da Wi-Fi'ı kapatın, mobil veri ve Tailscale açık kalsın.
3. Safari'de `http://PC-TAILSCALE-IP:8787/health` açın. `whatsappReady: true` görünmeli. Bu sayfa otomatik yanıtı açmaz.
4. Odak açın; konsolda AÇIK yazısını veya JSON başarı yanıtını görün.
5. Seçili kişi yeni özel mesaj göndersin: yazdığınız otomatik yanıt bir kere gitmeli. İlk saniyenin içindeki mesajlar tarih filtresine takılabilir; birkaç saniye bekleyip deneyin.
6. Aynı kişi tekrar yazsın: ikinci yanıt gitmemeli.
7. Seçili olmayan bir kişi ve bir grup mesaj göndersin: yanıt gitmemeli. Seçili kişinin gruptaki mesajı da yanıtlanmaz.
8. Odak kapatın; konsolda KAPALI yazısını görün. Diğer seçili kişiden yeni mesaj isteyin: yanıt gitmemeli.

## Davranış ve sınırlar

- Yalnızca gelen yeni özel mesajlar değerlendirilir. Açılışta geçmiş mesajlara yanıt verilmez. Odak açılması tek başına kimseye mesaj göndermez.
- Her seçili kişiye her Odak oturumunda en fazla bir gönderim denemesi yapılır. Başarısız gönderim aynı oturumda otomatik tekrarlanmaz.
- Numara güvenilir biçimde çözümlenemezse yanıt gönderilmez.
- Program yeniden açılınca veya WhatsApp bağlantısı kopunca otomatik yanıt kapanır. Yeniden hazır olduktan sonra Odak modunu kapatıp açın.
- Telefon internetsizken veya Tailscale kapalıyken Odak durumunu PC'ye iletemez. Özellikle kapanış isteği ulaşmazsa PC eski açık durumunda kalabilir. Ağ döndüğünde Odak'ı açıp kapatarak durumu eşitleyin; bu paket sürekli durum eşitlemesi yapmaz.
- Mesaj gönderimi başladıktan sonra Odak kapanması gönderilmekte olan mesajı geri çekmez.
- `config.json` içindeki listeyi veya metni değiştirdikten sonra programı yeniden başlatın. KURULUM.cmd yeniden çalıştırılırsa mesaj varsayılan metne döner.
- PC'nin uyku modunu kapatın. Bu paket Windows açılışında otomatik başlatma kurmaz.
- Bu yazılım WhatsApp'ın resmî otomasyon API'si değildir. WhatsApp değişiklikleri bağlantıyı bozabilir; hesap kısıtlaması riski sıfır değildir. Oturum dosyaları hesabınıza erişim sağlayabilir; `.wwebjs_auth`, `config.json` ve `IPHONE-AYARLARI.txt` dosyalarını paylaşmayın.
- Bu ortamda WhatsApp hesabınızla gerçek bağlantı testi yapılmadı. Dahil edilen testler alıcı filtresini, grupların dışlanmasını, eski mesaj filtresini ve tekrar yanıt engelini doğrular.

Durdurmak için program penceresinde Ctrl+C. Kalıcı bağlantıyı kaldırmak için WhatsApp → Bağlı Cihazlar'dan ilgili oturumu kapatın.

## Kaynaklar

- https://wwebjs.dev/guide/creating-your-bot/
- https://wwebjs.dev/guide/creating-your-bot/authentication.html
- https://docs.wwebjs.dev/Contact.html
- https://tailscale.com/download
