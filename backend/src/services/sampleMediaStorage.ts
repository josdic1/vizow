/**
 * Built-in demo media is a static frontend asset.
 * The database stores the exact root-relative delivery path and nothing else
 * is required to locate the file.
 */
export function sampleMediaDeliveryUrl(
  projectSlug: string,
  filename: string,
): string {
  return `/media/${projectSlug}/${filename}`;
}
