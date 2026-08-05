'use strict';

const Scrubber = require('./scrubber');

/**
 * Express / Connect middleware: yavaş istek ve 5xx ölçümü.
 *
 * Kullanım — **rotalardan önce** eklenir:
 *
 *     const { express: nabiz } = require('@allturko/nabiz-node');
 *     app.use(nabiz());
 *
 * Hata middleware'i olarak da eklenebilir; ikisi birlikte kullanılabilir:
 *
 *     app.use(nabiz.errors());
 */
function express(ayar = {}) {
    // Geç çözülüyor: init() middleware'den sonra çağrılmış olabilir.
    const al = () => require('./index').reporter();

    return function nabizMiddleware(req, res, next) {
        const baslangic = process.hrtime.bigint();

        /*
         * `finish` yerine `close` da dinlenmeli mi diye düşünülebilir; hayır:
         * `close` istemci bağlantıyı kestiğinde de tetiklenir ve o istek
         * "yavaş" sayılmamalı — süre kullanıcının kopmasıyla ölçülmüş olur.
         */
        res.once('finish', () => {
            try {
                const sureMs =
                    Number(process.hrtime.bigint() - baslangic) / 1_000_000;

                al().recordRequest({
                    // Rota deseni gönderilir, gerçek id değil: hem gruplama
                    // çalışır hem yolda kişisel veri taşınmaz.
                    route: rota(req),
                    method: req.method,
                    status: res.statusCode,
                    durationMs: sureMs,
                });
            } catch {
                // İzleme kodu isteği bozmaz.
            }
        });

        next();
    };
}

/** Express hata middleware'i. Hatayı **yutmaz**, zincire devrederek geçirir. */
express.errors = function errors() {
    const al = () => require('./index').reporter();

    return function nabizHataMiddleware(hata, req, res, next) {
        try {
            al().recordException(hata, {
                route: rota(req),
                method: req.method,
            });
        } catch {
            // Sessiz.
        }

        // Handler zinciri korunur; uygulamanın kendi hata sayfası çalışır.
        next(hata);
    };
};

/**
 * Express'in eşleşen rota deseni (`/urunler/:id`), gerçek yol değil.
 * Desen yoksa yola düşülür ve query string atılır (M3).
 */
function rota(req) {
    const desen =
        (req.route && req.route.path) ||
        (req.baseUrl ? req.baseUrl + (req.route ? req.route.path : '') : null);

    return Scrubber.path(desen || req.originalUrl || req.url) || '/';
}

module.exports = { express };
