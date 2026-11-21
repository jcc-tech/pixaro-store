"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PRODUCTS,
  PRODUCT_KINDS,
  type Product,
  type ProductKind,
} from "../../lib/products";

type SyncState = "loading" | "ready" | "local";
type SortMode = "recommended" | "price-asc" | "price-desc" | "unit";
type EditorState = Omit<Product, "id" | "updatedAt"> & { id?: number };
type DeleteRequest = { products: Product[]; source: "row" | "editor" | "selection" };
const ADD_TYPE_VALUE = "__add_product_type__";
const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_BYTES = 2 * 1024 * 1024;
const VALID_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const fallbackProducts: Product[] = DEFAULT_PRODUCTS.map((product, index) => ({
  ...product,
  id: index + 1,
  updatedAt: "2026-08-13 22:00",
}));

const newProduct: EditorState = {
  name: "",
  kind: "遊戲商品",
  category: "Roblox",
  game: "Roblox",
  amountLabel: "",
  robuxAmount: null,
  price: 0,
  note: "",
  status: "上架",
  featured: false,
  sortOrder: 999,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUnitPrice(product: Product) {
  if (!product.robuxAmount) return "—";
  return `${(product.price / product.robuxAmount).toFixed(3)} / R`;
}

function productImageUrl(product: Product) {
  return `/api/product-images/${product.id}?v=${encodeURIComponent(product.updatedAt)}`;
}

async function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

async function optimizeProductImage(file: File) {
  if (!VALID_IMAGE_TYPES.has(file.type)) throw new Error("圖片僅支援 JPG、PNG 或 WebP");
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("原始圖片不可超過 10 MB");

  const bitmap = await createImageBitmap(file);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("瀏覽器無法處理這張圖片");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let optimized: Blob | null = null;
  for (const quality of [0.86, 0.76, 0.66]) {
    optimized = await canvasBlob(canvas, quality);
    if (optimized && optimized.size <= MAX_UPLOAD_IMAGE_BYTES) break;
  }
  if (!optimized || optimized.size > MAX_UPLOAD_IMAGE_BYTES) {
    throw new Error("圖片壓縮後仍超過 2 MB，請選擇較小的圖片");
  }

  return new File([optimized], `product-${Date.now()}.webp`, { type: "image/webp" });
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [productKinds, setProductKinds] = useState<string[]>([...PRODUCT_KINDS]);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [query, setQuery] = useState("");
  const [activeKind, setActiveKind] = useState<string>("全部");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetKind, setMoveTargetKind] = useState("");
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [typeEditorOpen, setTypeEditorOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [typeError, setTypeError] = useState("");
  const [savingType, setSavingType] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [deleteTypeTarget, setDeleteTypeTarget] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeProductImage, setRemoveProductImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [lastProductTemplate, setLastProductTemplate] = useState<EditorState | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/products", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("price data unavailable");
        return (await response.json()) as { products: Product[]; productTypes?: string[] };
      })
      .then((data) => {
        if (!active) return;
        setProducts(data.products);
        if (data.productTypes?.length) setProductKinds(data.productTypes);
        setSyncState("ready");
      })
      .catch(() => {
        if (!active) return;
        setSyncState("local");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-TW");
    const rows = products.filter((product) => {
      const matchesKind = activeKind === "全部" || product.kind === activeKind;
      const searchable = [
        product.name,
        product.category,
        product.game,
        product.amountLabel,
        product.note,
      ]
        .join(" ")
        .toLocaleLowerCase("zh-TW");
      return matchesKind && (!normalizedQuery || searchable.includes(normalizedQuery));
    });

    return [...rows].sort((a, b) => {
      if (sortMode === "price-asc") return a.price - b.price;
      if (sortMode === "price-desc") return b.price - a.price;
      if (sortMode === "unit") {
        const aUnit = a.robuxAmount ? a.price / a.robuxAmount : Number.MAX_VALUE;
        const bUnit = b.robuxAmount ? b.price / b.robuxAmount : Number.MAX_VALUE;
        return aUnit - bUnit;
      }
      return Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder;
    });
  }, [activeKind, products, query, sortMode]);

  const selectedProducts = useMemo(
    () => selectedIds.map((id) => products.find((product) => product.id === id)).filter(Boolean) as Product[],
    [products, selectedIds],
  );
  const previousProduct = useMemo<EditorState | Product | null>(() => {
    if (lastProductTemplate) return lastProductTemplate;
    return products.reduce<Product | null>(
      (latest, product) => (!latest || product.id > latest.id ? product : latest),
      null,
    );
  }, [lastProductTemplate, products]);
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.includes(product.id));
  const compareAllowed = selectedProducts.length >= 2 && selectedProducts.length <= 3;
  const movableProducts = selectedProducts.filter((product) => product.kind !== moveTargetKind);
  const canManageProducts = true;

  const activeCount = products.filter((product) => product.status === "上架").length;
  const lowestTopup = products
    .filter((product) => product.kind === "代儲" && product.robuxAmount)
    .sort((a, b) => a.price / (a.robuxAmount || 1) - b.price / (b.robuxAmount || 1))[0];
  const lastUpdated = products
    .map((product) => product.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  function toggleProductSelection(id: number) {
    setNotice("");
    setSelectedIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      if (next.length < 2 || next.length > 3) setCompareOpen(false);
      return next;
    });
  }

  function toggleAllVisible() {
    const visibleIds = visibleProducts.map((product) => product.id);
    setSelectedIds((current) => {
      const next = allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])];
      if (next.length < 2 || next.length > 3) setCompareOpen(false);
      return next;
    });
  }

  function openMoveProducts() {
    const preferredKind = productKinds.includes("贈禮") ? "贈禮" : productKinds[0] || "";
    setMoveTargetKind(preferredKind);
    setMoveError("");
    setMoveOpen(true);
  }

  async function toggleProductStatus(product: Product) {
    const status = product.status === "上架" ? "暫停" : "上架";
    setNotice("");
    try {
      const response = await fetch("/api/products/status", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: product.id, status }),
      });
      const data = (await response.json()) as { product?: Product; error?: string };
      if (!response.ok || !data.product) throw new Error(data.error || "狀態更新失敗");
      setProducts((current) => current.map((item) => item.id === product.id ? data.product! : item));
      setNotice(`「${product.name}」已${status === "上架" ? "上架" : "暫停"}`);
      setSyncState("ready");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "狀態更新失敗");
    }
  }

  async function moveSelectedProducts() {
    if (!moveTargetKind || movableProducts.length === 0 || moving) return;
    setMoving(true);
    setMoveError("");
    try {
      const response = await fetch("/api/products", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: movableProducts.map((product) => product.id), kind: moveTargetKind }),
      });
      const data = (await response.json()) as { products?: Product[]; error?: string };
      if (!response.ok || !data.products) throw new Error(data.error || "移動商品失敗");

      const movedById = new Map(data.products.map((product) => [product.id, product]));
      setProducts((current) => current.map((product) => movedById.get(product.id) || product));
      setSelectedIds([]);
      setCompareOpen(false);
      setMoveOpen(false);
      setSyncState("ready");
      setNotice(`已將 ${data.products.length} 項商品移動到「${moveTargetKind}」`);
    } catch (error) {
      setMoveError(error instanceof Error ? error.message : "移動商品失敗，請稍後再試");
    } finally {
      setMoving(false);
    }
  }

  function openEditor(product?: Product) {
    setNotice("");
    setImageFile(null);
    setRemoveProductImage(false);
    setImageError("");
    setImagePreview(product?.imageKey ? productImageUrl(product) : "");
    setEditor(product ? { ...product } : { ...newProduct });
  }

  function productTemplate(source: EditorState | Product): EditorState {
    return {
      name: source.name,
      kind: source.kind,
      category: source.category,
      game: source.game,
      amountLabel: source.amountLabel,
      robuxAmount: source.robuxAmount,
      price: source.price,
      note: source.note,
      status: source.status,
      featured: source.featured,
      sortOrder: source.sortOrder,
    };
  }

  function copyPreviousProduct() {
    if (!editor || editor.id || !previousProduct) return;
    setEditor(productTemplate(previousProduct));
    setImageFile(null);
    setImagePreview("");
    setRemoveProductImage(false);
    setImageError("");
  }

  function closeEditor() {
    setEditor(null);
    setImageFile(null);
    setImagePreview("");
    setRemoveProductImage(false);
    setImageError("");
  }

  async function selectProductImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImageError("");
    try {
      const optimized = await optimizeProductImage(file);
      setImageFile(optimized);
      setImagePreview(URL.createObjectURL(optimized));
      setRemoveProductImage(false);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "圖片處理失敗");
    }
  }

  function clearProductImage() {
    setImageFile(null);
    setImagePreview("");
    setRemoveProductImage(Boolean(editor?.id && editor.imageKey));
    setImageError("");
  }

  function openTypeEditor() {
    setNewTypeName("");
    setTypeError("");
    setEditingType(null);
    setEditingTypeName("");
    setDeleteTypeTarget(null);
    setTypeEditorOpen(true);
  }

  function closeTypeEditor() {
    if (savingType) return;
    setTypeEditorOpen(false);
    setEditingType(null);
    setDeleteTypeTarget(null);
    setTypeError("");
  }

  async function saveProductType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newTypeName.trim();
    if (!name || savingType) return;
    setSavingType(true);
    setTypeError("");

    try {
      const response = await fetch("/api/product-types", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { productType?: { name: string }; error?: string };
      if (!response.ok || !data.productType) throw new Error(data.error || "新增類型失敗");

      const createdName = data.productType.name;
      setProductKinds((current) => current.includes(createdName) ? current : [...current, createdName]);
      if (editor) setEditor({ ...editor, kind: createdName });
      else setActiveKind(createdName);
      setTypeEditorOpen(false);
      setNewTypeName("");
      setSyncState("ready");
      setNotice(`已新增商品類型「${createdName}」`);
    } catch (error) {
      setTypeError(error instanceof Error ? error.message : "新增類型失敗，請稍後再試");
    } finally {
      setSavingType(false);
    }
  }

  function startEditingType(kind: string) {
    setEditingType(kind);
    setEditingTypeName(kind);
    setDeleteTypeTarget(null);
    setTypeError("");
  }

  async function renameProductType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const originalName = editingType;
    const name = editingTypeName.trim();
    if (!originalName || !name || savingType) return;
    setSavingType(true);
    setTypeError("");

    try {
      const response = await fetch("/api/product-types", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ originalName, name }),
      });
      const data = (await response.json()) as { productType?: { name: string }; updatedProducts?: number; error?: string };
      if (!response.ok || !data.productType) throw new Error(data.error || "修改類型失敗");

      const renamedTo = data.productType.name;
      setProductKinds((current) => current.map((kind) => kind === originalName ? renamedTo : kind));
      setProducts((current) => current.map((product) => product.kind === originalName ? { ...product, kind: renamedTo } : product));
      setActiveKind((current) => current === originalName ? renamedTo : current);
      if (editor?.kind === originalName) setEditor({ ...editor, kind: renamedTo });
      setEditingType(null);
      setEditingTypeName("");
      setSyncState("ready");
      setNotice(`已將「${originalName}」修改為「${renamedTo}」${data.updatedProducts ? `，並更新 ${data.updatedProducts} 項商品` : ""}`);
    } catch (error) {
      setTypeError(error instanceof Error ? error.message : "修改類型失敗，請稍後再試");
    } finally {
      setSavingType(false);
    }
  }

  async function deleteProductType(kind: string) {
    if (savingType) return;
    if (deleteTypeTarget !== kind) {
      setDeleteTypeTarget(kind);
      setEditingType(null);
      setTypeError("");
      return;
    }

    setSavingType(true);
    setTypeError("");
    try {
      const response = await fetch("/api/product-types", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: kind }),
      });
      const data = (await response.json()) as { deletedType?: { name: string }; error?: string };
      if (!response.ok || !data.deletedType) throw new Error(data.error || "刪除類型失敗");

      setProductKinds((current) => current.filter((item) => item !== kind));
      if (activeKind === kind) setActiveKind("全部");
      setDeleteTypeTarget(null);
      setSyncState("ready");
      setNotice(`已刪除商品類型「${kind}」`);
    } catch (error) {
      setTypeError(error instanceof Error ? error.message : "刪除類型失敗，請稍後再試");
    } finally {
      setSavingType(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !editor.name.trim() || editor.price < 0) return;
    setSaving(true);
    setNotice("");

    const method = editor.id ? "PATCH" : "POST";
    try {
      const response = await fetch("/api/products", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editor),
      });
      if (!response.ok) throw new Error("save failed");
      const data = (await response.json()) as { product: Product };
      let savedProduct = data.product;
      let imageWarning = false;

      try {
        if (imageFile) {
          const formData = new FormData();
          formData.set("productId", String(savedProduct.id));
          formData.set("image", imageFile);
          const imageResponse = await fetch("/api/product-images", { method: "POST", body: formData });
          const imageData = (await imageResponse.json()) as { product?: Product; error?: string };
          if (!imageResponse.ok || !imageData.product) throw new Error(imageData.error || "圖片上傳失敗");
          savedProduct = imageData.product;
        } else if (removeProductImage && savedProduct.imageKey) {
          const imageResponse = await fetch("/api/product-images", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ productId: savedProduct.id }),
          });
          const imageData = (await imageResponse.json()) as { product?: Product; error?: string };
          if (!imageResponse.ok || !imageData.product) throw new Error(imageData.error || "圖片移除失敗");
          savedProduct = imageData.product;
        }
      } catch {
        imageWarning = true;
      }

      setProducts((current) =>
        editor.id
          ? current.map((product) => (product.id === savedProduct.id ? savedProduct : product))
          : [...current, savedProduct],
      );
      if (!editor.id) setLastProductTemplate(productTemplate(savedProduct));
      const imageChanged = Boolean(imageFile || removeProductImage);
      setNotice(
        imageWarning
          ? "商品資料已保存，但圖片未能保存，請重新編輯後再試"
          : editor.id
            ? imageChanged ? "商品與圖片已更新並同步保存" : "商品已更新並同步保存"
            : imageChanged ? "商品與圖片已新增並同步保存" : "商品已新增並同步保存",
      );
      closeEditor();
      setSyncState("ready");
    } catch {
      const now = new Date().toISOString().slice(0, 16).replace("T", " ");
      const localProduct: Product = {
        ...editor,
        id: editor.id ?? Math.max(0, ...products.map((product) => product.id)) + 1,
        updatedAt: now,
      };
      setProducts((current) =>
        editor.id
          ? current.map((product) => (product.id === editor.id ? localProduct : product))
          : [...current, localProduct],
      );
      if (!editor.id) setLastProductTemplate(productTemplate(localProduct));
      setSyncState("local");
      setNotice("已套用本次更新；連線恢復後可重新同步");
      closeEditor();
    } finally {
      setSaving(false);
    }
  }

  function askToDelete(targets: Product[], source: DeleteRequest["source"]) {
    if (targets.length === 0) return;
    setNotice("");
    setDeleteRequest({ products: targets, source });
  }

  async function confirmDelete() {
    if (!deleteRequest || deleting) return;
    setDeleting(true);
    const ids = deleteRequest.products.map((product) => product.id);

    try {
      const response = await fetch("/api/products", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("delete failed");
      const data = (await response.json()) as { deletedIds: number[] };
      if (data.deletedIds.length === 0) throw new Error("no products deleted");
      const deletedIds = new Set(data.deletedIds);
      setProducts((current) => current.filter((product) => !deletedIds.has(product.id)));
      setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
      setCompareOpen(false);
      closeEditor();
      setDeleteRequest(null);
      setSyncState("ready");
      setNotice(
        data.deletedIds.length === ids.length
          ? data.deletedIds.length > 1
            ? `已刪除 ${data.deletedIds.length} 項商品`
            : "商品已刪除"
          : `已刪除 ${data.deletedIds.length} 項；其餘商品可能已被移除`,
      );
    } catch {
      setDeleteRequest(null);
      setNotice("刪除失敗，資料沒有變動，請稍後再試");
    } finally {
      setDeleting(false);
    }
  }

  async function exportBackup() {
    if (exporting) return;
    setExporting(true);
    setNotice("");
    try {
      const response = await fetch("/api/export", { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `pixaro-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice("完整備份已下載；網站原有資料沒有變動");
    } catch {
      setNotice("備份匯出失敗，網站資料沒有變動，請稍後再試");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Pixaro 價格管理中心首頁">
          <span className="brand-mark">P</span>
          <span>
            <strong>PIXARO</strong>
            <small>PRICE DESK</small>
          </span>
        </a>
        <div className="topbar-actions"><a href="/manage/members" className="employee-button">會員消費登錄</a>
          <span className={`sync-pill ${syncState}`}>
            <i />
            {syncState === "loading" ? "同步中" : syncState === "ready" ? "已同步" : "本機模式"}
          </span>
          <button className="export-button" type="button" disabled={exporting} onClick={exportBackup}>
            <span aria-hidden="true">↓</span> {exporting ? "整理備份中…" : "匯出備份"}
          </button>
          {canManageProducts && <button className="primary-button" type="button" onClick={() => openEditor()}><span aria-hidden="true">＋</span> 新增商品</button>}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> ROBLOX COMMERCE CONTROL</p>
          <h1>每一個價格，<br /><em>都在同一個地方。</em></h1>
          <p className="hero-description">
            管理 Roblox 代儲、贈禮與熱門遊戲商品。快速找到售價、比較成本，直接更新後立即保存。
          </p>
        </div>
        <div className="summary-grid" aria-label="價格資料摘要">
          <article>
            <span>上架品項</span>
            <strong>{activeCount}</strong>
            <small>共 {products.length} 筆資料</small>
          </article>
          <article>
            <span>最佳代儲單價</span>
            <strong>{lowestTopup ? `${(lowestTopup.price / (lowestTopup.robuxAmount || 1)).toFixed(3)}` : "—"}</strong>
            <small>NT$ / Robux</small>
          </article>
          <article>
            <span>最近更新</span>
            <strong className="date-value">{lastUpdated ? lastUpdated.slice(5, 10).replace("-", "/") : "—"}</strong>
            <small>{syncState === "ready" ? "雲端資料已同步" : "正在顯示可用資料"}</small>
          </article>
        </div>
      </section>

      <section className="catalog" aria-labelledby="catalog-title">
        <div className="catalog-heading">
          <div>
            <p className="section-kicker">商品資料庫</p>
            <h2 id="catalog-title">價格查詢與管理</h2>
          </div>
          <p>目前顯示 <strong>{visibleProducts.length}</strong> 項</p>
        </div>

        <div className="toolbar">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋遊戲、商品、面額…"
              aria-label="搜尋商品"
            />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="清除搜尋">×</button>}
          </label>
          <div className="kind-tabs" role="tablist" aria-label="商品分類">
            {["全部", ...productKinds].map((kind) => (
              <button
                key={kind}
                type="button"
                className={activeKind === kind ? "active" : ""}
                onClick={() => setActiveKind(kind)}
                role="tab"
                aria-selected={activeKind === kind}
              >
                {kind}
                <span>{kind === "全部" ? products.length : products.filter((product) => product.kind === kind).length}</span>
              </button>
            ))}
            {canManageProducts && <button
              className="inline-add-button"
              type="button"
              onClick={openTypeEditor}
              aria-label="管理商品類型"
            >
              <span aria-hidden="true">⚙</span>
              管理類型
            </button>}
          </div>
          <label className="sort-field">
            <span>排序</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="recommended">推薦排序</option>
              <option value="price-asc">售價低至高</option>
              <option value="price-desc">售價高至低</option>
              <option value="unit">Robux 單價</option>
            </select>
          </label>
        </div>

        {notice && <div className="notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}

        <div className="product-list" role="table" aria-label="商品價格">
          <div className="product-row product-header" role="row">
            <span className="selection-header"><button type="button" onClick={toggleAllVisible}>{allVisibleSelected ? "取消" : "全選"}</button></span><span>商品</span><span>分類</span><span>面額 / 規格</span><span>售價</span><span>單價</span><span>狀態</span><span />
          </div>
          {visibleProducts.map((product) => (
            <div className={`product-row ${selectedIds.includes(product.id) ? "selected" : ""}`} role="row" key={product.id}>
              <div className="compare-cell" role="cell">
                <button
                  className="compare-check"
                  type="button"
                  aria-label={`${selectedIds.includes(product.id) ? "取消選取" : "選取"} ${product.name}`}
                  aria-pressed={selectedIds.includes(product.id)}
                  onClick={() => toggleProductSelection(product.id)}
                >
                  {selectedIds.includes(product.id) ? "✓" : "+"}
                </button>
              </div>
              <div className="product-name" role="cell">
                {product.imageKey
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img className="game-icon product-image" src={productImageUrl(product)} alt="" loading="lazy" />
                  : <span className={`game-icon game-${product.game.toLowerCase().replace(/\s/g, "-")}`}>{product.game.slice(0, 1)}</span>}
                <div>
                  <strong>{product.name}</strong>
                  <small>{product.game}{product.featured ? " · 本週精選" : ""}</small>
                </div>
              </div>
              <div role="cell"><span className={`kind-badge kind-${product.kind}`}>{product.kind}</span></div>
              <div className="amount-cell" role="cell">
                <strong>{product.amountLabel || "—"}</strong>
                {product.note && <small>{product.note}</small>}
              </div>
              <div className="price-cell" role="cell"><strong>{formatMoney(product.price)}</strong></div>
              <div className="unit-cell" role="cell">{formatUnitPrice(product)}</div>
              <div role="cell" className="status-cell">
                <span className={`status-badge ${product.status === "上架" ? "active" : "paused"}`}><i />{product.status}</span>
                {!canManageProducts && <button className="status-toggle-button" type="button" onClick={() => toggleProductStatus(product)}>{product.status === "上架" ? "設為暫停" : "重新上架"}</button>}
              </div>
              <div className="edit-cell row-actions" role="cell">
                {canManageProducts && <><button type="button" onClick={() => openEditor(product)} aria-label={`編輯 ${product.name}`}>編輯</button>
                <button className="row-delete-button" type="button" onClick={() => askToDelete([product], "row")} aria-label={`刪除 ${product.name}`}>刪除</button></>}
              </div>
            </div>
          ))}
          {visibleProducts.length === 0 && (
            <div className="empty-state">
              <span>⌕</span>
              <strong>找不到符合的商品</strong>
              <p>試著更換關鍵字或選擇其他分類。</p>
              <button type="button" onClick={() => { setQuery(""); setActiveKind("全部"); }}>清除篩選</button>
            </div>
          )}
        </div>
      </section>

      {selectedProducts.length > 0 && (
        <aside className={`compare-dock ${compareOpen ? "open" : ""}`} aria-label="批次操作">
          <div className="compare-dock-bar">
            <div>
              <span className="compare-icon">✓</span>
              <p><strong>批次操作</strong><small>已選 {selectedProducts.length} 項商品</small></p>
            </div>
            <div className="compare-mini-items">
              {selectedProducts.slice(0, 5).map((product) => <span key={product.id}>{product.name}<button type="button" onClick={() => toggleProductSelection(product.id)}>×</button></span>)}
              {selectedProducts.length > 5 && <span>另有 {selectedProducts.length - 5} 項</span>}
            </div>
            <div className="compare-actions">
              <button className="clear-button" type="button" onClick={() => { setSelectedIds([]); setCompareOpen(false); }}>清除</button>
              {canManageProducts && <button className="bulk-move-button" type="button" onClick={openMoveProducts}>移動類型</button>}
              {canManageProducts && <button className="bulk-delete-button" type="button" onClick={() => askToDelete(selectedProducts, "selection")}>刪除已選</button>}
              <button className="compare-button" type="button" disabled={!compareAllowed} title={compareAllowed ? "" : "快速比較需選取 2–3 項商品"} onClick={() => setCompareOpen((open) => !open)}>
                {compareOpen ? "收起比較" : compareAllowed ? "快速比較" : "比較限 2–3 項"}
              </button>
            </div>
          </div>
          {compareOpen && (
            <div className="compare-panel">
              <div className="compare-panel-heading"><div><p className="section-kicker">SIDE BY SIDE</p><h3>商品快速比較</h3></div><button type="button" onClick={() => setCompareOpen(false)}>×</button></div>
              <div className="compare-grid">
                {selectedProducts.map((product) => (
                  <article key={product.id}>
                    {product.imageKey && <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="compare-product-image" src={productImageUrl(product)} alt={`${product.name} 商品圖片`} loading="lazy" />
                    </>}
                    <span className="kind-badge">{product.kind}</span>
                    <h4>{product.name}</h4>
                    <p>{product.game} · {product.amountLabel}</p>
                    <div><small>售價</small><strong>{formatMoney(product.price)}</strong></div>
                    <div><small>Robux 單價</small><strong>{formatUnitPrice(product)}</strong></div>
                    {canManageProducts && <button type="button" onClick={() => openEditor(product)}>更新這項價格</button>}
                  </article>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}

      {moveOpen && canManageProducts && (
        <div className="modal-backdrop move-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !moving) setMoveOpen(false); }}>
          <section className="move-modal" role="dialog" aria-modal="true" aria-labelledby="move-title">
            <div className="modal-heading">
              <div><p className="section-kicker">MOVE PRODUCTS</p><h2 id="move-title">移動商品類型</h2></div>
              <button type="button" disabled={moving} onClick={() => setMoveOpen(false)} aria-label="關閉">×</button>
            </div>
            <p className="move-description">已選取 <strong>{selectedProducts.length}</strong> 項商品。選擇目標類型後，會一次完成移動。</p>
            <label className="move-kind-field">
              <span>移動到</span>
              <select value={moveTargetKind} onChange={(event) => { setMoveTargetKind(event.target.value); setMoveError(""); }}>
                {productKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </select>
            </label>
            <div className="move-summary">
              <strong>{movableProducts.length} 項將被移動</strong>
              {selectedProducts.length !== movableProducts.length && <span>{selectedProducts.length - movableProducts.length} 項已在「{moveTargetKind}」</span>}
              <ul>{movableProducts.slice(0, 6).map((product) => <li key={product.id}>{product.name}<span>{product.kind} → {moveTargetKind}</span></li>)}</ul>
              {movableProducts.length > 6 && <small>以及其他 {movableProducts.length - 6} 項商品</small>}
            </div>
            {moveError && <p className="field-error" role="alert">{moveError}</p>}
            <div className="modal-actions">
              <button className="secondary-button" type="button" disabled={moving} onClick={() => setMoveOpen(false)}>取消</button>
              <button className="primary-button" type="button" disabled={moving || movableProducts.length === 0} onClick={moveSelectedProducts}>{moving ? "移動中…" : `確認移動 ${movableProducts.length} 項`}</button>
            </div>
          </section>
        </div>
      )}

      {editor && canManageProducts && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) closeEditor(); }}>
          <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
            <div className="modal-heading">
              <div><p className="section-kicker">PRICE EDITOR</p><h2 id="editor-title">{editor.id ? "更新商品價格" : "新增商品"}</h2></div>
              <button type="button" disabled={saving} onClick={closeEditor} aria-label="關閉">×</button>
            </div>
            {!editor.id && previousProduct && (
              <div className="copy-previous-bar">
                <div>
                  <span>前一品項</span>
                  <strong>{previousProduct.name}</strong>
                  <small>複製文字與商品設定，圖片不會重複建立</small>
                </div>
                <button type="button" disabled={saving} onClick={copyPreviousProduct}>複製前一品項</button>
              </div>
            )}
            <form onSubmit={saveProduct}>
              <div className="form-grid">
                <label className="field-wide"><span>商品名稱</span><input required value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder="例如：4999R 鑰匙組合包" /></label>
                <label><span>商品類型</span><select value={editor.kind} onChange={(event) => {
                  if (event.target.value === ADD_TYPE_VALUE) {
                    openTypeEditor();
                    return;
                  }
                  setEditor({ ...editor, kind: event.target.value as ProductKind });
                }}>{productKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}<option value={ADD_TYPE_VALUE}>＋ 新增商品類型…</option></select></label>
                <label><span>遊戲</span><input required value={editor.game} onChange={(event) => setEditor({ ...editor, game: event.target.value })} /></label>
                <label><span>分類名稱</span><input required value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })} /></label>
                <label><span>面額 / 規格</span><input value={editor.amountLabel} onChange={(event) => setEditor({ ...editor, amountLabel: event.target.value })} placeholder="例如：4999 Robux" /></label>
                <label><span>Robux 數量（選填）</span><input min="0" inputMode="numeric" type="number" value={editor.robuxAmount ?? ""} onChange={(event) => setEditor({ ...editor, robuxAmount: event.target.value ? Number(event.target.value) : null })} /></label>
                <label><span>售價（NT$）</span><input required min="0" inputMode="numeric" type="number" value={editor.price || ""} onChange={(event) => setEditor({ ...editor, price: Number(event.target.value) })} /></label>
                <label><span>狀態</span><select value={editor.status} onChange={(event) => setEditor({ ...editor, status: event.target.value as Product["status"] })}><option>上架</option><option>暫停</option></select></label>
                <label><span>首頁展示</span><select value={editor.featured ? "featured" : "regular"} onChange={(event) => setEditor({ ...editor, featured: event.target.value === "featured" })}><option value="regular">一般商品</option><option value="featured">本週精選</option></select></label>
                <label className="field-wide"><span>備註（選填）</span><input value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} placeholder="例如：付款後 5–15 分鐘交貨" /></label>
                <div className="field-wide image-field">
                  <span>商品圖片（選填）</span>
                  <div className={`image-picker ${imagePreview ? "has-image" : ""}`}>
                    <div className="image-preview">
                      {imagePreview
                        ? /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={imagePreview} alt="商品圖片預覽" />
                        : <span aria-hidden="true">▧</span>}
                    </div>
                    <div className="image-picker-copy">
                      <strong>{imagePreview ? "圖片已準備完成" : "加入商品圖片"}</strong>
                      <p>支援 JPG、PNG、WebP；系統會自動壓縮，儲存上限 2 MB。</p>
                      <div>
                        <label className="image-upload-button">
                          {imagePreview ? "更換圖片" : "選擇圖片"}
                          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectProductImage} />
                        </label>
                        {imagePreview && <button className="image-remove-button" type="button" onClick={clearProductImage}>移除圖片</button>}
                      </div>
                    </div>
                  </div>
                  {imageError && <p className="field-error" role="alert">{imageError}</p>}
                </div>
              </div>
              <div className="modal-actions">
                {editor.id && <button className="danger-button modal-delete-button" type="button" onClick={() => {
                  const target = products.find((product) => product.id === editor.id);
                  if (target) askToDelete([target], "editor");
                }}>刪除商品</button>}
                <span className="modal-action-spacer" />
                <button className="secondary-button" type="button" disabled={saving} onClick={closeEditor}>取消</button>
                <button className="primary-button" type="submit" disabled={saving}>{saving ? "儲存中…" : editor.id ? "儲存更新" : "新增商品"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {typeEditorOpen && canManageProducts && (
        <div className="modal-backdrop type-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTypeEditor(); }}>
          <section className="type-modal" role="dialog" aria-modal="true" aria-labelledby="type-editor-title">
            <div className="modal-heading">
              <div><p className="section-kicker">PRODUCT TYPES</p><h2 id="type-editor-title">管理商品類型</h2></div>
              <button type="button" disabled={savingType} onClick={closeTypeEditor} aria-label="關閉">×</button>
            </div>
            <p className="type-modal-description">重新命名時，此類型下的所有商品會一起更新。只有沒有商品的類型可以刪除。</p>
            <div className="type-management-list">
              {productKinds.map((kind) => {
                const productCount = products.filter((product) => product.kind === kind).length;
                const isEditing = editingType === kind;
                const confirmingDelete = deleteTypeTarget === kind;
                return (
                  <div className={`type-management-row ${isEditing ? "editing" : ""}`} key={kind}>
                    {isEditing ? (
                      <form onSubmit={renameProductType}>
                        <input autoFocus required maxLength={30} value={editingTypeName} onChange={(event) => { setEditingTypeName(event.target.value); setTypeError(""); }} aria-label={`修改 ${kind} 的名稱`} />
                        <button className="type-save-button" type="submit" disabled={savingType || !editingTypeName.trim()}>儲存</button>
                        <button className="type-cancel-button" type="button" disabled={savingType} onClick={() => { setEditingType(null); setTypeError(""); }}>取消</button>
                      </form>
                    ) : (
                      <>
                        <div className="type-row-name"><strong>{kind}</strong><span>{productCount} 項商品</span></div>
                        <div className="type-row-actions">
                          <button type="button" disabled={savingType} onClick={() => startEditingType(kind)}>修改</button>
                          <button
                            className={confirmingDelete ? "confirming" : ""}
                            type="button"
                            disabled={savingType || productCount > 0}
                            title={productCount > 0 ? "請先將此類型的商品修改到其他類型" : ""}
                            onClick={() => deleteProductType(kind)}
                          >
                            {confirmingDelete ? "確認刪除" : "刪除"}
                          </button>
                          {confirmingDelete && <button className="type-delete-cancel" type="button" onClick={() => setDeleteTypeTarget(null)}>取消</button>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {typeError && <p className="field-error type-management-error" role="alert">{typeError}</p>}
            <div className="type-create-section">
              <strong>新增類型</strong>
              <p>例如「MM2 道具」、「限量品」或「Discord 相關服務」。</p>
            <form onSubmit={saveProductType}>
              <label className="type-name-field">
                  <span className="sr-only">類型名稱</span>
                  <input required maxLength={30} value={newTypeName} onChange={(event) => { setNewTypeName(event.target.value); setTypeError(""); }} placeholder="輸入新的商品類型" />
                  <button className="primary-button" type="submit" disabled={savingType || !newTypeName.trim()}>{savingType ? "處理中…" : "新增類型"}</button>
              </label>
            </form>
            </div>
          </section>
        </div>
      )}

      {deleteRequest && canManageProducts && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteRequest(null); }}>
          <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
            <span className="danger-icon" aria-hidden="true">!</span>
            <p className="section-kicker">DELETE PRODUCTS</p>
            <h2 id="delete-title">確定要永久刪除嗎？</h2>
            <p id="delete-description">
              {deleteRequest.products.length === 1
                ? `「${deleteRequest.products[0].name}」會從價格資料庫中移除。`
                : `這 ${deleteRequest.products.length} 項商品會從價格資料庫中移除。`}
              此操作無法復原。
            </p>
            {deleteRequest.products.length > 1 && (
              <ul>{deleteRequest.products.map((product) => <li key={product.id}>{product.name}</li>)}</ul>
            )}
            <div className="confirm-actions">
              <button className="secondary-button" type="button" disabled={deleting} onClick={() => setDeleteRequest(null)}>取消</button>
              <button className="danger-button" type="button" disabled={deleting} onClick={confirmDelete}>{deleting ? "刪除中…" : `確認刪除${deleteRequest.products.length > 1 ? ` ${deleteRequest.products.length} 項` : ""}`}</button>
            </div>
          </section>
        </div>
      )}

      <footer><span>PIXARO PRICE DESK</span><p>私人價格資料庫 · 所有金額皆為新台幣</p></footer>
    </main>
  );
}
