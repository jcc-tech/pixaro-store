import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { products } from "../../../../db/schema";
import { getBucket } from "../../../../db/storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const productId = Number(rawId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const db = await getDb();
  const [product] = await db
    .select({ imageKey: products.imageKey })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product?.imageKey) return new Response("Not found", { status: 404 });

  const bucket = await getBucket();
  const image = await bucket.get(product.imageKey);
  if (!image) return new Response("Not found", { status: 404 });

  if (request.headers.get("if-none-match") === image.httpEtag) {
    return new Response(null, { status: 304, headers: { etag: image.httpEtag } });
  }

  const headers = new Headers();
  image.writeHttpMetadata(headers);
  headers.set("etag", image.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  headers.set("x-content-type-options", "nosniff");
  return new Response(image.body, { headers });
}
