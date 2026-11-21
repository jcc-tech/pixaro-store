import { rejectNonManager } from "../../../lib/manager";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureDefaultProductTypes, listProductTypes } from "../../../db/product-types";
import { appState, products, productTypes } from "../../../db/schema";
import { getBucket } from "../../../db/storage";
import { DEFAULT_PRODUCTS, type ProductKind } from "../../../lib/products";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}

function validKind(value: unknown): value is ProductKind {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 30;
}

function parsePayload(payload: Record<string, unknown>) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const game = typeof payload.game === "string" ? payload.game.trim() : "";
  const amountLabel = typeof payload.amountLabel === "string" ? payload.amountLabel.trim() : "";
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  const price = Number(payload.price);
  const robuxAmount = payload.robuxAmount === null || payload.robuxAmount === "" || payload.robuxAmount === undefined ? null : Number(payload.robuxAmount);
  const status = payload.status === "暫停" ? "暫停" : "上架";

  if (!name || !category || !game || !validKind(payload.kind) || !Number.isFinite(price) || price < 0) throw new Error("商品名稱、分類、遊戲、類型與有效售價為必填欄位");
  if (robuxAmount !== null && (!Number.isFinite(robuxAmount) || robuxAmount < 0)) throw new Error("Robux 數量必須是有效數字");

  return {
    name, kind: payload.kind, category, game, amountLabel, robuxAmount, price: Math.round(price), note, status,
    featured: Boolean(payload.featured), sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 999,
  };
}

async function seedIfEmpty() {
  await ensureDefaultProductTypes();
  const db = await getDb();
  const [seedState] = await db.select().from(appState).where(eq(appState.key, "default_products_seeded")).limit(1);
  if (seedState) return;

  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length === 0) {
    // D1 limits the number of bound values in one statement. Seed in small,
    // deterministic groups instead of one oversized multi-row INSERT.
    const seedBatchSize = 6;
    for (let offset = 0; offset < DEFAULT_PRODUCTS.length; offset += seedBatchSize) {
      await db.insert(products).values(DEFAULT_PRODUCTS.slice(offset, offset + seedBatchSize));
    }
  }
  await db.insert(appState).values({ key: "default_products_seeded", value: "true" });
}

export async function GET() {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    await seedIfEmpty();
    const db = await getDb();
    const [rows, types] = await Promise.all([
      db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id)),
      listProductTypes(),
    ]);
    return Response.json({ products: rows, productTypes: types.map((type) => type.name) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const db = await getDb();
    const payload = parsePayload((await request.json()) as Record<string, unknown>);
    const updatedBy = "Pixaro";
    const [product] = await db.insert(products).values({ ...payload, updatedBy }).returning();
    return Response.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && (error.message.includes("必填") || error.message.includes("Robux")))) return Response.json({ error: error instanceof Error ? error.message : "資料格式錯誤" }, { status: 400 });
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const db = await getDb();
    const raw = (await request.json()) as Record<string, unknown>;
    const id = Number(raw.id);
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "無效的商品編號" }, { status: 400 });
    const payload = parsePayload(raw);
    const updatedBy = "Pixaro";
    const [product] = await db.update(products).set({ ...payload, updatedBy, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(products.id, id)).returning();
    if (!product) return Response.json({ error: "找不到商品" }, { status: 404 });
    return Response.json({ product });
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && (error.message.includes("必填") || error.message.includes("Robux")))) return Response.json({ error: error instanceof Error ? error.message : "資料格式錯誤" }, { status: 400 });
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const raw = (await request.json()) as { ids?: unknown; kind?: unknown };
    const ids = Array.isArray(raw.ids)
      ? [...new Set(raw.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
      : [];
    const kind = typeof raw.kind === "string" ? raw.kind.trim() : "";
    if (ids.length === 0) return Response.json({ error: "請選擇要移動的商品" }, { status: 400 });
    if (!validKind(kind)) return Response.json({ error: "請選擇有效的商品類型" }, { status: 400 });

    const db = await getDb();
    const [targetType] = await db.select().from(productTypes).where(eq(productTypes.name, kind)).limit(1);
    if (!targetType) return Response.json({ error: "找不到目標商品類型" }, { status: 404 });

    const updatedBy = "Pixaro";
    const movedProducts = await db
      .update(products)
      .set({ kind, updatedBy, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(inArray(products.id, ids))
      .returning();

    return Response.json({ products: movedProducts });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "資料格式錯誤" }, { status: 400 });
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const db = await getDb();
    const raw = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(raw.ids)
      ? [...new Set(raw.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
      : [];

    if (ids.length === 0) {
      return Response.json({ error: "請選擇要刪除的商品" }, { status: 400 });
    }

    const rowsToDelete = await db
      .select({ id: products.id, imageKey: products.imageKey })
      .from(products)
      .where(inArray(products.id, ids));
    const deleted = await db
      .delete(products)
      .where(inArray(products.id, ids))
      .returning({ id: products.id });

    const imageKeys = rowsToDelete
      .map((product) => product.imageKey)
      .filter((key): key is string => Boolean(key));
    if (imageKeys.length > 0) {
      try {
        const bucket = await getBucket();
        await bucket.delete(imageKeys);
      } catch {
        // Product deletion remains authoritative even if best-effort file cleanup is unavailable.
      }
    }

    return Response.json({ deletedIds: deleted.map((product) => product.id) });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "資料格式錯誤" }, { status: 400 });
    }
    return errorResponse(error);
  }
}
