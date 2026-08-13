import {
  mediaLibraryResponseSchema,
  type MediaLibraryItem,
} from "@vizow/shared";

export async function fetchMediaLibrary(
  signal?: AbortSignal,
): Promise<MediaLibraryItem[]> {
  const response = await fetch("/api/media", {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load Media Library. HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const result = mediaLibraryResponseSchema.safeParse(payload);

  if (!result.success) {
    console.error("Invalid Media Library response:", result.error);
    throw new Error("The Media Library API returned an invalid response.");
  }

  return result.data.media;
}
