import { db } from "@/lib/db";
import { productVariants, products } from "@kyarainnovate/db/schema";
import { eq, isNull } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlatProductRow = {
  productId: string;
  name: string;
  description: string;
  priceYen: number;
  isActive: boolean;
  intensity: string;
  isLimited: boolean;
  manufacturingDays: number;
  // Variant fields (empty if no variant)
  variantId: string;
  volume: string;
  variantPrice: string;
  sku: string;
  stock: string;
};

// ---------------------------------------------------------------------------
// CSV Headers
// ---------------------------------------------------------------------------

const CSV_HEADERS = [
  "product_id",
  "name",
  "description",
  "price_yen",
  "is_active",
  "intensity",
  "is_limited",
  "manufacturing_days",
  "variant_id",
  "volume",
  "variant_price",
  "sku",
  "stock",
] as const;

// ---------------------------------------------------------------------------
// escapeCSV
// ---------------------------------------------------------------------------

function escapeCSV(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// exportProductsCSV
// ---------------------------------------------------------------------------

export async function exportProductsCSV(): Promise<string> {
  const allProducts = await db
    .select()
    .from(products)
    .where(isNull(products.deletedAt));

  const allVariants = await db.select().from(productVariants);

  const variantsByProduct = new Map<string, (typeof allVariants)[number][]>();
  for (const v of allVariants) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(v);
    variantsByProduct.set(v.productId, list);
  }

  const rows: FlatProductRow[] = [];

  for (const p of allProducts) {
    const variants = variantsByProduct.get(p.id);

    if (variants && variants.length > 0) {
      for (const v of variants) {
        rows.push({
          productId: p.id,
          name: p.name,
          description: p.description ?? "",
          priceYen: p.priceYen,
          isActive: p.isActive,
          intensity: p.intensity ?? "",
          isLimited: p.isLimited,
          manufacturingDays: p.manufacturingDays,
          variantId: v.id,
          volume: String(v.volume),
          variantPrice: String(v.price),
          sku: v.sku,
          stock: String(v.stock),
        });
      }
    } else {
      rows.push({
        productId: p.id,
        name: p.name,
        description: p.description ?? "",
        priceYen: p.priceYen,
        isActive: p.isActive,
        intensity: p.intensity ?? "",
        isLimited: p.isLimited,
        manufacturingDays: p.manufacturingDays,
        variantId: "",
        volume: "",
        variantPrice: "",
        sku: "",
        stock: "",
      });
    }
  }

  const lines = [CSV_HEADERS.join(",")];

  for (const row of rows) {
    lines.push(
      [
        escapeCSV(row.productId),
        escapeCSV(row.name),
        escapeCSV(row.description),
        String(row.priceYen),
        String(row.isActive),
        escapeCSV(row.intensity),
        String(row.isLimited),
        String(row.manufacturingDays),
        escapeCSV(row.variantId),
        escapeCSV(row.volume),
        escapeCSV(row.variantPrice),
        escapeCSV(row.sku),
        escapeCSV(row.stock),
      ].join(","),
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// importProductsCSV – Parse CSV and upsert products + variants
// ---------------------------------------------------------------------------

type ImportResult = {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
};

export async function importProductsCSV(
  csvText: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    errors: [],
  };

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    result.errors.push("CSV にデータ行がありません");
    return result;
  }

  // Skip header
  const dataLines = lines.slice(1);

  for (let i = 0; i < dataLines.length; i++) {
    const cols = parseCSVLine(dataLines[i]);
    if (cols.length < CSV_HEADERS.length) {
      result.errors.push(`行 ${i + 2}: カラム数が不足 (${cols.length})`);
      continue;
    }

    const [
      productId,
      name,
      description,
      priceYenStr,
      isActiveStr,
      intensity,
      isLimitedStr,
      mfgDaysStr,
      variantId,
      volume,
      variantPrice,
      sku,
      stock,
    ] = cols;

    const priceYen = Number.parseInt(priceYenStr, 10);
    if (Number.isNaN(priceYen)) {
      result.errors.push(`行 ${i + 2}: 無効な価格`);
      continue;
    }

    try {
      // Upsert product
      if (productId) {
        const [existing] = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.id, productId));

        if (existing) {
          await db
            .update(products)
            .set({
              name,
              description: description || null,
              priceYen,
              isActive: isActiveStr === "true",
              intensity: intensity || null,
              isLimited: isLimitedStr === "true",
              manufacturingDays: Number.parseInt(mfgDaysStr, 10) || 5,
              updatedAt: new Date(),
            })
            .where(eq(products.id, productId));
          result.productsUpdated++;
        } else {
          result.errors.push(
            `行 ${i + 2}: 商品ID ${productId} が見つかりません (新規作成はCSVからは非対応)`,
          );
          continue;
        }
      } else {
        result.errors.push(`行 ${i + 2}: 商品IDが空です`);
        continue;
      }

      // Upsert variant
      if (variantId && sku) {
        const vol = Number.parseInt(volume, 10);
        const price = Number.parseInt(variantPrice, 10);
        const stk = Number.parseInt(stock, 10);

        if (Number.isNaN(vol) || Number.isNaN(price)) {
          result.errors.push(`行 ${i + 2}: バリアントの値が無効`);
          continue;
        }

        const [existingVariant] = await db
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(eq(productVariants.id, variantId));

        if (existingVariant) {
          await db
            .update(productVariants)
            .set({
              volume: vol,
              price,
              sku,
              stock: Number.isNaN(stk) ? 0 : stk,
              updatedAt: new Date(),
            })
            .where(eq(productVariants.id, variantId));
          result.variantsUpdated++;
        } else {
          await db.insert(productVariants).values({
            productId,
            volume: vol,
            price,
            sku,
            stock: Number.isNaN(stk) ? 0 : stk,
          });
          result.variantsCreated++;
        }
      }
    } catch (err) {
      result.errors.push(
        `行 ${i + 2}: ${err instanceof Error ? err.message : "不明なエラー"}`,
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// parseCSVLine – Simple CSV line parser (handles quoted fields)
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}
