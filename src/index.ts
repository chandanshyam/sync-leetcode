import { run } from "./sync";
import { backfill } from "./backfill";

const command = process.argv[2];

if (command === "backfill") {
  backfill().catch((err) => { console.error(err); process.exit(1); });
} else {
  run().catch((err) => { console.error(err); process.exit(1); });
}
