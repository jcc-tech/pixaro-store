"use client";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState } from "react";
import type { CatalogItem } from "../lib/catalog-search";

export function FeaturedProducts({ items, onSelect }: {
  items: CatalogItem[];
  onSelect: (item: CatalogItem) => void;
}) {
  const [viewport, carousel] = useEmblaCarousel({ align: "start", loop: items.length > 1 });
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!carousel) return;
    const update = () => setIndex(carousel.selectedScrollSnap());
    update();
    carousel.on("select", update).on("reInit", update);
    return () => { carousel.off("select", update).off("reInit", update); };
  }, [carousel]);

  if (!items.length) return <section className="pxHero pxHeroEmpty">
    <h1>Pixaro 遊戲商城</h1><a href="#catalog">瀏覽商品目錄</a>
  </section>;

  return <section className="pxHero" aria-labelledby="feature-title">
    <div className="pxHeroPanel">
      <h1 id="feature-title">本週主打</h1>
      <div className="pxHeroViewport" ref={viewport}><div className="pxHeroRail">
        {items.map((item, position) => <div key={item.id} className="pxHeroSlide" aria-hidden={position !== index}>
          <p className="pxHeroMeta">{item.game} · {item.kind}</p>
          <h2>{item.name}</h2>
          {item.amount && <p className="pxHeroSpec">{item.amount}</p>}
          <div className="pxHeroOffer"><strong>NT${item.price.toLocaleString("zh-TW")}</strong>
            <button tabIndex={position === index ? 0 : -1} onClick={() => onSelect(item)}>查看商品</button>
          </div>
        </div>)}
      </div></div>
      {items.length > 1 && <div className="pxHeroPager">
        <button aria-label="上一件主打商品" onClick={() => carousel?.scrollPrev()}>‹</button>
        <span aria-live="polite">{String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span>
        <button aria-label="下一件主打商品" onClick={() => carousel?.scrollNext()}>›</button>
      </div>}
    </div>
    <div className="pxHeroScene" aria-hidden="true">
      {items[index]?.image && <img src={items[index].image!} alt=""/>}
    </div>
  </section>;
}
