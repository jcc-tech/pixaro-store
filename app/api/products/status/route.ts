import { rejectNonManager } from "../../../../lib/manager";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { products } from "../../../../db/schema";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const raw = (await request.json()) as { id?: unknown; status?: unknown };
    const id = Number(raw.id);
    const status = raw.status === "暫停" ? "暫停" : raw.status === "上架" ? "上架" : "";
    if (!Number.isInteger(id) || id <= 0 || !status) return Response.json({ error: "商品或狀態無效" }, { status: 400 });
    const db = await getDb();
    const [product] = await db.update(products)
      .set({ status, updatedBy: "Pixaro", updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(products.id, id))
      .returning();
    if (!product) return Response.json({ error: "找不到商品" }, { status: 404 });
    return Response.json({ product });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "資料格式錯誤" }, { status: 400 });
    return Response.json({ error: "狀態更新失敗" }, { status: 500 });
  }
}
