"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import "./store.css";

import { buildCatalogSearch, type CatalogItem as Item } from "../lib/catalog-search";
import { FeaturedProducts } from "./FeaturedProducts";
import { CatalogList } from "./CatalogList";
import { BudgetFilter } from "./BudgetFilter";
const community = "https://discord.gg/pixaro";
const money = (n: number) => "NT$" + n.toLocaleString("zh-TW");

export default function Store({preview=false}:{preview?:boolean}) {
  const [items, setItems] = useState<Item[]>([]);
  const [state, setState] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const [game, setGame] = useState("");
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [onlyFav, setOnlyFav] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(preview?"pixaro:preview-favorites":"pixaro:favorites") ?? "[]");
      if (Array.isArray(stored)) setFavorites(stored.filter(Number.isSafeInteger));
    } catch {}
  }, [preview]);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetch("/api/catalog", { cache: "no-store", signal: controller.signal })
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(rows => { if (!controller.signal.aborted) { setItems(rows); setState("ready"); } })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  function toggle(id: number) {
    const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem(preview?"pixaro:preview-favorites":"pixaro:favorites", JSON.stringify(next)); } catch {}
  }
  const games = [...new Set(items.map(p => p.game))];
  const search = useMemo(() => buildCatalogSearch(items), [items]);
  const matches = useMemo(() => search(query), [search, query]);
  const highest = items.reduce((max, p) => Math.max(max, p.price), 0);
  const shown = matches.filter(p => (!game || p.game === game) &&
    (!onlyFav || favorites.includes(p.id)) && (budget === null || p.price <= budget));
  const featured = shown.filter(p => p.featured);
  const filtering = Boolean(query.trim() || game || onlyFav || budget !== null);
  function openProduct(item: Item) {
    setCopyStatus("");
    setSelected(item);
  }
  function resetFilters() {
    setGame("");
    setQuery("");
    setBudget(null);
    setOnlyFav(false);
  }
  const inquiry = selected ? [selected.game, selected.name, selected.amount, money(selected.price), "商品 #" + selected.id].filter(Boolean).join(" ｜ ") : "";
  return <div className="pxShop">
    <header><a className="pxBrand" href="/"><img src="/favicon.svg" alt=""/>PIXARO</a><a href="#catalog">遊戲商品</a><a href="/membership">會員護照</a><input type="search" aria-label="搜尋商品" placeholder="搜尋商品、遊戲或面額" value={query} onChange={e=>setQuery(e.target.value)}/><button aria-pressed={onlyFav} onClick={()=>setOnlyFav(!onlyFav)}>♡ 收藏 {favorites.length}</button><a className="pxDiscord" href={community}>Discord 社群 ↗</a></header>
    <div className="pxBody"><aside aria-label="商品篩選"><div className="pxGames"><h2>遊戲分類</h2>{["", ...games].map(g=><button key={g} aria-pressed={game===g} onClick={()=>setGame(g)}>{g || "所有遊戲"}</button>)}</div>{highest > 0 && <BudgetFilter highest={highest} limit={budget} onChange={setBudget}/>}</aside>
    <main>
    {!filtering && <FeaturedProducts items={featured} onSelect={openProduct}/>}
    <section id="catalog"><div className="pxSectionHeading"><h2>{onlyFav ? "我的收藏" : "商品目錄"}</h2><div className="pxResults">{state === "ready" && <span role="status">{shown.length} 件商品</span>}{filtering && <button onClick={resetFilters}>清除篩選</button>}</div></div>
    {state==="error" ? <p role="alert">目前無法取得最新價格。 <button onClick={()=>setAttempt(attempt+1)}>重新載入</button></p> : state==="loading" ? <p role="status">讀取商品中…</p> : !shown.length ? <p>{onlyFav ? "目前沒有符合條件的收藏商品。" : "沒有符合條件的上架商品。"}</p> :
    <CatalogList items={shown} favorites={favorites} onSelect={openProduct} onFavorite={toggle}/>}</section>
    <footer>PIXARO <a href="/manage">商品管理</a></footer></main></div>
    <dialog ref={dialog} aria-labelledby="pxTitle" onClose={()=>setSelected(null)}>{selected && <><button className="pxClose" aria-label="關閉" onClick={()=>dialog.current?.close()}>×</button><small>{selected.game} · {selected.kind}</small><h2 id="pxTitle">{selected.name}</h2><p>{selected.amount}</p><strong>{money(selected.price)}</strong><p>複製商品資訊，貼到 Pixaro Discord 工單中詢價或下單。</p><textarea readOnly aria-label="商品資訊" value={inquiry}/><button onClick={async()=>{try{await navigator.clipboard.writeText(inquiry);setCopyStatus("已複製");}catch{setCopyStatus("請選取上方商品資訊並複製");}}}>複製商品資訊</button> <a className="pxDiscord" href={community} target="_blank" rel="noreferrer">前往 Discord ↗</a><p role="status">{copyStatus}</p></>}</dialog>
  </div>;
}
