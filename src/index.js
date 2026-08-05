'use strict';

const { ortam } = require('./ortam');
const { Reporter, SDK_SURUMU } = require('./reporter');
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
let raporlayici = null;

/**
 * Ortam değişkenlerinden yapılandırma. Laravel paketiyle aynı isimler
 * kullanılıyor: aynı projeyi iki dilde izleyen ekip iki ayrı isim seti
 * öğrenmek zorunda kalmasın.
 *
 * `process.env` değil `ortam()`: ön yükleme sırasında framework henüz kendi
 * `.env`'ini okumamış oluyor ve süreç ortamı boş görünüyor.
 */
function ortamdan() {
    const e = { ...process.env, ...ortam() };

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
 * @param {Record<string, unknown>} [ayar]
 */
function init(ayar = {}) {
    raporlayici = new Reporter({ ...ortamdan(), ...ayar });

    return raporlayici;
}

function reporter() {
    if (!raporlayici) init();

    return raporlayici;
}

/**
 * Bir hatayı hub'a bildirir. Hiçbir koşulda hata fırlatmaz ve **beklenmesi
 * gerekmez**: `await` edilmezse arka planda tamamlanır.
 *
 * @param {unknown} hata
 * @param {{kind?: string, route?: string, method?: string}} [baglam]
 */
function report(hata, baglam) {
    return reporter().recordException(hata, baglam);
}

/**
 * Yakalanmamış hataları ve işlenmemiş promise reddini dinler.
 *
 * Süreci **sonlandırmaz ve davranışı değiştirmez**: Node'un varsayılan
 * davranışı korunur. Bir izleme paketinin süreç yönetimine karışması,
 * çözdüğü sorundan büyük bir sorundur.
 */
function hookProcess() {
    const r = reporter();

    process.on('uncaughtException', (hata) => {
        r.recordException(hata, { kind: 'exception' });

        /*
         * Yeniden fırlatılmıyor ve process.exit çağrılmıyor: dinleyici
         * eklendiği an Node'un varsayılan "çök" davranışı zaten devre dışı
         * kalıyor. Uygulamanın kendi dinleyicisi varsa o karar verir.
         */
    });

    process.on('unhandledRejection', (sebep) => {
        r.recordException(sebep, { kind: 'exception' });
    });

    return r;
}

module.exports = {
    init,
    report,
    hookProcess,
    reporter,
    Reporter,
    Scrubber,
    surum: SDK_SURUMU,
    express: require('./express').express,
    nextOnRequestError: require('./next').nextOnRequestError,
};
