# Price Matcher

A mobile app for shopping and price matching. Type an item and see every store's price, cheapest first.
Pick the store you're in to see how much a price match would save, then open a full-screen
"show the cashier" page with the competitor's price.

```
app/     Expo (React Native) app: iPhone, Android and web
server/  Small Node API that fetches prices (keeps your API key off the phone)
```

## Run it

You need Node 20.12+ and the **Expo Go** app on your phone.

```bash
# 1. Start the price server (demo prices until you add a key)
cd server
cp .env.example .env      # optional: add SERPAPI_KEY for real prices
npm start

# 2. In a second terminal, start the app
cd app
npm install
npx expo start            # scan the QR code with Expo Go (phone must be on the same Wi-Fi)
```

`npx expo start --web` opens it in a browser instead.

## Real prices

Live prices come from Google Shopping via [SerpApi](https://serpapi.com). One search covers Walmart,
Target, Amazon, Best Buy, Costco and many more. Sign up, put the key in `server/.env` as `SERPAPI_KEY`,
and restart the server. Searches are cached for 15 minutes to save credits. Without a key the server
returns made-up **demo** prices, and the app shows a "DEMO PRICES" tag.

## Features

- Search bar with recent searches
- Results sorted by total price (item + known shipping), lowest price highlighted
- "I'm shopping at…" store picker that shows how much you'd save by asking for a price match
- Full-screen price-match proof to show a cashier, with a link to the listing
- Toggles: show only the cheapest listing per store, and hide used/refurbished items

## Next steps

- Deploy `server/` (Render, Railway, Fly.io…) and set `EXPO_PUBLIC_API_URL` in the app so it works away from home Wi-Fi
- Barcode scanning (`expo-camera`) to look up an item from the shelf
- Price-drop alerts for saved items

## Tests

```bash
cd server && npm test
cd app && npx tsc --noEmit
```
