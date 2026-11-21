import Fuse from "fuse.js";

export type CatalogItem = {
  id: number;
  name: string;
  game: string;
  kind: string;
  amount: string;
  price: number;
  image: string | null;
  featured: boolean;
};

const aliases: Record<string, string> = {
  rivals: "競爭者",
  "blox fruits": "水果",
};

function normalize(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/(\d),(?=\d{3}\b)/g, "$1").trim();
}

export function buildCatalogSearch(items: CatalogItem[]) {
  const entries = items.map(item => ({
    item,
    name: normalize(item.name),
    game: normalize(item.game),
    alias: aliases[normalize(item.game)] ?? "",
    amount: normalize(item.amount),
    kind: normalize(item.kind),
  }));
  const index = new Fuse(entries, {
    keys: ["name", "game", "alias", "amount", "kind"],
    threshold: 0.36,
    ignoreLocation: true,
    includeScore: true,
  });
  return (query: string) => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return items;
    const scores = terms.map(term => {
      const matches = new Map<number, number>();
      // Keep amounts and short CJK terms exact. Allow misspellings in longer English names.
      if (/^[a-z]{3,}$/.test(term)) {
        for (const hit of index.search(term)) matches.set(hit.item.item.id, 1 + (hit.score ?? 1));
      }
      for (const entry of entries) {
        const fields = [entry.name, entry.game, entry.alias, entry.amount, entry.kind];
        if (fields.some(field => field.includes(term))) matches.set(entry.item.id, fields.includes(term) ? 0 : 0.25);
      }
      return matches;
    });
    return items.filter(item => scores.every(matches => matches.has(item.id)))
      .map(item => ({ item, rank: scores.reduce((total, matches) => total + matches.get(item.id)!, 0) }))
      .sort((a, b) => a.rank - b.rank).map(result => result.item);
  };
}
