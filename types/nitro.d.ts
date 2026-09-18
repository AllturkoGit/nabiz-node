/**
 * Nitro sunucu eklentisi: `export default defineNitroPlugin(nabiz)`.
 *
 * Çalışma zamanı CommonJS (`module.exports = fn`, `.default` = fn). Bu yüzden
 * `export default` değil `export =` + ad alanı: `export default` yazılınca
 * `moduleResolution: node16/nodenext` altında ESM'den varsayılan içe aktarım
 * `{ default: fn }` tipinde görünüyor ve `defineNitroPlugin(nabiz)` tip
 * hatası veriyordu. `bundler` çözümlemesi ikisini de kabul ediyor.
 */
declare function nabizNitro(nitroApp: unknown): void;

declare namespace nabizNitro {
    export { nabizNitro as default };
}

export = nabizNitro;
