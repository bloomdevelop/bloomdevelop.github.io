import { describe, expect, it } from 'vite-plus/test';
import { ogImagePath, ogSlug, ogVideoPath } from './config';

describe('ogSlug', () => {
    it('maps routes to stable filenames', () => {
        expect(ogSlug('/')).toBe('index');
        expect(ogSlug('/blog/')).toBe('blog');
        expect(ogSlug('/blog/pond/')).toBe('blog-pond');
        expect(ogSlug('/blog/pond')).toBe('blog-pond');
        expect(ogSlug('/blog/pond/?preview=1')).toBe('blog-pond');
        expect(ogSlug('/index.html')).toBe('index');
        expect(ogSlug('/blog/index.html')).toBe('blog');
        expect(ogSlug('/404.html')).toBe('404');
    });

    it('handles encoded and unusual segments', () => {
        expect(ogSlug('/tag/héllo/')).toBe('tag-h_llo');
        expect(ogSlug('/tag/%E2%9C%A8/')).toBe('tag-_');
    });
});

describe('og paths', () => {
    it('builds the public paths consumed by head.astro', () => {
        expect(ogImagePath('/blog/pond/')).toBe('/og/blog-pond.png');
        expect(ogVideoPath('/blog/pond/', 'mp4')).toBe('/og/blog-pond.mp4');
        expect(ogVideoPath('/blog/pond/', 'webm')).toBe('/og/blog-pond.webm');
    });
});
