export const PRODUCT_KINDS = ["代儲", "贈禮", "遊戲商品"] as const;
export type ProductKind = string;

export type ProductSeed = {
  name: string;
  kind: ProductKind;
  category: string;
  game: string;
  amountLabel: string;
  robuxAmount: number | null;
  price: number;
  note: string;
  status: "上架" | "暫停";
  featured: boolean;
  sortOrder: number;
};

export type Product = ProductSeed & { id: number; updatedAt: string; imageKey?: string | null };

const topup = (robux: number, price: number, sortOrder: number, featured = false): ProductSeed => ({
  name: `${robux.toLocaleString("en-US")} Robux`, kind: "代儲", category: "Roblox 代儲", game: "Roblox",
  amountLabel: `${robux.toLocaleString("en-US")} R`, robuxAmount: robux, price,
  note: "付款後 5–15 分鐘交貨", status: "上架", featured, sortOrder,
});

const item = (name: string, kind: ProductKind, category: string, game: string, amountLabel: string, robuxAmount: number | null, price: number, sortOrder: number, featured = false, note = ""): ProductSeed => ({
  name, kind, category, game, amountLabel, robuxAmount, price, note, status: "上架", featured, sortOrder,
});

export const DEFAULT_PRODUCTS: ProductSeed[] = [
  topup(500, 160, 1), topup(1000, 300, 2, true), topup(2000, 600, 3),
  topup(4500, 1300, 4, true), topup(10000, 2500, 5, true), topup(22500, 5600, 6),
  item("Roblox Premium 450", "代儲", "Roblox 會員", "Roblox", "450 R / 月", 450, 160, 10),
  item("Roblox Premium 1000", "代儲", "Roblox 會員", "Roblox", "1,000 R / 月", 1000, 300, 11),
  item("Roblox Premium 2200", "代儲", "Roblox 會員", "Roblox", "2,200 R / 月", 2200, 600, 12),
  item("皮膚箱", "贈禮", "Rivals 贈禮", "Rivals", "249 R", 249, 50, 20, true),
  item("Medkit", "贈禮", "Rivals 贈禮", "Rivals", "249 R", 249, 50, 21),
  item("外殼槍", "贈禮", "Rivals 贈禮", "Rivals", "649 R", 649, 140, 22),
  item("普通武器", "贈禮", "Rivals 贈禮", "Rivals", "999 R", 999, 200, 23),
  item("重型武器", "贈禮", "Rivals 贈禮", "Rivals", "1,899 R", 1899, 380, 24),
  item("經典武器", "贈禮", "Rivals 贈禮", "Rivals", "1,149 R", 1149, 245, 25, true),
  item("能源武器", "贈禮", "Rivals 贈禮", "Rivals", "1,299 R", 1299, 280, 26, true),
  item("49R 鑰匙", "贈禮", "Rivals 鑰匙", "Rivals", "49 R", 49, 50, 27),
  item("199R 鑰匙", "贈禮", "Rivals 鑰匙", "Rivals", "199 R", 199, 60, 28),
  item("449R 鑰匙", "贈禮", "Rivals 鑰匙", "Rivals", "449 R", 449, 90, 29),
  item("2199R 鑰匙組合包", "贈禮", "Rivals 鑰匙", "Rivals", "2,199 R", 2199, 440, 30),
  item("4999R 鑰匙組合包", "贈禮", "Rivals 鑰匙", "Rivals", "4,999 R", 4999, 900, 31, true),
  item("10 等季票", "贈禮", "Rivals 通行證", "Rivals", "Season Pass", null, 200, 32),
  item("Prime", "贈禮", "Rivals 權益", "Rivals", "Prime", null, 130, 33),
  item("Contraband", "贈禮", "Rivals 權益", "Rivals", "Contraband", null, 190, 34),
  item("20 箱組合", "贈禮", "Rivals 箱子", "Rivals", "20 箱", null, 900, 35),
  item("龍果", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 850, 50, true),
  item("響雷", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 410, 51, true),
  item("痛苦", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 400, 52, true, "優惠中"),
  item("蜘蛛", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 350, 53),
  item("創造", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 340, 54),
  item("愛", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 330, 55),
  item("大佛", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 310, 56, true),
  item("地震", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 300, 57),
  item("岩漿", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 255, 58),
  item("鬼魂", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 250, 59),
  item("橡膠", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 240, 60),
  item("燈光", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 205, 61),
  item("鑽石", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 195, 62),
  item("寒冰", "遊戲商品", "Blox Fruits 果實", "Blox Fruits", "永久果實", null, 150, 63),
];
