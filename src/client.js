'use strict';

const { createHmac } = require('node:crypto');

/**
 * Hub'a HMAC imzalı POST.
 *
 * Davranış garantisi: **hiçbir koşulda hata fırlatmaz.** Hub erişilemezse,
 * yapılandırma eksikse veya ağ koparsa sessizce vazgeçilir — izlenen
 * uygulamada hata, log kirliliği veya yavaşlama oluşmaz.
 */
class HubClient {
    /**
     * @param {{url?: string, key?: string, secret?: string, timeout?: number}} ayar
     */
    constructor(ayar = {}) {
        this.url = ayar.url || null;
        this.key = ayar.key || null;
        this.secret = ayar.secret || null;
        this.timeout = ayar.timeout ?? 2000;
    }

    configured() {
        return Boolean(this.url && this.key && this.secret);
    }

    /**
     * @param {Record<string, unknown>} payload
     * @returns {Promise<void>}
     */
    async send(payload) {
        if (!this.configured()) return;

        try {
            const body = JSON.stringify(payload);
            const timestamp = String(Math.floor(Date.now() / 1000));

            // Zaman damgası imzaya dahildir; olmasaydı saldırgan damgayı
            // değiştirip eski bir gövdeyi yeniden oynatabilirdi.
            const signature = createHmac('sha256', this.secret)
                .update(`${timestamp}.${body}`)
                .digest('hex');

            /*
             * Zaman aşımı kısa ve zorunlu: raporlama isteği hiçbir koşulda
             * kullanıcının isteğini bekletmemeli. AbortSignal.timeout Node
             * 17.3+ ile var; daha eskisi zaten desteklenmiyor.
             */
            await fetch(
                `${this.url.replace(/\/+$/, '')}/api/i/${encodeURIComponent(this.key)}/server`,
                {
                    method: 'POST',
                    body,
                    // Yönlendirme takip edilmez: imzalı gövdeyi bilinmeyen bir
                    // adrese göndermek istemeyiz.
                    redirect: 'manual',
                    signal: AbortSignal.timeout(this.timeout),
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Nabiz-Signature': `sha256=${signature}`,
                        'X-Nabiz-Timestamp': timestamp,
                    },
                },
            );
        } catch {
            // Sessizce vazgeç. İzleme paketinin izlediği uygulamayı bozması,
            // çözdüğü sorundan büyük bir sorundur.
        }
    }
}

module.exports = { HubClient };
