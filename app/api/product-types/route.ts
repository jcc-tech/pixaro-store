import { rejectNonManager } from "../../../lib/manager";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { listProductTypes } from "../../../db/product-types";
import { products, productTypes } from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const types = await listProductTypes();
    return Response.json({ productTypes: types.map((type) => type.name) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const raw = (await request.json()) as { name?: unknown };
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name || name.length > 30) {
      return Response.json({ error: "類型名稱需為 1–30 個字" }, { status: 400 });
    }

    const db = await getDb();
    const [existing] = await db.select().from(productTypes).where(eq(productTypes.name, name)).limit(1);
    if (existing) {
      return Response.json({ error: "此商品類型已存在" }, { status: 409 });
    }

    const [lastType] = await db
      .select({ sortOrder: productTypes.sortOrder })
      .from(productTypes)
      .orderBy(desc(productTypes.sortOrder), desc(productTypes.id))
      .limit(1);
    const [productType] = await db
      .insert(productTypes)
      .values({ name, sortOrder: (lastType?.sortOrder ?? 0) + 10 })
      .returning();

    return Response.json({ productType }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "資料格式錯誤" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const raw = (await request.json()) as { originalName?: unknown; name?: unknown };
    const originalName = typeof raw.originalName === "string" ? raw.originalName.trim() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!originalName || !name || name.length > 30) {
      return Response.json({ error: "類型名稱需為 1–30 個字" }, { status: 400 });
    }

    const db = await getDb();
    const [currentType] = await db
      .select()
      .from(productTypes)
      .where(eq(productTypes.name, originalName))
      .limit(1);
    if (!currentType) return Response.json({ error: "找不到商品類型" }, { status: 404 });
    if (originalName === name) return Response.json({ productType: currentType, updatedProducts: 0 });

    const [duplicate] = await db.select().from(productTypes).where(eq(productTypes.name, name)).limit(1);
    if (duplicate) return Response.json({ error: "此商品類型已存在" }, { status: 409 });

    const affectedProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.kind, originalName));
    const [, renamedTypes] = await db.batch([
      db.update(products).set({ kind: name, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(products.kind, originalName)),
      db.update(productTypes).set({ name }).where(eq(productTypes.name, originalName)).returning(),
    ]);
    const productType = renamedTypes[0];
    if (!productType) return Response.json({ error: "找不到商品類型" }, { status: 404 });

    return Response.json({ productType, updatedProducts: affectedProducts.length });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "資料格式錯誤" }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const raw = (await request.json()) as { name?: unknown };
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name) return Response.json({ error: "無效的商品類型" }, { status: 400 });

    const db = await getDb();
    const [currentType] = await db.select().from(productTypes).where(eq(productTypes.name, name)).limit(1);
    if (!currentType) return Response.json({ error: "找不到商品類型" }, { status: 404 });

    const [linkedProduct] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.kind, name))
      .limit(1);
    if (linkedProduct) {
      return Response.json({ error: "此類型仍有商品，請先修改商品類型後再刪除" }, { status: 409 });
    }

    const allTypes = await db.select({ id: productTypes.id }).from(productTypes).limit(2);
    if (allTypes.length <= 1) {
      return Response.json({ error: "至少需要保留一個商品類型" }, { status: 409 });
    }

    const [deletedType] = await db.delete(productTypes).where(eq(productTypes.name, name)).returning();
    return Response.json({ deletedType });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "資料格式錯誤" }, { status: 400 });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
