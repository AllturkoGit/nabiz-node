'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const { ortam, unut } = require('../src/ortam');

let dizin;
let eskiCwd;
let eskiEnv;

beforeEach(() => {
    dizin = mkdtempSync(join(tmpdir(), 'nabiz-'));
    eskiCwd = process.cwd();
    eskiEnv = { ...process.env };
    process.chdir(dizin);
    unut();
});

afterEach(() => {
    process.chdir(eskiCwd);
    rmSync(dizin, { recursive: true, force: true });
    process.env = eskiEnv;
    unut();
});

function yaz(ad, icerik) {
    writeFileSync(join(dizin, ad), icerik);
}

/**
 * Gerçek bir kurulumda yaşandı: `.env` doğru doldurulmuşken `npx nabiz-durum`
 * "TANIMSIZ" dedi. Teşhis aracının yanlış teşhis koyması, hiç teşhis
 * koymamaktan kötüdür.
 */
test('.env dosyasından okur', () => {
    delete process.env.NABIZ_URL;
    yaz('.env', 'NABIZ_URL=https://hub.ornek\nNABIZ_KEY=ornek\n');

    const e = ortam();

    assert.strictEqual(e.NABIZ_URL, 'https://hub.ornek');
    assert.strictEqual(e.NABIZ_KEY, 'ornek');
});

test('süreç ortamı dosyayı ezer', () => {
    process.env.NABIZ_URL = 'https://surecten';
    yaz('.env', 'NABIZ_URL=https://dosyadan\n');

    assert.strictEqual(ortam().NABIZ_URL, 'https://surecten');
});

test('.env.<NODE_ENV> .env dosyasını ezer', () => {
    delete process.env.NABIZ_URL;
    process.env.NODE_ENV = 'production';

    yaz('.env', 'NABIZ_URL=https://genel\n');
    yaz('.env.production', 'NABIZ_URL=https://uretim\n');

    assert.strictEqual(ortam().NABIZ_URL, 'https://uretim');
});

test('yorum, tırnak ve export öneki ayrıştırılır', () => {
    delete process.env.NABIZ_URL;
    delete process.env.NABIZ_KEY;
    delete process.env.NABIZ_SECRET;

    yaz(
        '.env',
        [
            '# yorum satırı',
            'export NABIZ_URL=https://hub.ornek',
            'NABIZ_KEY="tirnakli-deger"',
            "NABIZ_SECRET='tek-tirnak'",
            '',
        ].join('\n'),
    );

    const e = ortam();

    assert.strictEqual(e.NABIZ_URL, 'https://hub.ornek');
    assert.strictEqual(e.NABIZ_KEY, 'tirnakli-deger');
    assert.strictEqual(e.NABIZ_SECRET, 'tek-tirnak');
});

/** Paketin başka hiçbir değişkeni görmesine gerek yok. */
test('NABIZ_ dışındaki anahtarlar okunmaz', () => {
    yaz('.env', 'DB_PASSWORD=gizli\nNABIZ_KEY=ornek\n');

    const e = ortam();

    assert.strictEqual(e.DB_PASSWORD, undefined);
    assert.strictEqual(e.NABIZ_KEY, 'ornek');
});

test('dosya yoksa hata vermez', () => {
    assert.doesNotThrow(() => ortam());
});
