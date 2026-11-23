import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSerpApi, parsePrice, parseShipping, searchDemo } from "../src/providers.js";
import { search } from "../src/index.js";

test("parsePrice handles common formats", () => {
  assert.equal(parsePrice("$1,299.99"), 1299.99);
  assert.equal(parsePrice("1.299,99 €"), 1299.99);
  assert.equal(parsePrice("$4"), 4);
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice(undefined), null);
});

test("parseShipping", () => {
  assert.equal(parseShipping("Free delivery"), 0);
  assert.equal(parseShipping("+$5.99 shipping"), 5.99);
  assert.equal(parseShipping("Delivery by Fri"), null);
});

test("normalizeSerpApi keeps valid offers and drops junk", () => {
  const offers = normalizeSerpApi({
    shopping_results: [
      { title: "AirPods", price: "$99.00", extracted_price: 99, source: "Walmart", delivery: "Free delivery", product_link: "https://x" },
      { title: "AirPods", price: "$99.00", extracted_price: 99, source: "Walmart" }, // duplicate
      { title: "No store", price: "$5" },
      { title: "AirPods", price: "$109.00", source: "Target", delivery: "$4.99 delivery" },
    ],
  });
  assert.equal(offers.length, 2);
  assert.deepEqual(offers.map((o) => [o.store, o.total]), [["Walmart", 99], ["Target", 113.99]]);
});

test("demo search is deterministic and sorted cheapest first", async () => {
  const prices = (q) => searchDemo(q).map((o) => o.price);
  assert.deepEqual(prices("paper towels"), prices("Paper Towels "));
  const { mode, offers } = await search("paper towels", { apiKey: "" });
  assert.equal(mode, "demo");
  for (let i = 1; i < offers.length; i++) assert.ok(offers[i - 1].total <= offers[i].total);
});
