// Shared module-level cache for the Apps page.
// Keyed by "serial:scope" so both Apps.tsx and App.tsx can read/write it.

export interface AppEntry {
  package: string;
  version: string;
  displayName: string;
  iconDataUrl: string | null;
}

export const appsCache = new Map<string, AppEntry[]>();

export function appsCacheKey(serial: string, thirdPartyOnly: boolean): string {
  return `${serial}:${thirdPartyOnly ? "third-party" : "all"}`;
}

/**
 * Prefetch apps for a serial in the background if not already cached.
 * Safe to call multiple times — skips if data is already present or a fetch
 * for that key is already in flight.
 */
const inFlight = new Set<string>();

export async function prefetchApps(serial: string): Promise<void> {
  // We prefetch the default scope (third-party) as that's what opens first.
  const key = appsCacheKey(serial, true);
  if (appsCache.has(key) || inFlight.has(key)) return;

  inFlight.add(key);
  try {
    const result = await window.firefly.listApps({ serial, thirdPartyOnly: true });
    if (result.success) {
      appsCache.set(key, result.apps);
    }
  } catch {
    // Silently ignore — the Apps page will fetch on demand if this failed
  } finally {
    inFlight.delete(key);
  }
}
