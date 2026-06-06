/**
 * Builds a reverse lookup: translated value → i18n key.
 *
 * e.g.  { "hello": "Hello", "buy_now": "Buy Now" }
 *   =>  Map { "Hello" => "hello", "Buy Now" => "buy_now" }
 *
 * When multiple keys share the same value, the first one wins.
 */
export function buildReverseLookup(
  localeData: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(localeData)) {
    if (value && !map.has(value)) {
      map.set(value, key);
    }
  }
  return map;
}
