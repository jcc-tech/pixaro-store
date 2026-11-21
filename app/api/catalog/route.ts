import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { products as p } from "../../../db/schema";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const rows = await db.select({
    id: p.id, name: p.name, game: p.game, kind: p.kind, amount: p.amountLabel,
    price: p.price, featured: p.featured, image: p.imageKey, updated: p.updatedAt,
  }).from(p).where(eq(p.status, "上架")).orderBy(desc(p.featured), asc(p.sortOrder), asc(p.id));
  return Response.json(rows.map(({ image, updated, ...item }) => ({
    ...item, image: image ? '/api/product-images/' + item.id + '?v=' + encodeURIComponent(updated) : null,
  })), { headers: { "Cache-Control": "no-store" } });
}
