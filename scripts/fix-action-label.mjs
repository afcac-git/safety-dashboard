import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

// Read DATABASE_URL from .env.local if not in environment
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(".env.local", "utf-8");
    const match = env.match(/DATABASE_URL=(.+)/);
    if (match) process.env.DATABASE_URL = match[1].trim();
  } catch {}
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Create .env.local with your Neon connection string first.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const OLD_LABEL = "39 targets";
const NEW_LABEL = "39 Actions";

const rows = await sql`SELECT value FROM afcac_kv WHERE key = 'actions'`;
if (rows.length === 0) {
  console.log("No 'actions' key found in the DB yet — nothing to fix (it will seed from the updated JSON on first read).");
  process.exit(0);
}

const actions = rows[0].value;
let changed = 0;
const fixed = actions.map((a) => {
  if (a.action === OLD_LABEL) {
    changed++;
    return { ...a, action: NEW_LABEL };
  }
  return a;
});

if (changed === 0) {
  console.log(`No rows had action === "${OLD_LABEL}" — nothing to update.`);
  process.exit(0);
}

await sql`
  UPDATE afcac_kv SET value = ${JSON.stringify(fixed)}::jsonb, updated_at = NOW()
  WHERE key = 'actions'
`;

console.log(`Updated ${changed} row(s): "${OLD_LABEL}" -> "${NEW_LABEL}" in the live DB.`);
