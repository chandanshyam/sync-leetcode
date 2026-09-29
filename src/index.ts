import { run } from "./sync";
import { backfill } from "./backfill";
import { ensureAuth } from "./auth";

const command = process.argv[2];

async function main() {
  await ensureAuth();
  if (command === "backfill") return backfill();
  return run();
}

main().catch((err) => { console.error(err); process.exit(1); });
