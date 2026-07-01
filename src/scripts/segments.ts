export function toGraphemeSegments(
  string: string,
  lang: string = "en",
  options: Intl.SegmenterOptions = { granularity: "grapheme" },
): string[] {
  return [...new Intl.Segmenter(lang, options).segment(string)].map(
    (s) => s.segment,
  );
}
