'use strict';

const { reportRequestError } = require('./route');

/**
 * Hono middleware'i.
 *
 *     import { hono as nabiz } from '@allturko/nabiz-node';
 *     app.use(nabiz());
 *
 * `app.onError` kullanılmadı: tek bir işleyici tutuyor ve kurmak
 * uygulamanın kendi hata sayfasını ezerdi. Hono yakaladığı hatayı `c.error`
 * alanına koyuyor; middleware onu `next()` döndükten sonra okuyor.
 */
function nabizHono() {
    return async function nabizHonoMiddleware(c, next) {
        await next();

        try {
            if (!c.error) return;

            reportRequestError(c.error, {
                url: c.req && c.req.path,
                method: c.req && c.req.method,
                status: c.res && c.res.status,
                // @hono/node-server gerçek yanıt nesnesini buraya koyuyor.
                res: c.env && c.env.outgoing,
            });
        } catch {
            // Yanıtı hiçbir koşulda bozmaz.
        }
    };
}

module.exports = { hono: nabizHono };
