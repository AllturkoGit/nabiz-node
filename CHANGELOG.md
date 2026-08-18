# Değişiklik günlüğü

Semver. `0.x` sürümlerde **minor sıçraması kırıcı sayılır**; bu yüzden
`npm update` 0.3'ten 0.4'e geçmez ve "güncel" der. Yükseltirken:

```bash
npm install @allturko/nabiz-node@latest
```

---

## 0.4.0

**Hub gereksinimi:** Bu sürümün canlılık nabzını hub'ın tanıması için
`monitor_projects` tablosundaki canlılık kolonlarının göçü uygulanmış
olmalı. Uygulanmadan yükseltmek zarar vermez — nabız isteği kabul edilir,
yalnızca kaydedilmez.

### Eklendi

- **Canlılık nabzı.** Sekiz saatte bir olay taşımayan bir istek gönderilir
  (`{"events": []}`). Hub bir kurulumun çalıştığını yalnızca gelen hatalardan
  anlıyordu; hatasız çalışan uygulama "kurulum bozuk" görünüyordu. Kanıt artık
  isteğin kendisi.

  Aralık, hub'ın 24 saatlik sessizlik eşiğinin üçte biri: tek bir kaçırılan
  istek — deploy, yeniden başlatma — kurulumu bozuk göstermesin.

  `hookProcess()` ile kendiliğinden başlar. Elle yönetim için `startHeartbeat`
  ve `stopHeartbeat` dışa açıldı. Zamanlayıcı `unref` edilmiştir; kısa ömürlü
  betikleri ayakta tutmaz.

- **Worker thread ve `fork()` çökmeleri.** `hookProcess()` yalnızca ana
  thread'i kancalıyordu; worker içinde patlayan hata hiçbir iz bırakmıyordu.
  Yakalanmamış hatalar ve sıfır olmayan çıkış kodları raporlanıyor.

  `spawn`/`exec` bilinçli olarak kapsam dışı: dış komutlarda sıfır olmayan
  çıkış kodu rutindir ve hata saymak paneli anlamsız kayıtlarla doldururdu.

### Düzeltildi

- `npm test` Node 24'te hiç çalışmıyordu: `node --test test/` dizini modül
  sanıp hata veriyordu. 33 test görünmez durumdaydı.

---

## 0.3.0

- Gönderim sonucu döndürülüyor (`{sent, status, error}`); `nabiz-durum --test`
  artık gerçek sonucu okuyor, koşulsuz başarı yazmıyor.
- Tanımlayıcılar İngilizceye çevrildi.

## 0.2.1

- E-posta maskeleme deseni yollardaki eğik çizgileri yutuyordu.

## 0.2.0

- Express middleware, Next `onRequestError` kancası.

## 0.1.0

- İlk sürüm.
