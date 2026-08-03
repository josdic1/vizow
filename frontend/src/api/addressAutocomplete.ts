export type AddressSuggestion = {
  label: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

const suggestionCache = new Map<
  string,
  AddressSuggestion[]
>();

const maximumCacheEntries = 50;

function isSuggestion(
  value: unknown,
): value is AddressSuggestion {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const suggestion =
    value as Record<string, unknown>;

  return (
    typeof suggestion.label === "string" &&
    typeof suggestion.addressLine1 === "string" &&
    typeof suggestion.city === "string" &&
    typeof suggestion.state === "string" &&
    typeof suggestion.postalCode === "string"
  );
}

export async function fetchAddressSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const cacheKey = query
    .trim()
    .toLocaleLowerCase();

  const cachedSuggestions =
    suggestionCache.get(cacheKey);

  if (cachedSuggestions) {
    return cachedSuggestions;
  }

  try {
    const response = await fetch(
      `/api/address-autocomplete?q=${encodeURIComponent(
        query,
      )}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal,
      },
    );

    if (!response.ok) {
      return [];
    }

    const payload: unknown =
      await response.json();

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("suggestions" in payload) ||
      !Array.isArray(payload.suggestions)
    ) {
      return [];
    }

    const suggestions =
      payload.suggestions.filter(
        isSuggestion,
      );

    suggestionCache.set(
      cacheKey,
      suggestions,
    );

    if (
      suggestionCache.size >
      maximumCacheEntries
    ) {
      const oldestKey =
        suggestionCache.keys().next().value;

      if (oldestKey !== undefined) {
        suggestionCache.delete(oldestKey);
      }
    }

    return suggestions;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw error;
    }

    return [];
  }
}
