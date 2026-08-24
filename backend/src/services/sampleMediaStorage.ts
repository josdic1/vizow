/**
 * Sample/demo media ships with the frontend as immutable application fixtures.
 * It deliberately does not use Cloudinary. User-created media is the only media
 * that crosses the Cloudinary persistence boundary.
 */
export function sampleMediaStorageKey(
  projectSlug: string,
  filename: string,
): string {
  return `media/${projectSlug}/${filename}`;
}

export function sampleMediaDeliveryUrl(
  projectSlug: string,
  filename: string,
): string {
  return `/${sampleMediaStorageKey(projectSlug, filename)}`;
}
