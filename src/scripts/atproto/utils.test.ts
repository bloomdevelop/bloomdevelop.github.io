import { describe, expect, it } from 'vite-plus/test';
import {
    constructApiUrl,
    extractRkeyFromPlainAtURI,
    formatNoteDate,
    formatPostDate,
    toGraphemeSegments,
} from './utils';

describe('constructApiUrl', () => {
    it('builds XRPC URLs and skips empty parameters', () => {
        const url = constructApiUrl(
            'com.atproto.repo.listRecords',
            {
                repo: 'did:plc:abc',
                collection: 'space.bunniesin.log.entry',
                limit: '50',
                cursor: '',
            },
            'https://pds.example',
        );
        const parsed = new URL(url);

        expect(parsed.origin).toBe('https://pds.example');
        expect(parsed.pathname).toBe('/xrpc/com.atproto.repo.listRecords');
        expect(parsed.searchParams.get('repo')).toBe('did:plc:abc');
        expect(parsed.searchParams.get('limit')).toBe('50');
        expect(parsed.searchParams.has('cursor')).toBe(false);
    });
});

describe('extractRkeyFromPlainAtURI', () => {
    it('returns the last AT URI segment', () => {
        expect(extractRkeyFromPlainAtURI('at://did:plc:abc/space.bunniesin.log.entry/3kabc')).toBe(
            '3kabc',
        );
    });

    it('returns an empty string when there is no segment', () => {
        expect(extractRkeyFromPlainAtURI('')).toBe('');
    });
});

describe('toGraphemeSegments', () => {
    it('keeps emoji sequences in one cluster', () => {
        expect(toGraphemeSegments('a👩🏽‍💻b')).toEqual(['a', '👩🏽‍💻', 'b']);
    });

    it('keeps combining marks with their base character', () => {
        expect(toGraphemeSegments('e\u0301')).toEqual(['e\u0301']);
    });
});

describe('formatPostDate', () => {
    it('formats calendar dates in UTC so builds do not shift the day', () => {
        expect(formatPostDate(new Date('2026-11-03T00:00:00.000Z'))).toBe('November 3, 2026');
    });
});

describe('formatNoteDate', () => {
    it('formats an explicit timezone', () => {
        expect(formatNoteDate('2026-11-03T23:30:00.000Z', 'UTC')).toBe('Nov 3, 2026, 11:30 PM');
    });

    it('honours another timezone', () => {
        expect(formatNoteDate('2026-11-03T23:30:00.000Z', 'Asia/Tokyo')).toBe(
            'Nov 4, 2026, 8:30 AM',
        );
    });
});
