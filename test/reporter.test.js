'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { createHmac } = require('node:crypto');

const { Reporter } = require('../src/reporter');

const OPTIONS = {
    url: 'https://hub.ornek',
    key: 'ornek-proje',
    secret: 'a'.repeat(64),
    env: 'production',
};

let sent = [];
let originalFetch;

beforeEach(() => {
    sent = [];
    originalFetch = global.fetch;

    global.fetch = async (url, options) => {
        sent.push({ url, options, body: JSON.parse(options.body) });

        return { status: 204, ok: true };
    };
});

afterEach(() => {
    global.fetch = originalFetch;
});

test('yapılandırma eksikse hiçbir şey gönderilmez', async () => {
    await new Reporter({ url: null, key: null, secret: null }).recordException(
        new Error('x'),
    );

    assert.strictEqual(sent.length, 0);
});

test('enabled false iken gönderim yapılmaz', async () => {
    await new Reporter({ ...OPTIONS, enabled: false }).recordException(new Error('x'));

    assert.strictEqual(sent.length, 0);
});

test('hata raporlanır ve imzalanır', async () => {
    await new Reporter(OPTIONS).recordException(new Error('Bir şey patladı'));

    assert.strictEqual(sent.length, 1);

    const { url, options, body } = sent[0];

    assert.strictEqual(url, 'https://hub.ornek/api/i/ornek-proje/server');
    assert.strictEqual(body.kind, 'exception');
    assert.strictEqual(body.msg, 'Bir şey patladı');
    assert.strictEqual(body.exception_class, 'Error');
    assert.strictEqual(body.runtime, 'node');
    assert.ok(body.sdk_version);

    // İmza gövdenin tamamını ve zaman damgasını kapsamalı.
    const timestamp = options.headers['X-Nabiz-Timestamp'];
    const expected = createHmac('sha256', OPTIONS.secret)
        .update(`${timestamp}.${options.body}`)
        .digest('hex');

    assert.strictEqual(options.headers['X-Nabiz-Signature'], `sha256=${expected}`);
});

test('aynı hata iki kez raporlanmaz', async () => {
    const r = new Reporter(OPTIONS);
    const error = new Error('tekrar');

    await r.recordException(error);
    await r.recordException(error);

    assert.strictEqual(sent.length, 1);
});

test('yok sayılan hata adları raporlanmaz', async () => {
    const error = new Error('bulunamadı');
    error.name = 'NotFoundError';

    await new Reporter({ ...OPTIONS, ignore: ['NotFoundError'] }).recordException(error);

    assert.strictEqual(sent.length, 0);
});

test('raporlanan olayda kişisel veri bulunmaz', async () => {
    await new Reporter(OPTIONS).recordException(
        new Error('Kullanıcı ahmet@ornek.com için 12345678901 geçersiz'),
    );

    const msg = sent[0].body.msg;

    assert.ok(!msg.includes('ahmet@ornek.com'));
    assert.ok(!msg.includes('12345678901'));
});

test('eşik altındaki hızlı istek raporlanmaz', async () => {
    await new Reporter(OPTIONS).recordRequest({
        route: '/urunler',
        method: 'GET',
        status: 200,
        durationMs: 40,
    });

    assert.strictEqual(sent.length, 0);
});

test('yavaş istek raporlanır', async () => {
    await new Reporter(OPTIONS).recordRequest({
        route: '/urunler',
        method: 'GET',
        status: 200,
        durationMs: 2500,
    });

    assert.strictEqual(sent[0].body.kind, 'slow_request');
    assert.strictEqual(sent[0].body.duration_ms, 2500);
});

/** Hızlı da olsa 5xx her zaman raporlanır. */
test('5xx hızlı olsa da raporlanır', async () => {
    await new Reporter(OPTIONS).recordRequest({
        route: '/api/siparis',
        method: 'POST',
        status: 500,
        durationMs: 12,
    });

    assert.strictEqual(sent[0].body.kind, 'http_5xx');
    assert.strictEqual(sent[0].body.status, 500);
});

/**
 * Davranış garantisi: hub erişilemezse izlenen uygulamada hata oluşmaz.
 */
test('hub erişilemezse hata fırlatılmaz', async () => {
    global.fetch = async () => {
        throw new Error('ECONNREFUSED');
    };

    await new Reporter(OPTIONS).recordException(new Error('x'));
    // Buraya ulaşmak testin kendisidir.
    assert.ok(true);
});
