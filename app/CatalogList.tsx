import type { CatalogItem } from "../lib/catalog-search";

export function CatalogList({ items, favorites, onSelect, onFavorite }: {
  items: CatalogItem[];
  favorites: number[];
  onSelect: (item: CatalogItem) => void;
  onFavorite: (id: number) => void;
}) {
  const groups = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const group = groups.get(item.game);
    if (group) group.push(item);
    else groups.set(item.game, [item]);
  }

  return <div className="pxDirectory">{Array.from(groups, ([game, group]) =>
    <section className="pxGroup" key={game} aria-label={game}>
      <div className="pxGroupHead"><h3>{game}</h3><span>{group.length} 件</span></div>
      <ul>{group.map(item => <li className="pxEntry" key={item.id}>
        <button className="pxProductRow" onClick={() => onSelect(item)}>
          <span className="pxProductName">{item.image && <img src={item.image} alt="" loading="lazy" width="36" height="36"/>}<b>{item.name}</b></span>
          <span className="pxProductSpec">{item.amount}</span>
          <strong className="pxPrice">NT${item.price.toLocaleString("zh-TW")}</strong>
        </button>
        <button className="pxHeart" aria-label={`收藏 ${item.name}`} aria-pressed={favorites.includes(item.id)} onClick={() => onFavorite(item.id)}>
          {favorites.includes(item.id) ? "♥" : "♡"}
        </button>
      </li>)}</ul>
    </section>)}</div>;
}
