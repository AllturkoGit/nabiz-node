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
function express(options = {}) {
    // Geç çözülüyor: init() middleware'den sonra çağrılmış olabilir.
    const get = () => require('./index').reporter();

    return function nabizMiddleware(req, res, next) {
        const startedAt = process.hrtime.bigint();

        /*
         * `finish` yerine `close` da dinlenmeli mi diye düşünülebilir; hayır:
         * `close` istemci bağlantıyı kestiğinde de tetiklenir ve o istek
         * "yavaş" sayılmamalı — süre kullanıcının kopmasıyla ölçülmüş olur.
         */
        res.once('finish', () => {
            try {
                const durationMs =
                    Number(process.hrtime.bigint() - startedAt) / 1_000_000;

                get().recordRequest({
                    // Rota deseni gönderilir, gerçek id değil: hem gruplama
                    // çalışır hem yolda kişisel veri taşınmaz.
                    route: routePattern(req),
                    method: req.method,
                    status: res.statusCode,
                    durationMs,
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
    const get = () => require('./index').reporter();

    return function nabizErrorMiddleware(error, req, res, next) {
        try {
            get().recordException(error, {
                route: routePattern(req),
                method: req.method,
            });
        } catch {
            // Sessiz.
        }

        // Handler zinciri korunur; uygulamanın kendi hata sayfası çalışır.
        next(error);
    };
};

/**
 * Express'in eşleşen rota deseni (`/urunler/:id`), gerçek yol değil.
 * Desen yoksa yola düşülür ve query string atılır (M3).
 */
function routePattern(req) {
    const pattern =
        (req.route && req.route.path) ||
        (req.baseUrl ? req.baseUrl + (req.route ? req.route.path : '') : null);

    return Scrubber.path(pattern || req.originalUrl || req.url) || '/';
}

module.exports = { express };
