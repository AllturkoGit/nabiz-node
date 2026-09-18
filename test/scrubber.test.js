'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const Scrubber = require('../src/scrubber');

test('kişisel veri desenleri maskelenir', () => {
    const durumlar = [
        ['Kullanıcı ahmet@ornek.com bulunamadı', 'Kullanıcı [eposta] bulunamadı'],
        ['TCKN 12345678901 geçersiz', 'TCKN [tckn] geçersiz'],
        ['TR330006100519786457841326 reddedildi', '[iban] reddedildi'],
        ['4111 1111 1111 1111 hatalı', '[kart] hatalı'],
        ['Ara: 0555 123 45 67', 'Ara: [telefon]'],
    ];

    for (const [girdi, beklenen] of durumlar) {
        assert.strictEqual(Scrubber.text(girdi, 500), beklenen);
    }
});

test('query string atılır, yol kalır', () => {
    assert.strictEqual(Scrubber.path('/urunler?email=x@y.com&token=abc'), '/urunler');
    assert.strictEqual(Scrubber.path('https://ornek.com/urunler?q=1'), '/urunler');
    assert.strictEqual(Scrubber.path('/ara#sonuc'), '/ara');
});

test('yolun içindeki kişisel veri de maskelenir', () => {
    assert.strictEqual(
        Scrubber.path('/kullanici/ahmet@ornek.com/profil'),
        '/kullanici/[eposta]/profil',
    );
});

test('SQL literal değerleri normalize edilir', () => {
    assert.strictEqual(
        Scrubber.sql("select * from users where email = 'ahmet@ornek.com'"),
        'select * from users where email = ?',
    );
    assert.strictEqual(
        Scrubber.sql('select * from t where id in (1, 2, 3)'),
        'select * from t where id in (?)',
    );
});

/**
 * Gerçek bir sızıntıda yakalandı: veritabanı hatasının mesajı SQL'i bağlanmış
 * değerlerle taşıyor ve içinde oturum kimliği vardı.
 */
test('SQL taşıyan hata mesajından oturum kimliği sızmaz', () => {
    const mesaj =
        'Database error (SQL: select * from "sessions" where "id" = ItLsnnji2VLJtiE1SjiyAEdzv6aZiuVqhFvcmRu1 limit 1)';

    const sonuc = Scrubber.message(mesaj, true);

    assert.ok(!sonuc.includes('ItLsnnji2VLJtiE1SjiyAEdzv6aZiuVqhFvcmRu1'));
});

test('uzun rastgele diziler maskelenir', () => {
    // Fixture bilinçli olarak hiçbir sağlayıcının anahtar biçimine benzemiyor:
    // gerçekçi bir önek gizli anahtar taramalarına takılıp push'u engelliyor.
    assert.ok(
        Scrubber.text('Token: ornek_jeton_ABCDEFGHIJKLMNOPQRSTUVWXYZ', 500).includes(
            '[jeton]',
        ),
    );
});

test('normal kelimeler ve sınıf adları maskelenmez', () => {
    const mesaj = 'TypeError on ProductController.show';

    assert.strictEqual(Scrubber.text(mesaj, 500), mesaj);
});

test('boş değerler null döner', () => {
    assert.strictEqual(Scrubber.text(null, 500), null);
    assert.strictEqual(Scrubber.path(''), null);
    assert.strictEqual(Scrubber.sql(null), null);
});

test('stack trace 2000 karakterde kesilir', () => {
    const iz = '    at Foo.bar (/app/src/foo.js:42:13)\n'.repeat(200);

    assert.strictEqual(Scrubber.stack(iz).length, 2000);
});

/*
| Yükleme dosya adları (`<ad>-<zaman damgası>-<rastgele>.<uzantı>`) okunur
| kalmalı. Zaman damgası kart, uzun ad jeton sanılıyordu ve panelde
| `/uploads/discount/[jeton][kart]-752066249.jpeg` çıkıyordu.
| Beklenenler hub Scrubber'ıyla ortak vektörlerden (bkz. CHANGELOG 0.5.0).
*/
test('yükleme dosya adı okunur kalır', () => {
    for (const yol of [
        '/uploads/discount/kampanya-gorseli-yaz-indirimi-1726571234567-752066249.jpeg',
        '/uploads/sliders/slider-slider-1726571234567-249230604-1726571239999-875783343.png',
        // Son on hanesi 5 ile başlayan damga telefon sanılıyordu.
        '/uploads/products/urun-1795123456789-123456789.png',
    ]) {
        assert.strictEqual(Scrubber.path(yol), yol);
    }
});

test('kart yalnızca gerçek kart numarasıysa maskelenir', () => {
    assert.strictEqual(Scrubber.text('kart 4111111111111111 red', 500), 'kart [kart] red');
    assert.strictEqual(Scrubber.text('378282246310005 red', 500), '[kart] red');
    assert.strictEqual(Scrubber.text('saat 1726571234567 geçti', 500), 'saat 1726571234567 geçti');
    assert.strictEqual(Scrubber.text('no 4111111111111112', 500), 'no 4111111111111112');
    // Luhn'u tutan damga: yalnızca ilk hane kuralı ayırıyor.
    assert.strictEqual(Scrubber.text('saat 1726571234573 geçti', 500), 'saat 1726571234573 geçti');
});

/* Sol sınır eklenince + olmadan 90 ön eki sızıyordu (önceden `9[telefon]`). */
test('90 ön ekli telefon maskelenir', () => {
    assert.strictEqual(Scrubber.text('tel 905321234567', 500), 'tel [telefon]');
    assert.strictEqual(Scrubber.text('tel 90 532 123 45 67', 500), 'tel [telefon]');
});

test('rastgele diziler yeni kuralla da maskelenir', () => {
    for (const girdi of [
        'x 3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b y',
        'x ghp_16C7e42F292c6912E7710c838347Ae178B4a y',
        'x a1b2c3d4-e5f6a7b8-c9d0e1f2-a3b4c5d6 y',
    ]) {
        assert.strictEqual(Scrubber.text(girdi, 500), 'x [jeton] y');
    }
});
