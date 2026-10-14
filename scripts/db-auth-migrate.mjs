import "dotenv/config";

const { auth } = await import("../lib/auth.ts");
const { getMigrations } = await import("better-auth/db/migration");

const schemaName = auth.options.database?.schemaName ?? "public";

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);

if (toBeCreated.length === 0 && toBeAdded.length === 0) {
  console.log(`Better Auth schema is up to date in the "${schemaName}" schema.`);
} else {
  for (const t of toBeCreated) console.log(`  + create ${schemaName}.${t.table}`);
  for (const t of toBeAdded) console.log(`  ~ alter ${schemaName}.${t.table}`);
  await runMigrations();
  console.log(`Better Auth migration applied to the "${schemaName}" schema.`);
}

process.exit(0);