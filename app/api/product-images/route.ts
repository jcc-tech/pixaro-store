import { rejectNonManager } from "../../../lib/manager";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { products } from "../../../db/schema";
import { getBucket } from "../../../db/storage";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionFor(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const formData = await request.formData();
    const productId = Number(formData.get("productId"));
    const image = formData.get("image");

    if (!Number.isInteger(productId) || productId <= 0) {
      return Response.json({ error: "無效的商品編號" }, { status: 400 });
    }
    if (!(image instanceof File) || image.size === 0) {
      return Response.json({ error: "請選擇商品圖片" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return Response.json({ error: "圖片僅支援 JPG、PNG 或 WebP" }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "圖片不可超過 2 MB" }, { status: 413 });
    }

    const db = await getDb();
    const [currentProduct] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!currentProduct) return Response.json({ error: "找不到商品" }, { status: 404 });

    const bucket = await getBucket();
    const imageKey = `products/${productId}/${crypto.randomUUID()}.${extensionFor(image.type)}`;
    await bucket.put(imageKey, image.stream(), {
      httpMetadata: { contentType: image.type },
      customMetadata: { productId: String(productId) },
    });

    const [product] = await db
      .update(products)
      .set({ imageKey, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(products.id, productId))
      .returning();

    if (!product) {
      await bucket.delete(imageKey);
      return Response.json({ error: "找不到商品" }, { status: 404 });
    }
    if (currentProduct.imageKey && currentProduct.imageKey !== imageKey) {
      await bucket.delete(currentProduct.imageKey);
    }

    return Response.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const raw = (await request.json()) as { productId?: unknown };
    const productId = Number(raw.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return Response.json({ error: "無效的商品編號" }, { status: 400 });
    }

    const db = await getDb();
    const [currentProduct] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!currentProduct) return Response.json({ error: "找不到商品" }, { status: 404 });

    const [product] = await db
      .update(products)
      .set({ imageKey: null, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(products.id, productId))
      .returning();
    if (currentProduct.imageKey) {
      const bucket = await getBucket();
      await bucket.delete(currentProduct.imageKey);
    }

    return Response.json({ product });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "資料格式錯誤" }, { status: 400 });
    }
    return errorResponse(error);
  }
}
