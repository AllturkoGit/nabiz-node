'use strict';

const { HubClient } = require('./client');
const Scrubber = require('./scrubber');

const SDK_SURUMU = require('../package.json').version;

/**
 * Ölçüm biriktirir ve olayları hub'a gönderir.
 *
 * PHP paketinden (allturko/nabiz) bir yapısal fark var: orada Recorder istek
 * başına tekil, burada süreç boyunca tekil. Node'da tek süreç binlerce isteği
 * karşılıyor, istek başına durum tutmak sızıntı olurdu — bu yüzden istek
 * bağlamı çağrı anında parametre olarak geçiliyor, alanda saklanmıyor.
 */
class Reporter {
    constructor(ayar = {}) {
        this.client = new HubClient(ayar);
        this.enabled = ayar.enabled !== false;
        this.env = ayar.env || 'production';
        this.release = ayar.release || null;
        this.source = ayar.source || 'server';
        this.slowRequestMs = ayar.slowRequestMs ?? 1000;
        this.ignore = ayar.ignore || [];

        /*
         * Aynı hatayı iki kez raporlamamak için. WeakSet: hata nesnesi çöp
         * toplandığında kayıt da düşer, uzun ömürlü süreçte bellek sızmaz.
         */
        this.reported = new WeakSet();
    }

    configured() {
        return this.enabled && this.client.configured();
    }

    /**
     * @param {unknown} hata
     * @param {{kind?: string, route?: string, method?: string}} [baglam]
     */
    async recordException(hata, baglam = {}) {
        try {
            if (!this.configured()) return;
            if (this.ignored(hata)) return;

            if (hata && typeof hata === 'object') {
                if (this.reported.has(hata)) return;
                this.reported.add(hata);
            }

            const mesaj = hata && hata.message ? hata.message : String(hata);

            await this.send({
                kind: baglam.kind || 'exception',
                // Veritabanı hataları SQL'i bağlanmış değerlerle taşır;
                // oturum kimliği, e-posta, kart numarası oradan sızabilir.
                msg: Scrubber.message(mesaj, this.sqlIceriyor(hata)),
                exception_class: (hata && hata.name) || 'Error',
                stack: Scrubber.stack(hata && hata.stack),
                route: baglam.route,
                method: baglam.method,
            });
        } catch {
            // Kendi hatasını raporlamaz — sonsuz döngü riski.
        }
    }

    /**
     * İstek bitiminde çağrılır. Yalnızca yavaş istek veya 5xx raporlanır;
     * her isteği göndermek izlenen uygulamaya da hub'a da yük olurdu.
     */
    async recordRequest({ route, method, status, durationMs }) {
        try {
            if (!this.configured()) return;

            const yavas = durationMs >= this.slowRequestMs;
            if (!yavas && status < 500) return;

            const etiket = `${method} ${route}`;

            await this.send({
                kind: status >= 500 ? 'http_5xx' : 'slow_request',
                msg:
                    status >= 500
                        ? `${etiket} — HTTP ${status}`
                        : `${etiket} — ${Math.round(durationMs)} ms`,
                route: etiket,
                method,
                status,
                duration_ms: Math.round(durationMs),
                memory_mb: Math.round(process.memoryUsage().rss / 1048576),
            });
        } catch {
            // Sessiz.
        }
    }

    /** @param {Record<string, unknown>} olay */
    async send(olay) {
        const govde = {
            ...olay,
            env: this.env,
            source: this.source,
            release: this.release,
            /*
             * Çalışma ortamı ve SDK sürümü. Hub bunları bağlamda saklıyor;
             * sdk_version olmadan hangi projenin eski sürümde kaldığı
             * görülemez ve güncelleme körlemesine yapılır.
             */
            runtime: 'node',
            runtime_version: process.version,
            sdk_version: SDK_SURUMU,
        };

        for (const anahtar of Object.keys(govde)) {
            if (govde[anahtar] === null || govde[anahtar] === undefined) {
                delete govde[anahtar];
            }
        }

        await this.client.send(govde);
    }

    /**
     * Mesajı SQL taşıyan hatalar. Sürücü paketlerine bağımlılık kurulmadığı
     * için ada ve içeriğe bakılıyor.
     */
    sqlIceriyor(hata) {
        const ad = (hata && hata.name) || '';
        const mesaj = (hata && hata.message) || '';

        return (
            /sequelize|prisma|query|database|pg|mysql/i.test(ad) ||
            /\bselect\b|\binsert\b|\bupdate\b|\bdelete\b/i.test(mesaj)
        );
    }

    ignored(hata) {
        const ad = (hata && hata.name) || '';

        return this.ignore.some((k) => k === ad || (hata && hata instanceof k));
    }
}

module.exports = { Reporter, SDK_SURUMU };
