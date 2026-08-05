#!/usr/bin/env node
'use strict';

/**
 * Kurulum teşhisi — `npx nabiz-durum`.
 *
 * Paketin en pahalı arıza biçimi için var: **sessiz çalışmama.** Yapılandırma
 * eksikken ya da secret yanlışken hiçbir şey patlamaz, hiçbir log düşmez —
 * hub geçersiz isteğe de 204 döner (saldırgana geri bildirim verilmez).
 * Sonuç, kimsenin fark etmediği bir izleme kurulumu.
 *
 * Komut tek başına "çalışıyor" diyemez: hub geçerli ile geçersiz imzayı
 * dışarıya aynı yanıtla karşılar. Yaptığı iş, yerelde yanlış olan ne varsa
 * göstermek ve doğrulamanın hub panelinden yapılacağını söylemek.
 */

const { init, report, version } = require('../src/index');
const { env: readEnv } = require('../src/env');

const SECRET_LENGTH = 64;

function line(label, value) {
    console.log(`  ${label.padEnd(18)} ${value}`);
}

async function run() {
    /*
     * Süreç ortamı VE `.env` birlikte okunur. Yalnızca process.env'e
     * bakılıyordu ve gerçek bir kurulumda `.env` doğru doldurulmuşken komut
     * "TANIMSIZ" dedi — teşhis aracının yanlış teşhis koyması, hiç teşhis
     * koymamaktan kötüdür.
     */
    const e = { ...process.env, ...readEnv() };
    const secret = e.NABIZ_SECRET || '';

    console.log('');
    line('SDK sürümü', version);
    line('Etkin', e.NABIZ_ENABLED === 'false' ? 'HAYIR (NABIZ_ENABLED=false)' : 'evet');
    line('Hub adresi', e.NABIZ_URL || 'TANIMSIZ');
    line('Proje anahtarı', e.NABIZ_KEY || 'TANIMSIZ');
    line('Secret uzunluğu', secret ? `${secret.length} karakter` : 'TANIMSIZ');
    line('Ortam', e.NABIZ_ENV || process.env.NODE_ENV || 'production');
    line('Node', process.version);
    console.log('');

    const problems = [];

    if (e.NABIZ_ENABLED === 'false') {
        problems.push('NABIZ_ENABLED=false — hiçbir veri gönderilmez.');
    }

    const missing = ['NABIZ_URL', 'NABIZ_KEY', 'NABIZ_SECRET'].filter((k) => !e[k]);
    if (missing.length) problems.push(`${missing.join(', ')} tanımlı değil.`);

    if (secret && secret.length !== SECRET_LENGTH) {
        // En sık hata bu: secret kopyalanırken başı veya sonu eksik kalıyor
        // ve sonuç sessizce hiçbir şey göndermemek oluyor.
        problems.push(
            `NABIZ_SECRET ${SECRET_LENGTH} karakter olmalı, ${secret.length} karakter. Eksik kopyalanmış olabilir.`,
        );
    }

    if ((e.NABIZ_URL || '').startsWith('http://')) {
        problems.push(
            'NABIZ_URL http:// ile başlıyor — secret imzası şifresiz hat üzerinden gider.',
        );
    }

    if (problems.length) {
        for (const problem of problems) console.error(`  ✗ ${problem}`);
        console.log('');
        process.exitCode = 1;

        return;
    }

    console.log('  ✓ Yapılandırma tamam.');

    if (process.argv.includes('--test')) {
        init();

        // Gerçek bir hata raporlanır: hem taşıma hem temizlik sınanmış olur.
        const result = await report(
            new Error('nabiz-durum --test ile üretilen sınama olayı'),
        );

        /*
         * Sonuç okunuyor, "gönderdim" varsayılmıyor. Önceden koşulsuz başarı
         * yazılıyordu: ağ koptuysa, zaman aşımı olduysa ya da hub reddettiyse
         * komut yine "✓ gönderildi" diyordu ve kuran kişi kurulumu çalışır
         * sanıyordu. Gerçek bir kurulumda tam olarak bu yaşandı.
         */
        if (result && result.sent) {
            console.log(`  ✓ Sınama olayı gönderildi (HTTP ${result.status}).`);
        } else {
            console.error(
                `  ✗ Sınama olayı GÖNDERİLEMEDİ: ${(result && (result.error ?? `HTTP ${result.status}`)) || 'bilinmeyen sebep'}`,
            );
            console.log('');
            process.exitCode = 1;

            return;
        }
    }

    console.log('');
    console.log('  Verinin ulaştığı yalnızca hub panelinden doğrulanır:');
    console.log('  proje satırında bağlantı durumu "Bağlı" görünmelidir.');
    console.log('  Hub geçersiz imzaya da 204 döner; buradan anlaşılmaz.');
    console.log('');
}

run();
