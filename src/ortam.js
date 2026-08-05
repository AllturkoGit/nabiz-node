'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

/**
 * Yapılandırmayı süreç ortamından ve `.env` dosyalarından okur.
 *
 * `.env` okuması gereksiz görünebilir — çoğu framework zaten okuyor. Ama iki
 * durumda okumuyor ve ikisi de sessiz arıza üretiyordu:
 *
 * 1. **`--require` ile ön yükleme.** `auto.js`, Node başlarken çalışır;
 *    Next/Nuxt kendi `.env`'ini çok daha sonra okur. Bu noktada `process.env`
 *    boştur, paket "yapılandırma eksik" deyip hiçbir kanca kurmaz ve hiçbir
 *    şey söylemez.
 * 2. **`npx nabiz-durum`.** Ayrı bir süreç; uygulamanın `.env`'i hiç
 *    yüklenmez. Gerçek bir kurulumda `.env` doğru doldurulmuşken komut
 *    "TANIMSIZ" dedi — teşhis aracının yanlış teşhis koyması, hiç teşhis
 *    koymamaktan kötüdür.
 *
 * Öncelik: `process.env` > `.env.<NODE_ENV>` > `.env.local` > `.env`.
 * Süreç ortamı **her zaman kazanır**; dosya yalnızca boşluğu doldurur.
 *
 * Yalnızca `NABIZ_` ile başlayan anahtarlar okunur — paketin başka hiçbir
 * değişkeni görmesine gerek yok.
 */

const ONEK = 'NABIZ_';

let onbellek = null;

/** @returns {Record<string, string>} */
function ortam() {
    if (onbellek) return onbellek;

    const deger = {};

    // Sondan başa: önce en zayıf kaynak yazılır, güçlü olan üzerine yazar.
    for (const dosya of dosyalar().reverse()) {
        Object.assign(deger, oku(dosya));
    }

    for (const [anahtar, v] of Object.entries(process.env)) {
        if (anahtar.startsWith(ONEK) && v !== undefined && v !== '') {
            deger[anahtar] = v;
        }
    }

    onbellek = deger;

    return deger;
}

/** @returns {string[]} güçlüden zayıfa */
function dosyalar() {
    const ortamAdi = process.env.NODE_ENV;

    return [
        ortamAdi ? `.env.${ortamAdi}` : null,
        '.env.local',
        '.env',
    ].filter(Boolean);
}

/**
 * Küçük bir `.env` ayrıştırıcı — bağımlılık politikası gereği `dotenv`
 * eklenmiyor. Desteklenenler: `ANAHTAR=deger`, tırnaklı değer, `#` yorum,
 * `export ` öneki. `.env` sözdiziminin tamamı değil ama bu paketin okuduğu
 * beş değişken için fazlasıyla yeterli.
 *
 * @returns {Record<string, string>}
 */
function oku(dosya) {
    const deger = {};

    let icerik;
    try {
        icerik = readFileSync(join(process.cwd(), dosya), 'utf8');
    } catch {
        // Dosya yoksa ya da okunamıyorsa sessizce geç.
        return deger;
    }

    for (const ham of icerik.split('\n')) {
        const satir = ham.trim().replace(/^export\s+/, '');

        if (!satir || satir.startsWith('#')) continue;

        const ayirac = satir.indexOf('=');
        if (ayirac < 1) continue;

        const anahtar = satir.slice(0, ayirac).trim();
        if (!anahtar.startsWith(ONEK)) continue;

        let v = satir.slice(ayirac + 1).trim();

        // Tırnak içindeyse tırnaklar atılır; değilse satır sonu yorumu kesilir.
        if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
        ) {
            v = v.slice(1, -1);
        } else {
            v = v.split(' #')[0].trim();
        }

        if (v !== '') deger[anahtar] = v;
    }

    return deger;
}

/** Test için: önbelleği düşürür. */
function unut() {
    onbellek = null;
}

module.exports = { ortam, unut };
