export const MOBILE_FIELD_MODE_MAX_WIDTH = 760;

export function shouldDefaultToFieldMode(): boolean {
  if (typeof window === "undefined") return false;

  const mediaQuery = `(max-width: ${MOBILE_FIELD_MODE_MAX_WIDTH}px)`;

  if (typeof window.matchMedia === "function") {
    return window.matchMedia(mediaQuery).matches;
  }

  return window.innerWidth <= MOBILE_FIELD_MODE_MAX_WIDTH;
}

export function defaultAppEntryPath(): "/app" | "/app/field" {
  return shouldDefaultToFieldMode() ? "/app/field" : "/app";
}
