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
     * @param {{url?: string, key?: string, secret?: string, timeout?: number}} options
     */
    constructor(options = {}) {
        this.url = options.url || null;
        this.key = options.key || null;
        this.secret = options.secret || null;
        this.timeout = options.timeout ?? 2000;
    }

    configured() {
        return Boolean(this.url && this.key && this.secret);
    }

    /**
     * Sonuç döndürür ama **asla hata fırlatmaz.**
     *
     * Sonucu yalnızca teşhis komutu okuyor; izleme yolu görmezden geliyor.
     * Gönderim başarısızsa yapılacak bir şey yok, izlenen uygulamayı bundan
     * haberdar etmek log kirliliğinden başka işe yaramaz (davranış garantisi 4).
     *
     * Yine de sonucu üretmek zorunlu: `nabiz-durum --test` "gönderildi" derken
     * gerçekte hiçbir şey gitmemiş olabiliyordu ve kuran kişi kurulumu çalışır
     * sanıyordu. Teşhis aracının yanlış teşhis koyması, hiç teşhis koymamaktan
     * kötüdür.
     *
     * @param {Record<string, unknown>} payload
     * @returns {Promise<{sent: boolean, status?: number, error?: string}>}
     */
    async send(payload) {
        if (!this.configured()) {
            return { sent: false, error: 'yapilandirma-eksik' };
        }

        try {
            const body = JSON.stringify(payload);

            if (body === undefined) {
                return { sent: false, error: 'govde-kodlanamadi' };
            }

            const timestamp = String(Math.floor(Date.now() / 1000));

            // Zaman damgası imzaya dahildir; olmasaydı saldırgan damgayı
            // değiştirip eski bir gövdeyi yeniden oynatabilirdi.
            const signature = createHmac('sha256', this.secret)
                .update(`${timestamp}.${body}`)
                .digest('hex');

            /*
             * Zaman aşımı kısa ve zorunlu: raporlama isteği hiçbir koşulda
             * kullanıcının isteğini bekletmemeli.
             */
            const response = await fetch(
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

            /*
             * Hub başarıda da geçersiz istekte de 204 döner (saldırgana geri
             * bildirim verilmez). Yani 204 "kabul edildi" demek DEĞİL, yalnızca
             * "istek ulaştı" demek. Teşhis komutu bunu açıkça yazıyor.
             */
            return { sent: response.status < 400, status: response.status };
        } catch (e) {
            // Sessizce vazgeç. İzleme paketinin izlediği uygulamayı bozması,
            // çözdüğü sorundan büyük bir sorundur.
            return { sent: false, error: (e && e.message) || String(e) };
        }
    }
}

module.exports = { HubClient };
