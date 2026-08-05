/**
 * @allturko/nabiz-node
 *
 * Tipler elle yazıldı, üretilmedi: paketin build adımı yok ve olmamalı —
 * bağımlılık politikası gereği (bkz. README) derleme zinciri eklenmiyor.
 */

export interface NabizAyar {
    /** false ise hiçbir veri gönderilmez. */
    enabled?: boolean;
    /** Hub adresi, örn. https://monitor.ornek.com */
    url?: string;
    /** Panelden alınan proje anahtarı. */
    key?: string;
    /** 64 karakterlik proje secret'i. Yalnızca sunucuda bulunur. */
    secret?: string;
    /** production | staging | local */
    env?: string;
    /** Sürüm etiketi (commit sha, tag). */
    release?: string;
    /** Gönderim zaman aşımı (ms). Varsayılan 2000. */
    timeout?: number;
    /** Bu süreyi aşan istekler yavaş sayılır (ms). Varsayılan 1000. */
    slowRequestMs?: number;
    /** Raporlanmayacak hata adları veya sınıfları. */
    ignore?: Array<string | Function>;
    /** 'server' | 'ssr' */
    source?: string;
}

export interface OlayBaglami {
    kind?: string;
    route?: string;
    method?: string;
}

export declare class Reporter {
    constructor(ayar?: NabizAyar);
    configured(): boolean;
    recordException(hata: unknown, baglam?: OlayBaglami): Promise<void>;
    recordRequest(olcum: {
        route: string;
        method: string;
        status: number;
        durationMs: number;
    }): Promise<void>;
}

/** Raporlayıcıyı kurar. Çağrılmazsa ilk kullanımda ortamdan kurulur. */
export declare function init(ayar?: NabizAyar): Reporter;

/** Bir hatayı bildirir. Hiçbir koşulda hata fırlatmaz. */
export declare function report(hata: unknown, baglam?: OlayBaglami): Promise<void>;

/** uncaughtException ve unhandledRejection dinlenir; süreç davranışı değişmez. */
export declare function hookProcess(): Reporter;

export declare function reporter(): Reporter;

/** Express/Connect middleware. Rotalardan önce eklenir. */
export declare function express(ayar?: NabizAyar): (
    req: any,
    res: any,
    next: (hata?: unknown) => void,
) => void;

export declare namespace express {
    /** Express hata middleware'i. Hatayı yutmaz, zincire devreder. */
    function errors(): (
        hata: unknown,
        req: any,
        res: any,
        next: (hata?: unknown) => void,
    ) => void;
}

/** Next 15+ `instrumentation.js` içinden dışa aktarılır. */
export declare function nextOnRequestError(
    hata: unknown,
    istek?: { path?: string; method?: string },
    baglam?: unknown,
): Promise<void> | void;

export declare const surum: string;

export declare const Scrubber: {
    text(deger: unknown, sinir: number): string | null;
    path(deger: unknown): string | null;
    sql(deger: unknown): string | null;
    message(deger: unknown, sqlIceriyor?: boolean): string | null;
    stack(deger: unknown): string | null;
};
