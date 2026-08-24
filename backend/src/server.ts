import { app } from "./app.js";
import { runMigrations } from "./db/migrate.js";
import { env } from "./env.js";
import { cleanupExpiredDemoMedia } from "./services/demoMediaCleanup.js";

await runMigrations();

const cleanedDemoWorkspaces = await cleanupExpiredDemoMedia(100);
console.log(
  `Expired demo media cleanup complete. Cleaned ${cleanedDemoWorkspaces} workspaces.`,
);

app.listen(env.PORT, () => {
  console.log(`Vizow API listening on port ${env.PORT}`);
});
