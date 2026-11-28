import { readFile } from "node:fs/promises";
import { db, query } from "../src/server/db";
import { defaults } from "../src/domain/types";
await query(
  await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"),
);
await query(await readFile(new URL("../db/harden-access.sql", import.meta.url), "utf8"));
await query("INSERT INTO settings VALUES ($1,$2) ON CONFLICT DO NOTHING", [
  "default",
  JSON.stringify(defaults),
]);
for (const c of defaults.categories)
  await query(
    "INSERT INTO categories(name,guidance) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [c.name, c.guidance],
  );
console.log("Database ready");
await db.end();
