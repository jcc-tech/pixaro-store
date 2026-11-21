import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  category: text("category").notNull(),
  game: text("game").notNull(),
  amountLabel: text("amount_label").notNull().default(""),
  robuxAmount: integer("robux_amount"),
  price: integer("price").notNull(),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("上架"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  imageKey: text("image_key"),
  updatedBy: text("updated_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productTypes = sqliteTable("product_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// The employee tables were introduced by migration 0004.
export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  role: text("role").notNull(),
  active: integer("active", {mode:"boolean"}).notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const employeeSessions = sqliteTable("employee_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  employeeId: integer("employee_id").notNull().references(()=>employees.id, {onDelete:"cascade"}),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const members = sqliteTable("members", {
  code: text("code").primaryKey(),
  owner: text("owner").notNull().unique(),
  discordId: text("discord_id").unique(),
  discordName: text("discord_name"),
  linkState: text("link_state"),
  linkExpires: integer("link_expires"),
});
export const memberSales = sqliteTable("member_sales", {
  receipt: text("receipt").primaryKey(),
  member: text("member").notNull().references(()=>members.code),
  amount: integer("amount").notNull(),
  recordedBy: text("recorded_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[index("member_sales_by_member").on(table.member)]);
export const memberClaims = sqliteTable("member_claims", {
  member: text("member").notNull().references(()=>members.code),
  tier: integer("tier").notNull(),
  kind: text("kind").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table=>[primaryKey({columns:[table.member,table.tier,table.kind]})]);
