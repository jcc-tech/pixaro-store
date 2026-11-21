import { asc, eq } from "drizzle-orm";
import { getDb } from ".";
import { PRODUCT_KINDS } from "../lib/products";
import { appState, productTypes } from "./schema";

export async function ensureDefaultProductTypes() {
  const db = await getDb();
  const [seedState] = await db
    .select()
    .from(appState)
    .where(eq(appState.key, "default_product_types_seeded"))
    .limit(1);
  if (seedState) return;

  await db
    .insert(productTypes)
    .values(PRODUCT_KINDS.map((name, index) => ({ name, sortOrder: (index + 1) * 10 })))
    .onConflictDoNothing();
  await db
    .insert(appState)
    .values({ key: "default_product_types_seeded", value: "true" })
    .onConflictDoNothing();
}

export async function listProductTypes() {
  await ensureDefaultProductTypes();
  const db = await getDb();
  return db.select().from(productTypes).orderBy(asc(productTypes.sortOrder), asc(productTypes.id));
}
