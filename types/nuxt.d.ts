/**
 * Nuxt modülü: `modules: ['@allturko/nabiz-node/nuxt']`.
 *
 * Çalışma zamanı CommonJS (`module.exports = fn`, `.default` = fn); neden
 * `export =` olduğu için bkz. nitro.d.ts.
 */
declare function nabizNuxtModule(options: unknown, nuxt: unknown): void;

declare namespace nabizNuxtModule {
    export function getMeta(): Promise<{ name: string; configKey: string }>;
    export { nabizNuxtModule as default };
}

export = nabizNuxtModule;
