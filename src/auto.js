'use strict';

/**
 * Kodsuz kurulum girişi.
 *
 *     NODE_OPTIONS="--require @allturko/nabiz-node/auto"
 *
 * Uygulama kaynağına tek satır eklemeden çalışır: Node bu dosyayı uygulamadan
 * önce yükler, kancalar orada kurulur. Onlarca projeye kurulacak bir izleme
 * paketi için değerli — her projede dosya düzenlemek, hem iş hem de "biri
 * unutuldu ve kimse fark etmedi" riski demektir.
 *
 * Karşılığında iki taviz var ve ikisi de bilinçli:
 *
 * 1. **Rota deseni yok.** Framework'ün eşleştirdiği desene (`/urunler/:id`)
 *    erişemiyoruz; ham yol normalize ediliyor (`/urunler/{id}`). Yaklaşık ama
 *    gruplamayı bozmayacak kadar iyi. Kesin desen isteyen Express
 *    middleware'ini kullanır.
 * 2. **node:http yamalanıyor.** Yama yalnızca ölçüm ekler, isteği ne
 *    değiştirir ne geciktirir; her adımı try/catch içinde ve hata durumunda
 *    orijinal davranışa dönüyor.
 */

const { init, hookProcess, reporter } = require('./index');
const Scrubber = require('./scrubber');

try {
    const r = init();

    /*
    | Kancalar `configured()` kontrolüne bakılmadan kurulur.
    |
    | Önceden bakılıyordu ve bir tuzak vardı: bu dosya Node başlarken
    | çalışıyor, framework kendi `.env`'ini çok sonra okuyor. Yapılandırma
    | o anda görünmüyorsa kanca hiç kurulmuyor ve uygulama ömrü boyunca
    | kurulmuyordu — hiçbir uyarı vermeden.
    |
    | Artık `.env` doğrudan okunuyor (bkz. ortam.js), ama yine de geç gelen
    | yapılandırmaya karşı korunmak gerekiyor. Kanca kurmanın maliyeti istek
    | başına tek bir boolean kontrolü; Reporter yapılandırma yoksa zaten
    | erken dönüyor.
    |
    | `enabled` istisna: NABIZ_ENABLED=false açık bir "hiçbir şey yapma"
    | talimatı ve sonradan değişmez (davranış garantisi 5).
    */
    if (r.enabled) {
        hookProcess();
        httpYamala();
    }
} catch {
    // Kodsuz kurulum, uygulamayı hiçbir koşulda başlatılamaz hâle getiremez.
}

/**
 * Gelen istekleri süre ve durum koduna göre ölçer.
 *
 * `Server.prototype.emit` yamalanıyor, `createServer` değil: uygulamalar
 * sunucuyu `new http.Server()`, `createServer()` ya da framework içinden
 * kurabiliyor; hepsi bu noktadan geçiyor.
 */
function httpYamala() {
    for (const modul of ['node:http', 'node:https']) {
        try {
            const http = require(modul);
            const Sunucu = http.Server;

            if (!Sunucu || Sunucu.prototype.__nabizYamali) continue;

            const asilEmit = Sunucu.prototype.emit;

            Sunucu.prototype.emit = function (olay, req, res) {
                if (olay === 'request') {
                    try {
                        olc(req, res);
                    } catch {
                        // Ölçüm kurulamadıysa istek yine de işlenir.
                    }
                }

                return asilEmit.apply(this, arguments);
            };

            Sunucu.prototype.__nabizYamali = true;
        } catch {
            // Modül yoksa geç.
        }
    }
}

function olc(req, res) {
    const baslangic = process.hrtime.bigint();

    /*
     * `close` değil `finish` dinleniyor: `close` istemci bağlantıyı kestiğinde
     * de tetiklenir ve o istek "yavaş" sayılmamalı — süre kullanıcının
     * kopmasıyla ölçülmüş olur.
     */
    res.once('finish', () => {
        try {
            reporter().recordRequest({
                route: yolDeseni(req.url),
                method: req.method,
                status: res.statusCode,
                durationMs: Number(process.hrtime.bigint() - baslangic) / 1_000_000,
            });
        } catch {
            // Sessiz.
        }
    });
}

/**
 * Ham yolu desene yaklaştırır: `/urunler/1042` → `/urunler/{id}`.
 *
 * Olmasaydı her ürün sayfası ayrı bir parmak izi üretir, panel binlerce tek
 * seferlik satırla dolar ve gruplama tamamen anlamsızlaşırdı.
 */
function yolDeseni(url) {
    /*
    | Sıra önemli: normalize ÖNCE, temizlik SONRA.
    |
    | Ters sırada UUID'ler `[jeton]` desenine takılıyor (36 karakter, 24 hane
    | eşiğinin çok üstünde) ve `/siparis/{uuid}/detay` yerine
    | `/siparis/[jeton]/detay` çıkıyordu. Testin yakaladığı gerçek bir hataydı.
    */
    let yol = String(url || '/')
        .split('?')[0]
        .split('#')[0];

    yol =
        yol
            .split('/')
            .map((parca) => {
                if (parca === '') return parca;

                // Sayı, uuid, uzun hash: hepsi kimlik.
                if (/^\d+$/.test(parca)) return '{id}';
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parca)) {
                    return '{uuid}';
                }
                if (/^[0-9a-f]{16,}$/i.test(parca)) return '{hash}';

                return parca;
            })
            .join('/') || '/';

    // Yolun kendisi kişisel veri taşıyabilir: /kullanici/ahmet@ornek.com
    return Scrubber.text(yol, 300) || '/';
}

module.exports = { yolDeseni };
