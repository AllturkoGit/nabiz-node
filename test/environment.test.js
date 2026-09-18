'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const { normalizeEnv } = require('../src/environment');
const { Reporter } = require('../src/reporter');

/*
| Hub yalnızca production/staging/local kabul ediyor ve küme dışını —
| canlılık dahil — sessizce atıyor. NODE_ENV=development ile kurulan proje
| hiçbir şey göndermiyormuş gibi görünüyordu. Tablo Laravel ve Python
| paketleriyle aynı.
*/
test('yaygın ortam adları hub ın kabul ettiği karşılığa çevrilir', () => {
    const durumlar = [
        [undefined, 'production'], ['', 'production'], ['prod', 'production'], ['Live', 'production'],
        ['stage', 'staging'], ['UAT', 'staging'], ['preprod', 'staging'],
        ['development', 'local'], ['dev', 'local'], ['testing', 'local'], ['test', 'local'],
        ['production', 'production'], ['staging', 'staging'], ['local', 'local'],
    ];

    for (const [girdi, beklenen] of durumlar) {
        assert.strictEqual(normalizeEnv(girdi), beklenen, String(girdi));
    }
});

/* Bilinmeyeni production saymak test verisini canlıya karıştırırdı. */
test('tanınmayan ortam olduğu gibi kalır', () => {
    assert.strictEqual(normalizeEnv('qa-eu'), 'qa-eu');
});

test('raporlayıcı normalleştirilmiş ortamı gönderir', () => {
    assert.strictEqual(new Reporter({ env: 'development' }).env, 'local');
});

test('nabiz-durum tanınmayan ortamda hata verir', () => {
    const bin = path.join(__dirname, '../bin/nabiz-durum.js');
    const env = {
        ...process.env,
        NABIZ_URL: 'https://hub.ornek', NABIZ_KEY: 'k', NABIZ_SECRET: 'a'.repeat(64), NABIZ_ENV: 'qa-eu',
        // Güncelleme denetimi npm'e gitmesin: test ağa çıkmaz.
        NABIZ_DURUM_CEVRIMDISI: '1',
    };

    assert.throws(() => execFileSync(process.execPath, [bin], { env, cwd: __dirname, stdio: 'pipe' }), (hata) =>
        String(hata.stdout).concat(String(hata.stderr)).includes('kabul edilmez'),
    );

    const iyi = execFileSync(process.execPath, [bin], { env: { ...env, NABIZ_ENV: 'prod' }, cwd: __dirname, stdio: 'pipe' });
    assert.ok(String(iyi).includes('production (prod)'));
});
