import { rejectNonManager } from "../../../lib/manager";
import { asc } from "drizzle-orm";
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";
import { getDb } from "../../../db";
import { getBucket } from "../../../db/storage";
import { appState, products, productTypes } from "../../../db/schema";

export const dynamic = "force-dynamic";

type ProductRow = typeof products.$inferSelect;

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csvFile(headers: string[], rows: unknown[][]) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function databaseSql(productRows: ProductRow[], typeRows: Array<typeof productTypes.$inferSelect>, stateRows: Array<typeof appState.$inferSelect>) {
  const statements = [
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
    "CREATE TABLE IF NOT EXISTS product_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, kind TEXT NOT NULL, category TEXT NOT NULL, game TEXT NOT NULL, amount_label TEXT NOT NULL DEFAULT '', robux_amount INTEGER, price INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '上架', featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, image_key TEXT, updated_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    ...typeRows.map((row) => `INSERT OR REPLACE INTO product_types (id,name,sort_order,created_at) VALUES (${[row.id, row.name, row.sortOrder, row.createdAt].map(sqlValue).join(",")});`),
    ...productRows.map((row) => `INSERT OR REPLACE INTO products (id,name,kind,category,game,amount_label,robux_amount,price,note,status,featured,sort_order,image_key,updated_by,created_at,updated_at) VALUES (${[
      row.id, row.name, row.kind, row.category, row.game, row.amountLabel, row.robuxAmount, row.price, row.note, row.status,
      row.featured, row.sortOrder, row.imageKey, row.updatedBy, row.createdAt, row.updatedAt,
    ].map(sqlValue).join(",")});`),
    ...stateRows.map((row) => `INSERT OR REPLACE INTO app_state (key,value,updated_at) VALUES (${[row.key, row.value, row.updatedAt].map(sqlValue).join(",")});`),
    "COMMIT;",
    "PRAGMA foreign_keys=ON;",
    "",
  ];
  return statements.join("\n");
}

function imageBackupPath(imageKey: string, productId: number) {
  const normalized = imageKey.replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return `r2/products/${productId}/image.bin`;
  }
  return `r2/${normalized}`;
}

function addTextFile(zip: Zip, name: string, content: string) {
  const file = new ZipDeflate(name, { level: 6 });
  zip.add(file);
  file.push(strToU8(content), true);
}

export async function GET() {
  const denied = await rejectNonManager();
  if (denied) return denied;
  try {
    const db = await getDb();
    const [productRows, typeRows, stateRows, bucket] = await Promise.all([
      db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id)),
      db.select().from(productTypes).orderBy(asc(productTypes.sortOrder), asc(productTypes.id)),
      db.select().from(appState).orderBy(asc(appState.key)),
      getBucket(),
    ]);

    const exportedAt = new Date().toISOString();
    const date = exportedAt.slice(0, 10);
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const zip = new Zip((error, data, final) => {
          if (closed) return;
          if (error) {
            closed = true;
            controller.error(error);
            return;
          }
          if (data.length) controller.enqueue(data);
          if (final) {
            closed = true;
            controller.close();
          }
        });

        try {
          const imageManifest: Array<{ productId: number; imageKey: string; backupPath: string; contentType: string | null; size: number | null; status: "included" | "missing" }> = [];
          for (const product of productRows) {
            if (!product.imageKey) continue;
            const backupPath = imageBackupPath(product.imageKey, product.id);
            const object = await bucket.get(product.imageKey);
            if (!object) {
              imageManifest.push({ productId: product.id, imageKey: product.imageKey, backupPath, contentType: null, size: null, status: "missing" });
              continue;
            }
            const bytes = new Uint8Array(await object.arrayBuffer());
            const file = new ZipPassThrough(backupPath);
            zip.add(file);
            file.push(bytes, true);
            imageManifest.push({
              productId: product.id,
              imageKey: product.imageKey,
              backupPath,
              contentType: object.httpMetadata?.contentType || "application/octet-stream",
              size: bytes.byteLength,
              status: "included",
            });
          }

          const backup = {
            format: "pixaro-price-desk-backup",
            version: 1,
            exportedAt,
            readOnlyExport: true,
            counts: { products: productRows.length, productTypes: typeRows.length, images: imageManifest.filter((image) => image.status === "included").length },
            productTypes: typeRows,
            products: productRows,
            appState: stateRows,
            images: imageManifest,
          };
          addTextFile(zip, "backup.json", `${JSON.stringify(backup, null, 2)}\n`);
          addTextFile(zip, "database.sql", databaseSql(productRows, typeRows, stateRows));
          addTextFile(zip, "products.csv", csvFile(
            ["id", "name", "kind", "category", "game", "amountLabel", "robuxAmount", "price", "note", "status", "featured", "sortOrder", "imageKey", "updatedBy", "createdAt", "updatedAt"],
            productRows.map((row) => [row.id, row.name, row.kind, row.category, row.game, row.amountLabel, row.robuxAmount, row.price, row.note, row.status, row.featured, row.sortOrder, row.imageKey, row.updatedBy, row.createdAt, row.updatedAt]),
          ));
          addTextFile(zip, "product-types.csv", csvFile(
            ["id", "name", "sortOrder", "createdAt"],
            typeRows.map((row) => [row.id, row.name, row.sortOrder, row.createdAt]),
          ));
          addTextFile(zip, "README.txt", [
            "PIXARO PRICE DESK 完整備份",
            `匯出時間：${exportedAt}`,
            "",
            "這次匯出只讀取並複製資料，不會新增、修改或刪除原網站的任何內容。",
            "backup.json：完整結構化資料與圖片清單。",
            "database.sql：可匯入 SQLite / Cloudflare D1 的資料庫備份。",
            "products.csv：商品資料試算表格式。",
            "product-types.csv：商品類型試算表格式。",
            "r2/：商品圖片，保留原始 R2 物件路徑；搬遷時上傳 r2/ 內的檔案並移除最前面的 r2/。",
            "",
            `商品：${productRows.length} 筆`,
            `類型：${typeRows.length} 筆`,
            `圖片：${imageManifest.filter((image) => image.status === "included").length} 個`,
            "",
          ].join("\r\n"));
          zip.end();
        } catch (error) {
          if (!closed) {
            closed = true;
            controller.error(error);
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="pixaro-backup-${date}.zip"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Backup export failed", error);
    return Response.json({ error: "備份匯出失敗，請稍後再試" }, { status: 500 });
  }
}
