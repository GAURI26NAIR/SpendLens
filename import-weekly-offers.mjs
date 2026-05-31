import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const csvPath = process.argv[2] ?? "samples/weekly-offers.csv";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL,
  }),
});

function parseCSVLines(content) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index++) {
    const character = content[index];
    const next = content[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function toRows(content) {
  const lines = parseCSVLines(content).filter((line) =>
    line.some((value) => value.trim())
  );
  const headers = lines[0].map((header) => header.trim());

  return lines.slice(1).map((line) =>
    Object.fromEntries(
      headers.map((header, index) => [header, line[index]?.trim() ?? ""])
    )
  );
}

function rowToData(row) {
  const validFrom = new Date(row.ValidFrom);
  const validUntil = new Date(row.ValidUntil);
  validUntil.setUTCHours(23, 59, 59, 999);

  return {
    store: {
      name: row.StoreName.trim(),
      chain: row.StoreChain.trim(),
      postalCode: row.PostalCode.trim(),
      city: row.City.trim(),
      latitude: Number(row.Latitude),
      longitude: Number(row.Longitude),
      address: "",
    },
    coupon: {
      title: row.CouponTitle.trim(),
      description: "",
      category: row.Category.trim(),
      discount: parseDiscount(row.Discount),
      validFrom,
      validUntil,
    },
  };
}

function parseDiscount(value) {
  const parsed = Number(value.trim().replace(/%$/, ""));

  if (!Number.isFinite(parsed)) return Number.NaN;

  return parsed > 1 ? parsed / 100 : parsed;
}

let imported = 0;

try {
  const rows = toRows(await readFile(csvPath, "utf8"));

  for (const row of rows) {
    const data = rowToData(row);
    const store = await prisma.store.upsert({
      where: {
        chain_postalCode_name: {
          chain: data.store.chain,
          postalCode: data.store.postalCode,
          name: data.store.name,
        },
      },
      update: data.store,
      create: data.store,
    });

    await prisma.coupon.upsert({
      where: {
        storeId_title_validFrom_validUntil: {
          storeId: store.id,
          title: data.coupon.title,
          validFrom: data.coupon.validFrom,
          validUntil: data.coupon.validUntil,
        },
      },
      update: data.coupon,
      create: {
        ...data.coupon,
        storeId: store.id,
      },
    });

    imported++;
  }

  console.log(`Imported ${imported} weekly offers from ${csvPath}.`);
} finally {
  await prisma.$disconnect();
}
