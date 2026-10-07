# Avni Tokur Eğitim – Okul Yönetim Sistemi (Gerçek Veritabanı)

Bu sürüm artık tarayıcı hafızasını (localStorage) değil, **sunucu tarafında gerçek bir veritabanını** kullanır. Tüm veriler `data/db.json` dosyasında saklanır ve her kullanıcı kendi hesabıyla giriş yapar.

## Kurulum (çok basit)

Hiçbir ek paket (npm) gerekmez. Sadece **Node.js** kurulu olmalıdır.

```
node server.js
```

Ardından tarayıcıdan açın: **http://localhost:3000**

Sunucu artık **tüm ağ arayüzlerinden (0.0.0.0)** dinler; yani sadece dershanedeki ağdan değil, sunucuya ulaşabilen her yerden bağlanılabilir. Herkes (yönetici, öğretmen ve veliler dahil) aynı adrese kendi kullanıcı adı/şifresiyle giriş yapar. **İnternetten (başka ağlardan) erişim için aşağıdaki “İnternetten Erişim” bölümüne bakın.**

## İlk çalıştırmada ne olur?

Sunucu ilk açıldığında `data/db.json` yoksa, mevcut okul verileriyle (öğrenciler, sınıflar, dersler, ödev kayıtları, ders programları, ödemeler) otomatik oluşturulur. Bir daha silmedikçe tüm değişiklikleriniz kalıcı olur.

## Varsayılan Giriş Bilgileri

| Rol | Kullanıcı adı | Şifre |
|-----|-------------|-------|
| **Yönetici** | `yonetici` | `admin123` |
| Öğretmen (Görkem) | `gorkem` | `gorkem123` |
| Öğretmen (Elif) | `elif` | `elif123` |
| Öğretmen (Ebruşah) | `ebrusah` | `ebrusah123` |
| Öğretmen (Ebru) | `ebru` | `ebru123` |
| Öğretmen (Zehra) | `zehra` | `zehra123` |
| Öğretmen (Pervin) | `pervin` | `pervin123` |
| Veli | öğrenci adı + `veli` (örn. `asilveli`) | öğrenci adı + `123` (örn. `asil123`) |

> Güvenlik için ilk girişten sonra şifreleri değiştirmeniz önerilir (sol altta “Şifre Değiştir”). Yönetici tüm öğretmen ve veli şifrelerini panelden belirleyebilir.

## Roller ve Yetkiler

**Yönetici**
- Öğretmen, öğrenci ve veli hesapları ekler.
- Öğretmen ve veli şifrelerini belirler/değiştirir.
- Sınıf ve ders ekler.
- Öğretmenlere ders ve sınıf atar.
- Ödev, sınav, program ve ödeme kayıtlarını görür.
- **Not:** Yönetici panelinde **Matematik dersi listelenmez** (istenen kurala göre).

**Öğretmen**
- Yalnızca kendisine atanan ders ve sınıfları görür.
- Ödev verir (başlık, açıklama, teslim tarihi).
- Ödev sonuçları girer (doğru / yanlış / boş).
- Sınav notu girer.
- Kendi ders programını görür.

**Veli**
- Çocuğunun ders programını görür.
- Çocuğunun ödev sonuçlarını, sınav notlarını ve kendisine verilen ödevleri görür.

## Ders – Öğretmen Atamaları (başlangıç)

- Görkem → Matematik, Fizik
- Elif → İngilizce
- Ebruşah → Sosyal, Coğrafya
- Ebru, Zehra → Türkçe, Edebiyat
- Pervin → Fen

## Veri Güvenliği

- Şifreler düz metin olarak değil, **scrypt** ile şifrelenerek saklanır.
- Oturumlar imzalı (HMAC-SHA256) jeton (token) ile yönetilir; token ömrü **1 gündür**.
- **İlk girişte şifre değiştirme zorunlu:** Varsayılan veya yönetici tarafından belirlenen şifreyle giren herkes (yönetici dahil) devam etmeden önce kendi şifresini belirlemek zorundadır.
- **Güçlü şifre kuralı:** en az 8 karakter, en az bir harf ve bir rakam.
- **Kaba kuvvet koruması:** 5 hatalı giriş denemesinden sonra ilgili kullanıcı/IP 10 dakika kilitlenir.
- **Oturum iptali:** Yönetici bir şifreyi sıfırladığında veya hesap dondurulduğunda o kullanıcının açık oturumları anında geçersiz olur. Çıkış (logout) yapıldığında token sunucuda geçersiz kılınır.
- **Hesap dondurma:** Yönetici bir öğretmen/veli hesabını silmeden “dondurabilir”; pasif hesaplar giriş yapamaz.
- **Güvenlik başlıkları:** Tüm yanıtlarda `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` ve `Content-Security-Policy` gönderilir.
- **İşlem kayıtları (audit):** Giriş, şifre değişimi, hesap/kayıt ekleme-silme gibi işlemler kaydedilir; yönetici panelindeki “İşlem Kayıtları” ekranından görülür.
- **Otomatik yedek:** Sunucu her açılışta `data/backups/` altına günlük bir yedek alır (son 7 gün saklanır).
- `data/db.json` dosyası yalnızca sahibinin okuyabileceği izinle (600) yazılır. Yedek almak için bu dosyayı kopyalamanız yeterlidir.

> **Not:** Bu korumaların internette tam etkili olması için mutlaka **HTTPS** kullanın (yukarıdaki “İnternetten Erişim” bölümü). HTTPS olmadan şifreler ağ üzerinde açık gidebilir.

## Dosya Yapısı

```
server.js            → Sunucu (Node.js built-in http + crypto + fs)
public/index.html    → Arayüz
public/style.css     → Koyu tema stiller
public/app.js        → İstemci mantığı (giriş, roller, paneller)
data/db.json         → Veritabanı (ilk çalıştırmada oluşur)
seed_source.json     → Başlangıç verisi kaynağı
```

---

## İnternetten Erişim (başka ağlardan / evden giriş)

Herkesin — yönetici, öğretmenler ve veliler dahil — evinden ya da başka bir ağdan giriş yapabilmesi için sunucunun **internetten ulaşılabilir** olması gerekir. Kodda ek bir değişiklik gerekmez (sunucu `0.0.0.0` dinler); sadece aşağıdaki yöntemlerden birini kullanın. Giriş sayfası, adres kullanıcı adı + şifre istediği için herkes aynı adresten giriş yapabilir.

### Seçenek 1 — Bulut sunucu / VPS (en önerilen, 7/24 açık)
Küçük bir Linux sunucu kiralayın (Hetzner, DigitalOcean, Contabo, AWS Lightsail vb. — aylık birkaç dolar yeter).
1. Node.js kurun: `sudo apt update && sudo apt install -y nodejs`
2. Bu klasörü sunucuya kopyalayın ve başlatın: `node server.js`
3. Sürekli açık kalması ve yeniden başlaması için `pm2` kullanın:
   ```
   sudo npm i -g pm2
   pm2 start server.js --name okul
   pm2 save && pm2 startup
   ```
4. Sunucunun genel IP adresiyle erişilir: `http://<SUNUCU-IP>:3000`
5. Bir alan adınız (örn. `okul.ornek.com`) varsa, DNS’i bu IP’ye yönlendirin.

### Seçenek 2 — Ücretsiz uygulama platformu
Render, Railway, Fly.io gibi platformlara yükleyip ücretsiz/düşük maliyetle yayınlayabilirsiniz. Başlatma komutu `node server.js`, port olarak platformun verdiği `PORT` otomatik kullanılır. Bu platformlar size hazır bir `https://...` adresi verir.
> Önemli: Bu platformların bir kısmında disk kalıcı değildir; verilerin (`data/db.json`) kaybolmaması için kalıcı disk (persistent volume) seçeneğini açın veya düzenli yedek alın.

### Seçenek 3 — Kendi bilgisayarınız + modem port yönlendirme
Sunucuyu dershanedeki bir bilgisayarda çalıştırıp modeminizden dışarı açabilirsiniz:
1. Bilgisayarın yerel IP’sini sabitleyin (örn. 192.168.1.50).
2. Modem arayüzünden **Port Yönlendirme (Port Forwarding)**: dış port 3000 → 192.168.1.50:3000.
3. İnternet servis sağlayıcınızın size verdiği genel IP ile erişilir. IP değişiyorsa ücretsiz bir **DDNS** (No-IP, DuckDNS) servisi kullanın.
> Bu yöntem bilgisayar açık olduğu sürece çalışır ve güvenlik açısından Seçenek 1 kadar sağlam değildir.

### ÖNEMLİ: HTTPS kullanın (şifre güvenliği)
İnternete açarken düz `http://` yerine **`https://`** kullanın; aksi halde kullanıcı adı/şifreler açık metin olarak gider. İki kolay yol:

**a) Caddy ile otomatik HTTPS (en kolay, ücretsiz sertifika):** Caddy kurun ve tek satırlık `Caddyfile` oluşturun:
```
okul.ornek.com {
    reverse_proxy 127.0.0.1:3000
}
```
Caddy, Let’s Encrypt sertifikasını otomatik alır ve yeniler. (Bu durumda `server.js`’i düz http olarak 3000’de bırakın.)

**b) Doğrudan sunucuda HTTPS:** Sertifika ve anahtar dosyalarınız varsa:
```
SSL_KEY=/yol/privkey.pem SSL_CERT=/yol/fullchain.pem PORT=443 node server.js
```
Sunucu bu değişkenler verildiğinde otomatik olarak HTTPS modunda başlar.

### Port değiştirme
```
PORT=8080 node server.js
```

### Sadece yerel test (internete açmadan)
```
HOST=127.0.0.1 node server.js
```
