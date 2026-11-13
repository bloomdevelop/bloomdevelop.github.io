declare module 'wawoff2' {
    /** Decompresses a woff2 file into sfnt (ttf/otf) bytes. */
    export function decompress(input: Uint8Array): Promise<Uint8Array>;

    /** Compresses sfnt (ttf/otf) bytes into woff2. */
    export function compress(input: Uint8Array): Promise<Uint8Array>;
}
