import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { deleteMedia } from "../media-sync/cloudflare";
import { getManifest, syncMedia, writeManifest } from "../media-sync/sync";

const app = new Hono();
const port = 3000;

app.post("/api/delete-all", async (c) => {
  const manifest = await getManifest();

  for (const path in manifest) {
    const entry = manifest[path];
    if (!entry) continue;
    try {
      await deleteMedia(entry.id, entry.type);
      console.log(`Deleted ${path}`);
    } catch (e) {
      console.error(`Failed to delete ${path}`, e);
    }
  }
  console.log("Deletion process finished.");
  await writeManifest({});
  return c.text("Deletion process finished.");
});

app.post("/api/sync-media", async (c) => {
  try {
    await syncMedia();
    console.log("Sucessfully synced manifest");
    return c.text("Sucessfully synced manifest");
  } catch (e) {
    console.error(`Failed to sync manifest`, e);
  }
});

app.use("/*", serveStatic({ root: "./admin-dashboard" }));

console.log(`Admin dashboard running at http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
