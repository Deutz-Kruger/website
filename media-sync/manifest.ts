import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  type Manifest,
  MANIFEST_SCHEMA_VERSION,
  manifestSchema,
} from "./schema";

export const DEFAULT_MANIFEST_PATH = resolve(
  "./src/generated/media-manifest.json",
);

const sortManifestEntries = (
  entries: Manifest["entries"],
): Manifest["entries"] =>
  Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)),
  );

export const writeJsonAtomic = async (
  path: string,
  value: unknown,
): Promise<void> => {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
    await rename(temporaryPath, path);
  } catch (error) {
    // Never leave a partial temporary file behind; the original error takes
    // precedence even if cleanup also fails. Rename stays the final step.
    try {
      await rm(temporaryPath, { force: true });
    } catch {
      // Cleanup failure must not mask the original error.
    }
    throw error;
  }
};

/** Writes a generated manifest atomically to avoid partial builds. */
export const writeManifest = async (
  entries: Manifest["entries"],
  manifestPath = DEFAULT_MANIFEST_PATH,
): Promise<void> => {
  const parsed = manifestSchema.parse({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    entries: sortManifestEntries(entries),
  });
  await writeJsonAtomic(manifestPath, parsed);
};

/** Reads and validates the generated frontend manifest. */
export const readManifest = async (
  manifestPath = DEFAULT_MANIFEST_PATH,
): Promise<Manifest> => {
  const contents = await readFile(manifestPath, "utf8");
  try {
    return manifestSchema.parse(JSON.parse(contents));
  } catch (error) {
    throw new Error(
      `Generated media manifest is invalid or outdated. Run "pnpm sync-media" first. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};
