import http from "node:http";
import { searchDemo, searchSerpApi } from "./providers.js";

const PORT = Number(process.env.PORT ?? 3001);
const API_KEY = process.env.SERPAPI_KEY?.trim() || "";
const COUNTRY = process.env.COUNTRY ?? "us";
const LANGUAGE = process.env.LANGUAGE ?? "en";
const CACHE_MS = 15 * 60 * 1000; // re-use results for 15 min to save API credits

const cache = new Map();

export async function search(query, { apiKey = API_KEY } = {}) {
  const key = query.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const mode = apiKey ? "live" : "demo";
  const offers = apiKey
    ? await searchSerpApi(query, { apiKey, country: COUNTRY, language: LANGUAGE })
    : searchDemo(query);

  offers.sort((a, b) => a.total - b.total);
  const data = { query, mode, fetchedAt: new Date().toISOString(), offers };
  cache.set(key, { at: Date.now(), data });
  return data;
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") return send(res, 200, { ok: true, mode: API_KEY ? "live" : "demo" });
  if (url.pathname !== "/search") return send(res, 404, { error: "Not found" });

  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return send(res, 400, { error: "Type at least 2 characters" });
  if (q.length > 150) return send(res, 400, { error: "Search is too long" });

  try {
    send(res, 200, await search(q));
  } catch (err) {
    console.error(err);
    send(res, 502, { error: "Couldn't reach the price service. Try again in a moment." });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Price Matcher API on http://localhost:${PORT} (${API_KEY ? "LIVE prices" : "DEMO mode - set SERPAPI_KEY for real prices"})`);
  });
}
