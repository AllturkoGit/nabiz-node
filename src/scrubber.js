'use strict';

/**
 * Kişisel veri temizliği — gönderimden ÖNCE uygulanır.
 *
 * Hub tarafında aynı temizlik tekrar yapılır. İkisi de gereklidir: hub kendini
 * savunur, paket ise kişisel veriyi ağa hiç çıkarmaz. Bir sızıntı olacaksa ilk
 * savunma hattı burasıdır.
 *
 * Desenler `allturko/nabiz` (PHP) paketiyle birebir aynı tutulur; ikisi ayrışırsa
 * aynı hata iki farklı SDK'da farklı maskelenir ve parmak izi bölünür.
 */

const DESENLER = [
    /*
    | PHP paketindeki desenin birebir karşılığı. Gevşek bir sürüm
    | (`[^\s@]+`) eğik çizgiyi de yutuyor ve `/kullanici/a@b.com/profil`
    | yolunun tamamını maskeliyordu — testin yakaladığı gerçek bir farktı.
    */
    [/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu, '[eposta]'],
    [/\bTR(?:[\s-]?\d){24}\b/gi, '[iban]'],
    [/\b\d(?:[\s-]?\d){12,18}\b/g, '[kart]'],
    [/\b[1-9]\d{10}\b/g, '[tckn]'],
    [/(?:\+90|0)?[\s-]?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g, '[telefon]'],
    /*
    | Uzun rastgele diziler: oturum kimliği, API anahtarı, jeton, hash.
    | Gerçek bir sızıntıda yakalandı — veritabanı hatasının mesajı SQL'i
    | bağlanmış değerlerle taşıyordu ve içinde oturum kimliği vardı.
    |
    | 24 hane eşiği bilinçli: oturum kimlikleri 40, API anahtarları 32+;
    | normal kelimeler ve sınıf adları bu uzunluğa ulaşmaz.
    */
    [/[A-Za-z0-9][A-Za-z0-9_-]{23,}/g, '[jeton]'],
];

function text(value, limit) {
    if (value === null || value === undefined || value === '') return null;

    let s = String(value);
    for (const [desen, yerine] of DESENLER) s = s.replace(desen, yerine);

    return s.slice(0, limit);
}

/** Query string ve fragment atılır; yalnızca yol kalır (M3). */
function path(value) {
    if (!value) return null;

    let yol = String(value);

    try {
        // Taban adres yalnızca göreli yolları çözmek için; dışarı çıkmıyor.
        yol = new URL(yol, 'http://yerel').pathname;
    } catch {
        yol = yol.split('?')[0].split('#')[0];
    }

    return text(yol, 300);
}

/**
 * SQL normalize: literal değerler `?` ile değiştirilir.
 * `where email = 'ahmet@ornek.com'` → `where email = ?`
 *
 * Hem KVKK gereği hem gruplama açısından doğru: aynı sorgu farklı
 * parametrelerle çalıştığında tek parmak izinde toplanır.
 */
function sql(value) {
    if (!value) return null;

    let s = String(value)
        .replace(/'(?:[^']|'')*'/g, '?')
        .replace(/"(?:[^"]|"")*"/g, '?')
        .replace(/\b\d+(?:\.\d+)?\b/g, '?')
        .replace(/\b(IN)\s*\(\s*\?(?:\s*,\s*\?)+\s*\)/gi, '$1 (?)');

    return text(s.replace(/\s+/g, ' ').trim(), 500);
}

/**
 * Hata mesajı.
 *
 * Veritabanı sürücülerinin hataları SQL'i bağlanmış değerlerle taşır; önce
 * SQL normalize edilir, sonra genel maskeleme uygulanır. Yalnızca sorgu
 * alanını temizlemek yetmiyordu — asıl sızıntı mesajın kendisinden oluyordu.
 */
function message(value, sqlIceriyor = false) {
    if (!value) return null;

    let s = String(value);

    if (sqlIceriyor) {
        s = s
            .replace(/'(?:[^']|'')*'/g, '?')
            .replace(/"(?:[^"]|"")*"(\s*=\s*)\S+/g, '"?"$1?');
    }

    return text(s, 500);
}

/**
 * Stack trace kısaltılır ve maskelenir. node_modules satırları atılmaz —
 * hatanın nerede olduğunu bulmak için zincirin tamamı gerekir — ama uzunluk
 * sınırlanır.
 */
function stack(value) {
    return text(value, 2000);
}

module.exports = { text, path, sql, message, stack };
