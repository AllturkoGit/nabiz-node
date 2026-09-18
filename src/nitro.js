'use strict';

const { reportRequestError } = require('./route');

/**
 * Nitro sunucu eklentisi — Nuxt 3/4, düz Nitro, Analog, SolidStart.
 *
 * Nitro rota hatalarını kendi içinde yakalayıp hata sayfasına çeviriyor;
 * `node:http` katmanına yalnızca "500" ulaşıyor. Hatanın kendisini (sınıf,
 * stack) Nitro'nun `error` kancası görüyor.
 *
 * Nuxt'ta modül bu eklentiyi kendisi kaydeder (bkz. nuxt.js). Düz Nitro:
 *
 *     // server/plugins/nabiz.ts
 *     import nabiz from '@allturko/nabiz-node/nitro';
 *     export default defineNitroPlugin(nabiz);
 */
function nabizNitro(nitroApp) {
    try {
        nitroApp.hooks.hook('error', (error, context) => {
            try {
                /*
                 * İstek dışı hatalar (Nitro'nun kendi unhandledRejection
                 * dinleyicisi, görevler) atlanır: onları hookProcess
                 * topluyor, ikinci kez göndermek çift kayıt olur.
                 */
                const event = context && context.event;
                if (!event) return;

                const node = event.node || {};

                reportRequestError(error, {
                    url: event.path || (node.req && node.req.url),
                    method: event.method || (node.req && node.req.method),
                    res: node.res,
                });
            } catch {
                // Kanca hata sayfasının çizilmesini bozmaz.
            }
        });
    } catch {
        // Beklenmeyen Nitro sürümü — eklenti sessizce devre dışı kalır.
    }
}

module.exports = nabizNitro;
module.exports.default = nabizNitro;
