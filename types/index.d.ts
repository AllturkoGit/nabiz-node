/**
 * @allturko/nabiz-node
 *
 * Tipler elle yazıldı, üretilmedi: paketin build adımı yok ve olmamalı —
 * bağımlılık politikası gereği (bkz. README) derleme zinciri eklenmiyor.
 */

export interface NabizOptions {
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

export interface EventContext {
    kind?: string;
    route?: string;
    method?: string;
}

/**
 * Gönderim sonucu. Yalnızca teşhis komutu okuyor; izleme yolu görmezden
 * geliyor — gönderim başarısızsa yapılacak bir şey yok.
 */
export interface SendResult {
    sent: boolean;
    status?: number;
    error?: string;
}

export declare class Reporter {
    constructor(options?: NabizOptions);
    configured(): boolean;
    recordException(error: unknown, context?: EventContext): Promise<SendResult>;
    recordRequest(measurement: {
        route: string;
        method: string;
        status: number;
        durationMs: number;
    }): Promise<void>;
}

/** Raporlayıcıyı kurar. Çağrılmazsa ilk kullanımda ortamdan kurulur. */
export declare function init(options?: NabizOptions): Reporter;

/** Bir hatayı bildirir. Hiçbir koşulda hata fırlatmaz. */
export declare function report(error: unknown, context?: EventContext): Promise<SendResult>;

/** uncaughtException ve unhandledRejection dinlenir; süreç davranışı değişmez. */
export declare function hookProcess(): Reporter;

export declare function reporter(): Reporter;

/** Express/Connect middleware. Rotalardan önce eklenir. */
export declare function express(options?: NabizOptions): (
    req: any,
    res: any,
    next: (error?: unknown) => void,
) => void;

export declare namespace express {
    /** Express hata middleware'i. Hatayı yutmaz, zincire devreder. */
    function errors(): (
        error: unknown,
        req: any,
        res: any,
        next: (error?: unknown) => void,
    ) => void;
}

/** Next 15+ `instrumentation.js` içinden dışa aktarılır. */
export declare function nextOnRequestError(
    error: unknown,
    request?: { path?: string; method?: string },
    context?: unknown,
): Promise<SendResult> | void;

export declare const version: string;

export declare const Scrubber: {
    text(value: unknown, limit: number): string | null;
    path(value: unknown): string | null;
    sql(value: unknown): string | null;
    message(value: unknown, containsSql?: boolean): string | null;
    stack(value: unknown): string | null;
};
