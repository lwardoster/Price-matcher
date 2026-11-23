import Constants from "expo-constants";

export type Offer = {
  id: string;
  title: string;
  store: string;
  price: number;
  shipping: number | null; // null = unknown
  total: number;
  url: string | null;
  thumbnail: string | null;
  rating: number | null;
  reviews: number | null;
  condition: string | null; // e.g. "used", "refurbished"
};

export type SearchResponse = {
  query: string;
  mode: "live" | "demo";
  fetchedAt: string;
  offers: Offer[];
};

/**
 * Where the backend lives. Set EXPO_PUBLIC_API_URL once it's deployed.
 * During development we reuse the IP of the computer running `expo start`,
 * so the app on your phone can reach the server on your computer.
 */
function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${devHost ?? "localhost"}:3001`;
}

export async function searchPrices(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  const res = await fetch(`${apiBaseUrl()}/search?q=${encodeURIComponent(query)}`, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Search failed (${res.status})`);
  return body as SearchResponse;
}

/** Keep just the cheapest listing from each store. Input must be sorted cheapest first. */
export function cheapestPerStore(offers: Offer[]): Offer[] {
  const seen = new Set<string>();
  return offers.filter((o) => {
    const key = o.store.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
