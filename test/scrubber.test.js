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
