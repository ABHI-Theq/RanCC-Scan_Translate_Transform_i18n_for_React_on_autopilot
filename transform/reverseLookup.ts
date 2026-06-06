/**
 * Builds a reverse lookup map from translated value → i18n key.
 * e.g. "Hello" => "hello", "Buy Now" => "buy_now"
 */
export function buildReverseLookup(
  localeData: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(localeData)) {
    // only store first occurrence — keys should be unique per value
    if (!map.has(value)) {
      map.set(value, key);
    }
  }
  return map;
}
