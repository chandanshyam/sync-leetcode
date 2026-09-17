import { run } from "./sync";
import { backfill } from "./backfill";

run().catch((err) => {
  console.error(err);
  process.exit(1);
});