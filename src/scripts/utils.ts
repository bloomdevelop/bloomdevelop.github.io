export function extractRkeyFromPlainAtURI(uri: string) {
  return uri.split("/").at(-1);
}

export function formatDate(date: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeStyle: "long",
    dateStyle: "short",
  });

  return formatter.format(new Date(date));
}
