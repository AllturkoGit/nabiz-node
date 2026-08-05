'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

/*
| auto.js yüklenirken ortamdan yapılandırma okur; testten önce kurulmalı.
*/
process.env.NABIZ_URL = 'https://hub.ornek';
process.env.NABIZ_KEY = 'ornek-proje';
process.env.NABIZ_SECRET = 'a'.repeat(64);
process.env.NABIZ_SLOW_REQUEST_MS = '0';

const { yolDeseni } = require('../src/auto');

let gonderilenler = [];
let asilFetch;

beforeEach(() => {
    gonderilenler = [];
    asilFetch = global.fetch;

    global.fetch = async (url, ayar) => {
        gonderilenler.push(JSON.parse(ayar.body));

        return { status: 204, ok: true };
    };
});

afterEach(() => {
    global.fetch = asilFetch;
});

/**
 * Kimlik taşıyan yol parçaları desene çevrilmezse her ürün sayfası ayrı bir
 * parmak izi üretir ve gruplama tamamen anlamsızlaşır.
 */
test('yol deseni kimlikleri normalize eder', () => {
    assert.strictEqual(yolDeseni('/urunler/1042'), '/urunler/{id}');
    assert.strictEqual(
        yolDeseni('/siparis/f47ac10b-58cc-4372-a567-0e02b2c3d479/detay'),
        '/siparis/{uuid}/detay',
    );
    assert.strictEqual(yolDeseni('/dosya/a1b2c3d4e5f60718'), '/dosya/{hash}');
    assert.strictEqual(yolDeseni('/urunler'), '/urunler');
});

test('yol deseni query string taşımaz', () => {
    assert.strictEqual(yolDeseni('/ara?q=gizli&token=abc'), '/ara');
});

/**
 * Kodsuz kurulumun asıl iddiası bu: uygulama kaynağına dokunulmadan istekler
 * ölçülüyor.
 */
test('yamalanan sunucu isteği kod eklenmeden ölçer', async () => {
    const sunucu = http.createServer((req, res) => {
        res.statusCode = 500;
        res.end('hata');
    });

    await new Promise((c) => sunucu.listen(0, c));

    const port = sunucu.address().port;
    await fetchGercek(`http://127.0.0.1:${port}/urunler/42`);

    // finish olayı ve gönderim aynı tick'te bitmiyor.
    await new Promise((c) => setTimeout(c, 50));

    sunucu.close();

    const olay = gonderilenler.find((g) => g.kind === 'http_5xx');

    assert.ok(olay, '5xx olayı gönderilmeliydi');
    assert.strictEqual(olay.status, 500);
    assert.strictEqual(olay.route, 'GET /urunler/{id}');
});

/** Yama isteği ne değiştirmeli ne de bozmalı. */
test('yama isteğin yanıtını değiştirmez', async () => {
    const sunucu = http.createServer((req, res) => {
        res.setHeader('content-type', 'text/plain');
        res.end('merhaba');
    });

    await new Promise((c) => sunucu.listen(0, c));

    const port = sunucu.address().port;
    const yanit = await fetchGercek(`http://127.0.0.1:${port}/`);

    sunucu.close();

    assert.strictEqual(yanit.govde, 'merhaba');
    assert.strictEqual(yanit.durum, 200);
});

/** global.fetch sahte; gerçek istek için ham http kullanılıyor. */
function fetchGercek(url) {
    return new Promise((cozumle, reddet) => {
        http.get(url, (res) => {
            let govde = '';
            res.on('data', (p) => (govde += p));
            res.on('end', () => cozumle({ durum: res.statusCode, govde }));
        }).on('error', reddet);
    });
}
