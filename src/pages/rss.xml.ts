import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
    const publications = (await getCollection('blog', ({ data }) => !data.draft)).toSorted(
        (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
    );

    return rss({
        title: "Spring's Website",
        description: 'Publications by Spring, from Linux reviews to notes on software.',
        site: context.site ?? 'https://bloomdevelop.github.io',
        items: publications.map((publication) => ({
            title: publication.data.title,
            description:
                publication.data.description ??
                `A publication by Spring: ${publication.data.title}.`,
            pubDate: publication.data.pubDate,
            link: `/blog/${publication.id}/`,
        })),
        customData: '<language>en-us</language>',
    });
}
