// TODO: Implement writing metadata to manifest
// TODO: Sanitize file path to only use _ instead of spaces, -, etc.
// TODO: Implement manifest updating
// TODO: Implement deletion detection

import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { glob } from "glob";
import { type z } from "zod";

import { uploadMedia } from "./cloudflare";
import { generateFileHash, getMediaType } from "./file-utils";
import { isErrorWithCode } from "./guards";
import { manifestSchema, manifestValueSchema } from "./schema";

type Manifest = z.infer<typeof manifestSchema>;
export type ManifestEntry = z.infer<typeof manifestValueSchema>;

const ROOT = resolve(".");
const MANIFEST_PATH = resolve(ROOT, "./media-sync/manifest.json");
const MEDIA_PATH = resolve("./src/content/media");

/**
 * Reads and parses the media manifest file.
 * @returns A promise that resolves to the parsed manifest object, or an empty object if the manifest is not found or invalid.
 */
export const getManifest = async (): Promise<Manifest> => {
  try {
    const fileContent = await readFile(MANIFEST_PATH, "utf-8");
    const jsonData = JSON.parse(fileContent);
    return manifestSchema.parse(jsonData);
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      console.log("Manifest not found. A new one will be created.");
    } else {
      console.warn(
        "An error occurred while reading or parsing manifest.json. Starting fresh.",
      );
      if (error instanceof Error) {
        console.error("Details:", error.message, "\n");
      } else {
        console.error("Caught an unknown error type:", error);
      }
    }
  }
  return {};
};

/**
 * Retrieves a list of all media file paths relative to the project root.
 * @returns A promise that resolves to an array of relative file paths.
 */
export const getMediaPaths = async (): Promise<string[]> => {
  const absolutePaths = await glob(`${MEDIA_PATH}/**`, { nodir: true });
  const relativePaths = absolutePaths.map((absPath) => relative(ROOT, absPath));
  return relativePaths;
};

/**
 * Checks the local media files against the manifest, uploads new or modified files to Cloudflare,
 * and updates the manifest accordingly.
 */
export const checkManifest = async () => {
  const manifest = await getManifest();
  const paths = await getMediaPaths();

  console.log(
    `\n____________________ Found ${paths.length} local media files. Checking... ____________________\n`,
  );

  for (const path of paths) {
    console.log(`############# Checking ${path}: #############\n`);
    const fileHash = await generateFileHash(path);
    const existingEntry = manifest[path];

    if (existingEntry && existingEntry.hash === fileHash) {
      console.log(`File already uploaded.\nSkipping...\n`);
      console.log(
        `------------------------------------------------------------------------\n`,
      );
      continue;
    }

    console.log(`[${path}] New or modified file detected.\n`);

    const mediaType = getMediaType(path);

    if (mediaType === "unknown") {
      console.error(
        `Invalid media type. Media typ: ${mediaType}.\nSkipping...`,
      );
      console.log(
        `------------------------------------------------------------------------\n`,
      );
      continue;
    }
    try {
      const status = await uploadMedia(path, mediaType);
      const mediaEntry: ManifestEntry = {
        id: status.id,
        type: mediaType,
        createdAt: new Date().toISOString(),
        hash: fileHash,
      };
      manifest[path] = mediaEntry;
      await writeManifest(manifest);
      console.log(
        `------------------------------------------------------------------------\n`,
      );
    } catch (error) {
      console.error(
        `[${path}] FAILED: Upload process failed.\nError details:`,
        error,
        "\n",
      );
      console.log(
        `------------------------------------------------------------------------\n`,
      );
      break;
    }
  }
};

/**
 * Writes the given manifest object to the manifest.json file.
 * @param manifest - The manifest object to write.
 */
const writeManifest = async (manifest: Manifest) => {
  const jsonManifest = JSON.stringify(manifest);
  console.log(`Writing manifest to ${MANIFEST_PATH}`);
  await writeFile(MANIFEST_PATH, jsonManifest, { encoding: "utf-8" });
  console.log("Sucessfully written manifest.");
};

await checkManifest();
