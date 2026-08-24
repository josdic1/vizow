import { pool } from "../db/pool.js";
import { cleanupExpiredDemoMedia } from "../services/demoMediaCleanup.js";

async function run(): Promise<void> {
  const cleaned = await cleanupExpiredDemoMedia(100);
  console.log(`Expired demo media cleanup complete. Cleaned ${cleaned} workspaces.`);
  await pool.end();
}

run().catch(async (error) => {
  console.error("Unable to clean expired Vizow demo media.");
  console.error(error);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
