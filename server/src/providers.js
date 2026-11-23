// Price providers. Each returns a list of normalized offers:
// { id, title, store, price, shipping, total, url, thumbnail, rating, reviews, condition }

/** Parse "$1,299.99" / "1.299,99 €" style strings into a number. */
export function parsePrice(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  // If the last separator is a comma followed by exactly 2 digits, treat it as decimal.
  const normalized = /,\d{2}$/.test(cleaned)
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Turn a delivery string like "Free delivery" or "+$5.99 shipping" into a cost (null = unknown). */
export function parseShipping(delivery) {
  if (!delivery || typeof delivery !== "string") return null;
  if (/free/i.test(delivery)) return 0;
  const match = delivery.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  return match ? parsePrice(match[1]) : null;
}

export function normalizeSerpApi(json) {
  const raw = [...(json.shopping_results ?? []), ...(json.inline_shopping_results ?? [])];
  const seen = new Set();
  const offers = [];
  for (const item of raw) {
    const price = item.extracted_price ?? parsePrice(item.price);
    const store = (item.source ?? item.seller ?? "").trim();
    if (price == null || price <= 0 || !store) continue;
    const key = `${store}|${item.title}|${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const shipping = parseShipping(item.delivery);
    offers.push({
      id: String(item.product_id ?? item.position ?? offers.length) + "-" + offers.length,
      title: item.title ?? "Untitled",
      store,
      price,
      shipping,
      total: Math.round((price + (shipping ?? 0)) * 100) / 100,
      url: item.product_link ?? item.link ?? null,
      thumbnail: item.thumbnail ?? null,
      rating: item.rating ?? null,
      reviews: item.reviews ?? null,
      condition: item.second_hand_condition ?? null,
    });
  }
  return offers;
}

export async function searchSerpApi(query, { apiKey, country = "us", language = "en", fetchImpl = fetch }) {
  const url = new URL("https://serpapi.com/search.json");
  url.search = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    gl: country,
    hl: language,
    api_key: apiKey,
  }).toString();
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`SerpApi error: ${json.error ?? res.status}`);
  }
  return normalizeSerpApi(json);
}

// ---------- Demo provider (no API key needed) ----------

const DEMO_STORES = ["Walmart", "Target", "Amazon", "Best Buy", "Costco", "Kroger", "eBay", "Home Depot"];

function hash(str) {
  let h = 2166136261;
  for (const ch of str) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic fake prices so the app is usable before you get an API key. */
export function searchDemo(query) {
  const q = query.trim().toLowerCase();
  const base = 3 + (hash(q) % 400) + (hash(q + "c") % 100) / 100;
  return DEMO_STORES.map((store, i) => {
    const swing = ((hash(q + store) % 41) - 15) / 100; // -15% .. +25%
    const price = Math.max(0.99, Math.round(base * (1 + swing) * 100) / 100);
    const shipping = i % 3 === 0 ? 0 : i % 3 === 1 ? null : 5.99;
    return {
      id: `demo-${i}`,
      title: `${query.trim()} (demo listing)`,
      store,
      price,
      shipping,
      total: Math.round((price + (shipping ?? 0)) * 100) / 100,
      url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query.trim() + " " + store)}`,
      thumbnail: null,
      rating: 3.5 + (hash(store + q) % 15) / 10,
      reviews: hash(q + store + "r") % 5000,
      condition: null,
    };
  });
}
