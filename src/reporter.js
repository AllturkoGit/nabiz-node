'use strict';

const { HubClient } = require('./client');
const Scrubber = require('./scrubber');

const SDK_VERSION = require('../package.json').version;

/**
 * Ölçüm biriktirir ve olayları hub'a gönderir.
 *
 * PHP paketinden (allturko/nabiz) bir yapısal fark var: orada Recorder istek
 * başına tekil, burada süreç boyunca tekil. Node'da tek süreç binlerce isteği
 * karşılıyor, istek başına durum tutmak sızıntı olurdu — bu yüzden istek
 * bağlamı çağrı anında parametre olarak geçiliyor, alanda saklanmıyor.
 */
class Reporter {
    constructor(options = {}) {
        this.client = new HubClient(options);
        this.enabled = options.enabled !== false;
        this.env = options.env || 'production';
        this.release = options.release || null;
        this.source = options.source || 'server';
        this.slowRequestMs = options.slowRequestMs ?? 1000;
        this.ignore = options.ignore || [];

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
     * @param {unknown} error
     * @param {{kind?: string, route?: string, method?: string}} [context]
     * @returns {Promise<{sent: boolean, status?: number, error?: string}>}
     */
    async recordException(error, context = {}) {
        try {
            if (!this.configured()) {
                return { sent: false, error: 'yapilandirma-eksik' };
            }

            if (this.ignored(error)) {
                return { sent: false, error: 'yok-sayildi' };
            }

            if (error && typeof error === 'object') {
                if (this.reported.has(error)) {
                    return { sent: false, error: 'zaten-raporlandi' };
                }

                this.reported.add(error);
            }

            const message = error && error.message ? error.message : String(error);

            return await this.send({
                kind: context.kind || 'exception',
                // Veritabanı hataları SQL'i bağlanmış değerlerle taşır;
                // oturum kimliği, e-posta, kart numarası oradan sızabilir.
                msg: Scrubber.message(message, this.containsSql(error)),
                exception_class: (error && error.name) || 'Error',
                stack: Scrubber.stack(error && error.stack),
                route: context.route,
                method: context.method,
            });
        } catch (e) {
            // Kendi hatasını raporlamaz — sonsuz döngü riski. Sonuç yalnızca
            // teşhis komutu için üretiliyor.
            return { sent: false, error: (e && e.message) || String(e) };
        }
    }

    /**
     * İstek bitiminde çağrılır. Yalnızca yavaş istek veya 5xx raporlanır;
     * her isteği göndermek izlenen uygulamaya da hub'a da yük olurdu.
     */
    async recordRequest({ route, method, status, durationMs }) {
        try {
            if (!this.configured()) return;

            const slow = durationMs >= this.slowRequestMs;
            if (!slow && status < 500) return;

            const label = `${method} ${route}`;

            await this.send({
                kind: status >= 500 ? 'http_5xx' : 'slow_request',
                msg:
                    status >= 500
                        ? `${label} — HTTP ${status}`
                        : `${label} — ${Math.round(durationMs)} ms`,
                route: label,
                method,
                status,
                duration_ms: Math.round(durationMs),
                memory_mb: Math.round(process.memoryUsage().rss / 1048576),
            });
        } catch {
            // Sessiz.
        }
    }

    /**
     * Ortak alanları ekleyip gönderir.
     *
     * @param {Record<string, unknown>} event
     * @returns {Promise<{sent: boolean, status?: number, error?: string}>}
     */
    async send(event) {
        const body = {
            ...event,
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
            sdk_version: SDK_VERSION,
        };

        for (const key of Object.keys(body)) {
            if (body[key] === null || body[key] === undefined) {
                delete body[key];
            }
        }

        return await this.client.send(body);
    }

    /**
     * Mesajı SQL taşıyan hatalar. Sürücü paketlerine bağımlılık kurulmadığı
     * için ada ve içeriğe bakılıyor.
     */
    containsSql(error) {
        const name = (error && error.name) || '';
        const message = (error && error.message) || '';

        return (
            /sequelize|prisma|query|database|pg|mysql/i.test(name) ||
            /\bselect\b|\binsert\b|\bupdate\b|\bdelete\b/i.test(message)
        );
    }

    ignored(error) {
        const name = (error && error.name) || '';

        return this.ignore.some(
            (entry) => entry === name || (error && error instanceof entry),
        );
    }
}

module.exports = { Reporter, SDK_VERSION };
