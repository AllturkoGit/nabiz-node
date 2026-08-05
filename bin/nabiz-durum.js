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

const { init, report, surum } = require('../src/index');

const SECRET_UZUNLUGU = 64;

function satir(etiket, deger) {
    console.log(`  ${etiket.padEnd(18)} ${deger}`);
}

async function calistir() {
    const e = process.env;
    const secret = e.NABIZ_SECRET || '';

    console.log('');
    satir('SDK sürümü', surum);
    satir('Etkin', e.NABIZ_ENABLED === 'false' ? 'HAYIR (NABIZ_ENABLED=false)' : 'evet');
    satir('Hub adresi', e.NABIZ_URL || 'TANIMSIZ');
    satir('Proje anahtarı', e.NABIZ_KEY || 'TANIMSIZ');
    satir('Secret uzunluğu', secret ? `${secret.length} karakter` : 'TANIMSIZ');
    satir('Ortam', e.NABIZ_ENV || e.NODE_ENV || 'production');
    satir('Node', process.version);
    console.log('');

    const sorunlar = [];

    if (e.NABIZ_ENABLED === 'false') {
        sorunlar.push('NABIZ_ENABLED=false — hiçbir veri gönderilmez.');
    }

    const eksik = ['NABIZ_URL', 'NABIZ_KEY', 'NABIZ_SECRET'].filter((k) => !e[k]);
    if (eksik.length) sorunlar.push(`${eksik.join(', ')} tanımlı değil.`);

    if (secret && secret.length !== SECRET_UZUNLUGU) {
        // En sık hata bu: secret kopyalanırken başı veya sonu eksik kalıyor
        // ve sonuç sessizce hiçbir şey göndermemek oluyor.
        sorunlar.push(
            `NABIZ_SECRET ${SECRET_UZUNLUGU} karakter olmalı, ${secret.length} karakter. Eksik kopyalanmış olabilir.`,
        );
    }

    if ((e.NABIZ_URL || '').startsWith('http://')) {
        sorunlar.push(
            'NABIZ_URL http:// ile başlıyor — secret imzası şifresiz hat üzerinden gider.',
        );
    }

    if (sorunlar.length) {
        for (const s of sorunlar) console.error(`  ✗ ${s}`);
        console.log('');
        process.exitCode = 1;

        return;
    }

    console.log('  ✓ Yapılandırma tamam.');

    if (process.argv.includes('--test')) {
        init();
        // Gerçek bir hata raporlanır: hem taşıma hem temizlik sınanmış olur.
        await report(new Error('nabiz-durum --test ile üretilen sınama olayı'));
        console.log('  ✓ Sınama olayı gönderildi.');
    }

    console.log('');
    console.log('  Verinin ulaştığı yalnızca hub panelinden doğrulanır:');
    console.log('  proje satırında bağlantı durumu "Bağlı" görünmelidir.');
    console.log('  Hub geçersiz imzaya da 204 döner; buradan anlaşılmaz.');
    console.log('');
}

calistir();
