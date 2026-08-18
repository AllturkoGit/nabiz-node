'use strict';

const { env: readEnv } = require('./env');
const { Reporter, SDK_VERSION } = require('./reporter');
const Scrubber = require('./scrubber');

/**
 * @allturko/nabiz-node — Node tarafı raporlayıcı.
 *
 * Kapsamı bilinçli olarak dar: **sunucu tarafı.** Tarayıcı hataları hub'dan
 * servis edilen `t.js` ile toplanır ve o dosya npm'e taşınmaz — hosted olması
 * merkezî güncellemeyi mümkün kılıyor, paket olsaydı her düzeltme için 13
 * projenin yeniden dağıtılması gerekirdi.
 *
 * Node tarafında hosted seçenek yok: sunucuda script etiketi çalışmaz. Burada
 * paket tek yol, ve kopyalanan dosya yerine paket olması gerekli — kopya
 * dosyalar güncellenmez ve bu **sessizce** olur.
 */

/** @type {Reporter|null} */
let instance = null;

/**
 * Ortam değişkenlerinden yapılandırma. Laravel paketiyle aynı isimler
 * kullanılıyor: aynı projeyi iki dilde izleyen ekip iki ayrı isim seti
 * öğrenmek zorunda kalmasın.
 *
 * `process.env` değil `readEnv()`: ön yükleme sırasında framework henüz kendi
 * `.env`'ini okumamış oluyor ve süreç ortamı boş görünüyor.
 */
function fromEnvironment() {
    const e = { ...process.env, ...readEnv() };

    return {
        enabled: e.NABIZ_ENABLED !== 'false',
        url: e.NABIZ_URL,
        key: e.NABIZ_KEY,
        secret: e.NABIZ_SECRET,
        env: e.NABIZ_ENV || e.NODE_ENV || 'production',
        release: e.NABIZ_RELEASE || null,
        timeout: e.NABIZ_TIMEOUT ? Number(e.NABIZ_TIMEOUT) : 2000,
        slowRequestMs: e.NABIZ_SLOW_REQUEST_MS
            ? Number(e.NABIZ_SLOW_REQUEST_MS)
            : 1000,
    };
}

/**
 * Raporlayıcıyı kurar. Çağrılmazsa ilk kullanımda ortam değişkenlerinden
 * kendiliğinden kurulur — kurulum adımını unutmak sessiz arıza üretmesin.
 *
 * @param {Record<string, unknown>} [options]
 */
function init(options = {}) {
    instance = new Reporter({ ...fromEnvironment(), ...options });

    return instance;
}

function reporter() {
    if (!instance) init();

    return instance;
}

/**
 * Bir hatayı hub'a bildirir. Hiçbir koşulda hata fırlatmaz ve **beklenmesi
 * gerekmez**: `await` edilmezse arka planda tamamlanır.
 *
 * @param {unknown} error
 * @param {{kind?: string, route?: string, method?: string}} [context]
 */
function report(error, context) {
    return reporter().recordException(error, context);
}

/**
 * Yakalanmamış hataları ve işlenmemiş promise reddini dinler.
 *
 * Süreci **sonlandırmaz ve davranışı değiştirmez**: Node'un varsayılan
 * davranışı korunur. Bir izleme paketinin süreç yönetimine karışması,
 * çözdüğü sorundan büyük bir sorundur.
 */
/**
 * Canlılık isteklerinin aralığı.
 *
 * Hub 24 saat ses çıkmayan kurulumu "sessiz" sayıyor. Aralık eşiğe eşit
 * olsaydı tek bir kaçırılan istek — deploy, yeniden başlatma, birkaç
 * dakikalık ağ kesintisi — projeyi anında bozuk gösterirdi. Üçte bir güvenli
 * tolerans: iki tur kaçsa bile alarm çalmaz.
 *
 * Sıklaştırmanın bilgi değeri yok: kurulumun çalışıp çalışmadığı saatlik
 * değişen bir şey değil ve sitenin ayakta olup olmadığını hub kendi
 * probuyla zaten ölçüyor.
 */
const HEARTBEAT_MS = 8 * 60 * 60 * 1000;

let heartbeatTimer = null;

/**
 * Süreç boyunca düzenli "buradayım" gönderir.
 *
 * Süreç başlarken hemen bir istek atılır: deploy sonrası kurulum kendini
 * anında kanıtlar, sekiz saat beklemez.
 */
function startHeartbeat(intervalMs = HEARTBEAT_MS) {
    // İki kez çağrılırsa ikinci zamanlayıcı kurulmaz; hookProcess birden
    // fazla yerden çağrılabiliyor (auto, instrumentation, elle).
    if (heartbeatTimer) {
        return heartbeatTimer;
    }

    reporter().heartbeat();

    heartbeatTimer = setInterval(() => reporter().heartbeat(), intervalMs);

    /*
     * unref: zamanlayıcı süreci hayatta tutmasın. Kısa ömürlü bir betik
     * işini bitirince kapanmalı — izleme paketi onu sekiz saat ayakta
     * tutarsa CLI komutları asla dönmez.
     */
    if (typeof heartbeatTimer.unref === 'function') {
        heartbeatTimer.unref();
    }

    return heartbeatTimer;
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

function hookProcess() {
    const r = reporter();

    process.on('uncaughtException', (error) => {
        r.recordException(error, { kind: 'exception' });

        /*
         * Yeniden fırlatılmıyor ve process.exit çağrılmıyor: dinleyici
         * eklendiği an Node'un varsayılan "çök" davranışı zaten devre dışı
         * kalıyor. Uygulamanın kendi dinleyicisi varsa o karar verir.
         */
    });

    process.on('unhandledRejection', (reason) => {
        r.recordException(reason, { kind: 'exception' });
    });

    // Kancalarla birlikte: hookProcess her kurulum reçetesinin ortak adımı,
    // canlılığın ayrıca hatırlanması gereken bir çağrı olmaması gerekiyor.
    startHeartbeat();

    return r;
}

module.exports = {
    init,
    report,
    hookProcess,
    startHeartbeat,
    stopHeartbeat,
    reporter,
    Reporter,
    Scrubber,
    version: SDK_VERSION,
    express: require('./express').express,
    nextOnRequestError: require('./next').nextOnRequestError,
};
