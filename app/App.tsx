import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { cheapestPerStore, money, Offer, searchPrices, SearchResponse } from "./src/api";
import { addRecent, clearRecents, loadCurrentStore, loadRecents, saveCurrentStore } from "./src/storage";

const COMMON_STORES = ["Walmart", "Target", "Best Buy", "Costco", "Kroger", "Home Depot", "Lowe's"];

const sameStore = (a: string, b: string) => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/com$/, "");
  return norm(a).includes(norm(b)) || norm(b).includes(norm(a));
};

export default function App() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [currentStore, setCurrentStore] = useState<string | null>(null);
  const [onePerStore, setOnePerStore] = useState(true);
  const [hideUsed, setHideUsed] = useState(true);
  const [proof, setProof] = useState<Offer | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadRecents().then(setRecents);
    loadCurrentStore().then(setCurrentStore);
  }, []);

  async function runSearch(text = query) {
    const q = text.trim();
    if (q.length < 2) return;
    Keyboard.dismiss();
    setQuery(q);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await searchPrices(q, controller.signal);
      setData(res);
      setRecents(await addRecent(q, recents));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message ?? "Something went wrong");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }

  function pickStore(store: string | null) {
    const next = store && currentStore && sameStore(store, currentStore) ? null : store;
    setCurrentStore(next);
    saveCurrentStore(next);
  }

  const offers = useMemo(() => {
    let list = data?.offers ?? [];
    if (hideUsed) list = list.filter((o) => !o.condition);
    return onePerStore ? cheapestPerStore(list) : list;
  }, [data, onePerStore, hideUsed]);

  const best = offers[0];
  const priciest = offers.length ? offers[offers.length - 1].total : 0;
  const hereOffer = currentStore ? offers.find((o) => sameStore(o.store, currentStore)) : undefined;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Price Matcher</Text>
        {data?.mode === "demo" && <Text style={styles.demoTag}>DEMO PRICES</Text>}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="What are you looking for?"
          placeholderTextColor="#8a8f98"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch()}
          returnKeyType="search"
          autoCorrect={false}
          autoFocus
          clearButtonMode="while-editing"
        />
        <Pressable style={styles.searchBtn} onPress={() => runSearch()}>
          <Text style={styles.searchBtnText}>Go</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>I'm shopping at</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {COMMON_STORES.map((s) => {
          const active = !!currentStore && sameStore(s, currentStore);
          return (
            <Pressable key={s} onPress={() => pickStore(s)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && <ActivityIndicator style={{ marginTop: 24 }} size="large" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {!data && !loading && (
        <View style={styles.recents}>
          {recents.length > 0 && (
            <>
              <View style={styles.recentsHeader}>
                <Text style={styles.label}>Recent searches</Text>
                <Pressable onPress={() => { clearRecents(); setRecents([]); }}>
                  <Text style={styles.link}>Clear</Text>
                </Pressable>
              </View>
              <View style={styles.wrap}>
                {recents.map((r) => (
                  <Pressable key={r} style={styles.chip} onPress={() => runSearch(r)}>
                    <Text style={styles.chipText}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {data && !loading && (
        <FlatList
          data={offers}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ gap: 10 }}>
              {best && <MatchBanner best={best} here={hereOffer} currentStore={currentStore} onProof={() => setProof(best)} />}
              <View style={styles.toggles}>
                <Toggle label="Cheapest per store" value={onePerStore} onChange={setOnePerStore} />
                <Toggle label="Hide used" value={hideUsed} onChange={setHideUsed} />
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No prices found. Try a more specific name or brand.</Text>}
          renderItem={({ item, index }) => (
            <OfferRow
              offer={item}
              rank={index + 1}
              savings={priciest - item.total}
              isHere={!!currentStore && sameStore(item.store, currentStore)}
              onPress={() => item.url && WebBrowser.openBrowserAsync(item.url)}
              onProof={() => setProof(item)}
            />
          )}
        />
      )}

      <ProofModal offer={proof} fetchedAt={data?.fetchedAt} onClose={() => setProof(null)} />
    </View>
  );
}

function MatchBanner({ best, here, currentStore, onProof }: { best: Offer; here?: Offer; currentStore: string | null; onProof: () => void }) {
  if (currentStore && here && sameStore(here.store, best.store)) {
    return (
      <View style={[styles.banner, styles.bannerGood]}>
        <Text style={styles.bannerTitle}>You're at the cheapest store 🎉</Text>
        <Text style={styles.bannerText}>{best.store} has the lowest price: {money(best.total)}</Text>
      </View>
    );
  }
  if (currentStore && here) {
    const diff = here.total - best.total;
    return (
      <Pressable style={[styles.banner, styles.bannerDeal]} onPress={onProof}>
        <Text style={styles.bannerTitle}>Ask {currentStore} to price match — save {money(diff)}</Text>
        <Text style={styles.bannerText}>
          {best.store}: {money(best.total)} vs. {here.store}: {money(here.total)}
        </Text>
        <Text style={styles.bannerCta}>Tap to show the cashier →</Text>
      </Pressable>
    );
  }
  return (
    <Pressable style={[styles.banner, styles.bannerDeal]} onPress={onProof}>
      <Text style={styles.bannerTitle}>Cheapest: {money(best.total)} at {best.store}</Text>
      {currentStore && <Text style={styles.bannerText}>No {currentStore} price found online for this item.</Text>}
      <Text style={styles.bannerCta}>Tap to show the cashier →</Text>
    </Pressable>
  );
}

function OfferRow({ offer, rank, savings, isHere, onPress, onProof }: {
  offer: Offer; rank: number; savings: number; isHere: boolean; onPress: () => void; onProof: () => void;
}) {
  return (
    <Pressable style={[styles.row, rank === 1 && styles.rowBest, isHere && styles.rowHere]} onPress={onPress} onLongPress={onProof}>
      {offer.thumbnail ? (
        <Image source={{ uri: offer.thumbnail }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}><Text style={styles.rank}>#{rank}</Text></View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.store}>
          {offer.store}{isHere ? "  · you're here" : ""}
        </Text>
        <Text style={styles.offerTitle} numberOfLines={2}>{offer.title}</Text>
        <Text style={styles.meta}>
          {offer.shipping === 0 ? "Free shipping" : offer.shipping == null ? "Shipping unknown" : `+${money(offer.shipping)} shipping`}
          {offer.rating ? `  ·  ★ ${offer.rating.toFixed(1)}` : ""}
          {offer.condition ? `  ·  ${offer.condition}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.price, rank === 1 && styles.priceBest]}>{money(offer.total)}</Text>
        {rank === 1 && <Text style={styles.bestTag}>LOWEST</Text>}
        {rank === 1 && savings >= 0.01 && <Text style={styles.save}>save up to {money(savings)}</Text>}
      </View>
    </Pressable>
  );
}

function ProofModal({ offer, fetchedAt, onClose }: { offer: Offer | null; fetchedAt?: string; onClose: () => void }) {
  return (
    <Modal visible={!!offer} animationType="slide" onRequestClose={onClose}>
      {offer && (
        <View style={styles.proof}>
          <Text style={styles.proofLabel}>Price match request</Text>
          <Text style={styles.proofStore}>{offer.store}</Text>
          <Text style={styles.proofPrice}>{money(offer.price)}</Text>
          {offer.shipping ? <Text style={styles.proofMeta}>+ {money(offer.shipping)} shipping</Text> : null}
          <Text style={styles.proofTitle}>{offer.title}</Text>
          {fetchedAt && <Text style={styles.proofMeta}>Price checked {new Date(fetchedAt).toLocaleString()}</Text>}
          {offer.url && (
            <Pressable style={styles.proofBtn} onPress={() => WebBrowser.openBrowserAsync(offer.url!)}>
              <Text style={styles.proofBtnText}>Open the listing</Text>
            </Pressable>
          )}
          <Pressable style={[styles.proofBtn, styles.proofBtnSecondary]} onPress={onClose}>
            <Text style={[styles.proofBtnText, { color: "#1b1f24" }]}>Done</Text>
          </Pressable>
        </View>
      )}
    </Modal>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Switch value={value} onValueChange={onChange} />
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

const GREEN = "#0a7d38";
const BLUE = "#1a5fd0";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f5f7", paddingTop: Constants.statusBarHeight + 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "800", color: "#1b1f24" },
  demoTag: { fontSize: 11, fontWeight: "700", color: "#9a5b00", backgroundColor: "#fff1d6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  search: { flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, borderWidth: 1, borderColor: "#dde0e5", color: "#1b1f24" },
  searchBtn: { backgroundColor: BLUE, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#5b616b", marginTop: 14, marginBottom: 6, paddingHorizontal: 16 },
  chipRow: { flexGrow: 0 },
  chip: { backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#dde0e5" },
  chipActive: { backgroundColor: BLUE, borderColor: BLUE },
  chipText: { color: "#1b1f24", fontSize: 14 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  recents: { marginTop: 8 },
  recentsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 16 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 },
  link: { color: BLUE, fontWeight: "600", marginTop: 8 },
  error: { color: "#b3261e", padding: 16, fontSize: 15 },
  empty: { color: "#5b616b", textAlign: "center", marginTop: 24 },
  toggles: { flexDirection: "row", gap: 16 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  banner: { borderRadius: 14, padding: 14, gap: 4 },
  bannerDeal: { backgroundColor: "#e3f4e9" },
  bannerGood: { backgroundColor: "#e6eefc" },
  bannerTitle: { fontSize: 17, fontWeight: "800", color: "#1b1f24" },
  bannerText: { fontSize: 14, color: "#30363d" },
  bannerCta: { fontSize: 14, fontWeight: "700", color: GREEN, marginTop: 4 },
  row: { flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  rowBest: { borderColor: GREEN },
  rowHere: { backgroundColor: "#f0f5ff" },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: "#eef0f3" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  rank: { fontWeight: "700", color: "#5b616b" },
  store: { fontSize: 15, fontWeight: "700", color: "#1b1f24" },
  offerTitle: { fontSize: 13, color: "#30363d", marginTop: 2 },
  meta: { fontSize: 12, color: "#5b616b", marginTop: 3 },
  price: { fontSize: 18, fontWeight: "800", color: "#1b1f24" },
  priceBest: { color: GREEN },
  bestTag: { fontSize: 10, fontWeight: "800", color: "#fff", backgroundColor: GREEN, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, overflow: "hidden" },
  save: { fontSize: 11, color: GREEN, marginTop: 3 },
  proof: { flex: 1, padding: 28, paddingTop: Constants.statusBarHeight + 40, alignItems: "center", gap: 10, backgroundColor: "#fff" },
  proofLabel: { fontSize: 14, fontWeight: "700", color: "#5b616b", textTransform: "uppercase", letterSpacing: 1 },
  proofStore: { fontSize: 34, fontWeight: "800", color: "#1b1f24", textAlign: "center" },
  proofPrice: { fontSize: 64, fontWeight: "900", color: GREEN },
  proofTitle: { fontSize: 17, color: "#30363d", textAlign: "center", marginTop: 8 },
  proofMeta: { fontSize: 14, color: "#5b616b" },
  proofBtn: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 14, alignSelf: "stretch", alignItems: "center", marginTop: 12 },
  proofBtnSecondary: { backgroundColor: "#eef0f3", marginTop: 0 },
  proofBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
});
