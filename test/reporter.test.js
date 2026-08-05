'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { createHmac } = require('node:crypto');

const { Reporter } = require('../src/reporter');

const AYAR = {
    url: 'https://hub.ornek',
    key: 'ornek-proje',
    secret: 'a'.repeat(64),
    env: 'production',
};

let gonderilenler = [];
let asilFetch;

beforeEach(() => {
    gonderilenler = [];
    asilFetch = global.fetch;

    global.fetch = async (url, ayar) => {
        gonderilenler.push({ url, ayar, govde: JSON.parse(ayar.body) });

        return { status: 204, ok: true };
    };
});

afterEach(() => {
    global.fetch = asilFetch;
});

test('yapılandırma eksikse hiçbir şey gönderilmez', async () => {
    await new Reporter({ url: null, key: null, secret: null }).recordException(
        new Error('x'),
    );

    assert.strictEqual(gonderilenler.length, 0);
});

test('enabled false iken gönderim yapılmaz', async () => {
    await new Reporter({ ...AYAR, enabled: false }).recordException(new Error('x'));

    assert.strictEqual(gonderilenler.length, 0);
});

test('hata raporlanır ve imzalanır', async () => {
    await new Reporter(AYAR).recordException(new Error('Bir şey patladı'));

    assert.strictEqual(gonderilenler.length, 1);

    const { url, ayar, govde } = gonderilenler[0];

    assert.strictEqual(url, 'https://hub.ornek/api/i/ornek-proje/server');
    assert.strictEqual(govde.kind, 'exception');
    assert.strictEqual(govde.msg, 'Bir şey patladı');
    assert.strictEqual(govde.exception_class, 'Error');
    assert.strictEqual(govde.runtime, 'node');
    assert.ok(govde.sdk_version);

    // İmza gövdenin tamamını ve zaman damgasını kapsamalı.
    const damga = ayar.headers['X-Nabiz-Timestamp'];
    const beklenen = createHmac('sha256', AYAR.secret)
        .update(`${damga}.${ayar.body}`)
        .digest('hex');

    assert.strictEqual(ayar.headers['X-Nabiz-Signature'], `sha256=${beklenen}`);
});

test('aynı hata iki kez raporlanmaz', async () => {
    const r = new Reporter(AYAR);
    const hata = new Error('tekrar');

    await r.recordException(hata);
    await r.recordException(hata);

    assert.strictEqual(gonderilenler.length, 1);
});

test('yok sayılan hata adları raporlanmaz', async () => {
    const hata = new Error('bulunamadı');
    hata.name = 'NotFoundError';

    await new Reporter({ ...AYAR, ignore: ['NotFoundError'] }).recordException(hata);

    assert.strictEqual(gonderilenler.length, 0);
});

test('raporlanan olayda kişisel veri bulunmaz', async () => {
    await new Reporter(AYAR).recordException(
        new Error('Kullanıcı ahmet@ornek.com için 12345678901 geçersiz'),
    );

    const msg = gonderilenler[0].govde.msg;

    assert.ok(!msg.includes('ahmet@ornek.com'));
    assert.ok(!msg.includes('12345678901'));
});

test('eşik altındaki hızlı istek raporlanmaz', async () => {
    await new Reporter(AYAR).recordRequest({
        route: '/urunler',
        method: 'GET',
        status: 200,
        durationMs: 40,
    });

    assert.strictEqual(gonderilenler.length, 0);
});

test('yavaş istek raporlanır', async () => {
    await new Reporter(AYAR).recordRequest({
        route: '/urunler',
        method: 'GET',
        status: 200,
        durationMs: 2500,
    });

    assert.strictEqual(gonderilenler[0].govde.kind, 'slow_request');
    assert.strictEqual(gonderilenler[0].govde.duration_ms, 2500);
});

/** Hızlı da olsa 5xx her zaman raporlanır. */
test('5xx hızlı olsa da raporlanır', async () => {
    await new Reporter(AYAR).recordRequest({
        route: '/api/siparis',
        method: 'POST',
        status: 500,
        durationMs: 12,
    });

    assert.strictEqual(gonderilenler[0].govde.kind, 'http_5xx');
    assert.strictEqual(gonderilenler[0].govde.status, 500);
});

/**
 * Davranış garantisi: hub erişilemezse izlenen uygulamada hata oluşmaz.
 */
test('hub erişilemezse hata fırlatılmaz', async () => {
    global.fetch = async () => {
        throw new Error('ECONNREFUSED');
    };

    await new Reporter(AYAR).recordException(new Error('x'));
    // Buraya ulaşmak testin kendisidir.
    assert.ok(true);
});
