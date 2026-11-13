/*
 * Animated Open Graph cards.
 *
 * Frames are rendered on the fly and piped as raw RGB into ffmpeg. H.264 is
 * preferred because it has the widest support in social clients; VP9/WebM is
 * used as a fallback when the local ffmpeg has no H.264 encoder.
 */

import { Buffer } from 'node:buffer';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface VideoFormat {
    extension: 'mp4' | 'webm';
    mime: string;
    encoder: string;
}

const FORMATS: Array<VideoFormat & { args: string[] }> = [
    {
        extension: 'mp4',
        mime: 'video/mp4',
        encoder: 'libx264',
        args: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p'],
    },
    {
        extension: 'mp4',
        mime: 'video/mp4',
        encoder: 'libopenh264',
        args: [
            '-c:v',
            'libopenh264',
            '-b:v',
            '3M',
            '-pix_fmt',
            'yuv420p',
            '-allow_skip_frames',
            '1',
        ],
    },
    {
        extension: 'webm',
        mime: 'video/webm',
        encoder: 'libvpx-vp9',
        args: ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-pix_fmt', 'yuv420p'],
    },
];

let detection: Promise<VideoFormat | null> | undefined;

/** Picks the best available ffmpeg H.264/VP9 encoder, once per process. */
export const detectVideoFormat = (): Promise<VideoFormat | null> => {
    detection ??= (async () => {
        try {
            const { stdout } = await run('ffmpeg', ['-hide_banner', '-encoders']);
            for (const format of FORMATS) {
                if (stdout.includes(` ${format.encoder} `)) {
                    return {
                        extension: format.extension,
                        mime: format.mime,
                        encoder: format.encoder,
                    };
                }
            }
        } catch {
            // ffmpeg is optional: cards still work as static PNGs.
        }
        return null;
    })();

    return detection;
};

const encoderArgs = (encoder: string): string[] =>
    FORMATS.find((format) => format.encoder === encoder)?.args ?? FORMATS[0].args;

export interface EncodeOptions {
    width: number;
    height: number;
    fps: number;
    frameCount: number;
    output: string;
    format: VideoFormat;
    /** Renders one frame as raw RGB (width * height * 3 bytes). */
    renderFrame: (index: number) => Promise<Buffer>;
}

export const encodeVideo = async ({
    width,
    height,
    fps,
    frameCount,
    output,
    format,
    renderFrame,
}: EncodeOptions): Promise<void> => {
    const args = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        '-s',
        `${width}x${height}`,
        '-r',
        String(fps),
        '-i',
        'pipe:0',
        '-an',
        ...encoderArgs(format.encoder),
        ...(format.extension === 'mp4' ? ['-movflags', '+faststart'] : []),
        output,
    ];

    const child = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
    const errors: Buffer[] = [];
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));

    const closed = new Promise<number | null>((resolve) => {
        child.once('close', (code) => resolve(code));
    });
    // Errors on stdin (for example ffmpeg exiting early) surface through the
    // close handler; keep them from becoming unhandled rejections.
    child.stdin.on('error', () => {});

    try {
        for (let index = 0; index < frameCount; index++) {
            const frame = await renderFrame(index);
            if (!child.stdin.write(frame)) await once(child.stdin, 'drain');
        }
        child.stdin.end();

        const code = await closed;
        if (code !== 0) {
            const detail = Buffer.concat(errors).toString().trim().split('\n').at(-1) ?? '';
            throw new Error(`ffmpeg exited with code ${code}${detail ? `: ${detail}` : ''}`);
        }
    } catch (error) {
        child.kill('SIGKILL');
        throw error;
    }
};
