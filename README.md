# @allturko/nabiz-node

[Nabız Hub](https://github.com/AllturkoGit/nabiz-hub) için Node.js raporlayıcı: sunucu
hataları, SSR hataları, yavaş istekler.

Bağımlılık yok. Build adımı yok. Node 18.17+.

---

## Kapsam — ve neden bu kadar dar

Bu paket **yalnızca sunucu tarafını** kapsar. Tarayıcı hataları hub'dan servis edilen
`t.js` ile toplanır ve o dosya bilinçli olarak npm'e taşınmadı:

| | Tarayıcı (`t.js`) | Node (bu paket) |
|---|---|---|
| Dağıtım | Hub'dan servis edilir | npm |
| Güncelleme | **5 dakikada tüm sitelere yayılır**, kimse deploy etmez | Her projede `npm update` |
| Neden | Merkezî güncelleme, paket ergonomisinden değerli | Sunucuda script etiketi çalışmaz — hosted seçenek yok |

Node tarafında paket **zorunlu**, ama kopyalanan bir dosya yerine paket olması da bilinçli:
kopya dosyalar güncellenmez ve bu **sessizce** olur. Bu projede tam olarak öyle bir hata
yaşandı — süre ölçümündeki bir kusur ve mesajdan oturum kimliği sızması, ancak paket
güncellenebildiği için tüm projelere ulaştı.

---

## Kurulum

```bash
npm install @allturko/nabiz-node
```

`.env` dosyasına — Laravel paketiyle aynı değişken isimleri:

```env
NABIZ_ENABLED=true
NABIZ_URL=https://monitor.ornek.com
NABIZ_KEY=proje-anahtari
NABIZ_SECRET=<panelden alınan 64 karakterlik secret>
NABIZ_ENV=production
```

### Kurulumu doğrulayın

```bash
npx nabiz-durum
```

Bu adım atlanmamalı. Paketin en pahalı arıza biçimi sessiz çalışmamadır: secret eksik
kopyalanmışsa hiçbir şey patlamaz, hiçbir log düşmez — hub geçersiz imzaya da `204` döner.
Kurulum aylarca çalışmıyor olabilir ve o sessizlik "sorun yok" sanılır.

```bash
npx nabiz-durum --test   # hub'a bir sınama olayı gönderir
```

Verinin gerçekten ulaştığı yalnızca **hub panelinden** doğrulanır: proje satırındaki
bağlantı durumu `Bağlı` görünmelidir. Komut bunu kendi başına söyleyemez, çünkü hub
geçerli ile geçersiz imzayı dışarıya aynı yanıtla karşılar.

---

## Kullanım

### Next.js (SSR)

SSR hataları tarayıcıya hiç ulaşmaz — `t.js` de error boundary de göremez. Bu kanca
olmadan SSR katmanı tamamen kör kalır.

```js
// instrumentation.js  (proje kökü)
export async function register() {
    const { hookProcess } = await import('@allturko/nabiz-node');
    hookProcess();
}

// Next 15+
export { nextOnRequestError as onRequestError } from '@allturko/nabiz-node';
```

Next 14'te `onRequestError` yoktur; orada yalnızca `register()` çalışır ve yakalanmamış
hatalar toplanır.

### Express

```js
const { express: nabiz } = require('@allturko/nabiz-node');

app.use(nabiz());          // rotalardan ÖNCE — süre ölçümü için
// ... rotalar ...
app.use(nabiz.errors());   // hata middleware'i EN SONA
```

`nabiz.errors()` hatayı **yutmaz**, `next(hata)` ile zincire devreder; uygulamanın kendi
hata sayfası çalışmaya devam eder.

### Elle bildirim

```js
const { report } = require('@allturko/nabiz-node');

try {
    await riskliIs();
} catch (hata) {
    report(hata);          // await gerekmez, arka planda tamamlanır
    throw hata;            // hata YUTULMAZ
}
```

---

## Ne toplar

- Yakalanmamış hatalar ve işlenmemiş promise reddi
- SSR render hataları (Next 15+)
- 5xx dönen istekler
- Eşiği aşan yavaş istekler (varsayılan 1000 ms)

## Ne toplamaz

Bunlar yapılandırmayla dahi açılamaz — kodda karşılığı yoktur:

- IP adresi
- User-Agent
- İstek gövdesi / form verisi
- Query string **değerleri** (yalnızca yol saklanır)
- Oturum verisi, çerez
- Ham SQL literal değerleri

Mesaj ve stack trace gönderilmeden önce e-posta, TC kimlik no, telefon, IBAN, kart numarası
ve uzun rastgele diziler (oturum kimliği, API anahtarı) maskelenir. SQL literal değerleri
`?` ile değiştirilir — hem KVKK gereği hem gruplama için: aynı sorgu farklı parametrelerle
çalıştığında tek parmak izinde toplanır.

---

## Davranış garantileri — ihlal edilemez

Paket, kurulduğu uygulamayı **hiçbir şekilde etkilememelidir**:

1. **Hata yutulmaz.** Handler zinciri korunur, `throw` engellenmez, süreç sonlandırılmaz.
2. **Kendi hatasını raporlamaz.** Sonsuz döngü riski; tüm SDK kodu `try/catch` ile sarılır.
3. **Kullanıcı isteğini bekletmez.** Gönderim kısa zaman aşımıyla (varsayılan 2 sn) ve
   yanıt döndükten sonra yapılır.
4. **Hub erişilemezse sessizce vazgeçilir.** İzlenen uygulamada hata, log kirliliği veya
   yavaşlama oluşmaz.
5. **`NABIZ_ENABLED=false` iken hiçbir veri gönderilmez.**

> Bir izleme paketinin izlediği uygulamayı bozması, çözdüğü sorundan büyük bir sorundur.

---

## Yapılandırma

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `NABIZ_ENABLED` | `true` | `false` ise hiçbir veri gönderilmez |
| `NABIZ_URL` | — | Hub adresi |
| `NABIZ_KEY` | — | Panelden alınan proje anahtarı |
| `NABIZ_SECRET` | — | 64 karakter. **Yalnızca sunucuda bulunur** |
| `NABIZ_ENV` | `NODE_ENV` | `production` · `staging` · `local` |
| `NABIZ_RELEASE` | — | Sürüm etiketi (commit sha, tag) |
| `NABIZ_TIMEOUT` | `2000` | Gönderim zaman aşımı (ms) |
| `NABIZ_SLOW_REQUEST_MS` | `1000` | Bu süreyi aşan istek yavaş sayılır |

Kod içinden de verilebilir:

```js
const { init } = require('@allturko/nabiz-node');

init({ url: '...', key: '...', secret: '...', ignore: ['NotFoundError'] });
```

---

## Toplu güncelleme

Aynı sunucudaki tüm Node projelerini tek seferde güncellemek için:

```bash
for d in /home/allturko/wwwroot/*/; do
  [ -d "$d/node_modules/@allturko/nabiz-node" ] || continue
  echo "→ $d"
  (cd "$d" && npm update @allturko/nabiz-node && npx nabiz-durum)
done
```

Son adım bilinçli: güncelleme sonrası yapılandırmanın hâlâ geçerli olduğunu doğrular.
Sessizce bozulan bir kurulum, hiç kurulmamış olandan daha tehlikelidir.

Hangi projenin hangi sürümde olduğu **panelden de görülür** — paket her olayla birlikte
`sdk_version` gönderiyor. Güncelleme körlemesine değil, hedefli yapılır.

---

## Geliştirme

```bash
npm test        # node:test, bağımlılık yok
```

Bağımlılık politikası: **mümkün olan en az bağımlılık.** Bu paket 8 projeye kurulacak; her
bağımlılık sürüm çakışması riski demektir. Tipler bu yüzden elle yazıldı, üretilmedi —
derleme zinciri eklenmedi.

## Lisans

MIT
