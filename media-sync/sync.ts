// TODO: Implement manifest updating
// TODO: Implement deletion detection

import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { glob } from "glob";
import { type z } from "zod";

import { deleteMedia, uploadMedia } from "./cloudflare";
import { generateMetaData } from "./file-utils";
import { isErrorWithCode } from "./guards";
import { manifestSchema, manifestValueSchema, type MediaType } from "./schema";

type Manifest = z.infer<typeof manifestSchema>;
export type ManifestEntry = z.infer<typeof manifestValueSchema>;

interface SyncContext {
  manifest: Manifest;
  hasChanged: boolean;
}

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
      console.log("⚠️ Manifest not found. A new one will be created.");
    } else {
      console.warn(
        "⚠️ An error occurred while reading or parsing manifest.json. Starting fresh.",
      );
      if (error instanceof Error) {
        console.error("❗ Details:", error.message, "\n");
      } else {
        console.error("❗ Caught an unknown error type:", error);
      }
    }
  }
  return {};
};

/**
 * Retrieves a list of all media file paths relative to the project root.
 * @returns A promise that resolves to an array of relative file paths.
 */
const getLocalMediaPaths = async (): Promise<string[]> => {
  const absolutePaths = await glob(`${MEDIA_PATH}/**`, { nodir: true });
  const relativePaths = absolutePaths.map((absPath) => relative(ROOT, absPath));
  return relativePaths;
};

const getManifestPaths = (manifest: Manifest) => {
  return Object.keys(manifest);
};

export const syncMedia = async () => {
  const manifest = await getManifest();
  const localPaths = await getLocalMediaPaths();

  let syncContext: SyncContext = {
    manifest,
    hasChanged: false,
  };

  try {
    syncContext = await handleDeleted(syncContext, localPaths);
    syncContext = await handleAddedAndUpdated(syncContext, localPaths);
  } catch (error) {
    console.log("--- ❗ SYNC FAILED ---");
    console.log("The process was stopped due to a critical error:");
    console.error(error);
  }

  if (syncContext.hasChanged) {
    console.log("Changes detected. Writing to manifest...");
    await writeManifest(syncContext.manifest);
  } else {
    console.log("No changes detected.");
  }
  console.log("Sync Complete ✅");
};

const handleDeleted = async (context: SyncContext, localPaths: string[]) => {
  console.log("Checking for deletions... 🔍");
  const manifestPaths = getManifestPaths(context.manifest);
  const localPathsSet = new Set(localPaths);

  for (const path of manifestPaths) {
    if (!localPathsSet.has(path)) {
      console.log("Found delted file...");
      await deleteUploadedMedia(
        context.manifest[path].id,
        context.manifest[path].type,
      );
      console.log("File sucessfully deleted ❌");
      delete context.manifest[path];
      context.hasChanged = true;
    }
  }
  return context;
};

const handleAddedAndUpdated = async (
  context: SyncContext,
  localPaths: string[],
) => {
  console.log(
    `Checking for new and updated files 🔍.\nFound ${localPaths.length} local media files.`,
  );

  const manifest = context.manifest;

  for (const path of localPaths) {
    console.log(`############# Checking ${path}: #############\n`);

    const { hash, mediaType, width, height } = await generateMetaData(path);

    if (mediaType === "unknown") {
      console.error(
        `⚠️ Invalid media type. Media typ: ${mediaType}.\nSkipping...`,
      );
      continue;
    }

    const manifestEntry = manifest[path];

    if (manifestEntry) {
      const modified = isModified(manifestEntry.hash, hash);

      if (modified) {
        await deleteUploadedMedia(manifestEntry.id, manifestEntry.type);
      } else {
        continue;
      }
    }

    console.log(`Uploading ${path}...`);

    const uploadResponse = await uploadMedia(path, mediaType);

    if (!uploadResponse) {
      throw new Error(`❗ Upload for ${path} failed`);
    }

    console.log("✅ File sucessfully uploaded");

    const entry = generateMediaEntry(
      uploadResponse.id,
      mediaType,
      hash,
      width,
      height,
    );

    console.log("Updating manifest...");

    context.manifest[path] = entry;
    context.hasChanged = true;
  }
  return context;
};

const isModified = (manifestHash: string, localHash: string) => {
  if (manifestHash !== localHash) {
    console.log(`Modified file detected.`);
    return true;
  }
  return false;
};

const generateMediaEntry = (
  mediaId: string,
  mediaType: MediaType,
  hash: string,
  width?: number,
  height?: number,
): ManifestEntry => {
  const entry = {
    id: mediaId,
    type: mediaType,
    createdAt: new Date().toISOString(),
    hash: hash,
    width: width,
    height: height,
  };
  return entry;
};

const deleteUploadedMedia = async (mediaId: string, mediaType: MediaType) => {
  try {
    await deleteMedia(mediaId, mediaType);
    console.log(`✅ Sucessfully deleted  ${mediaType}: ${mediaId}`);
  } catch (error) {
    throw new Error(
      `❗ Error while deleting ${mediaType}: ${mediaId}\n Error: ${error}`,
    );
  }
};

/**
 * Writes the given manifest object to the manifest.json file.
 * @param manifest - The manifest object to write.
 */
export const writeManifest = async (manifest: Manifest) => {
  const jsonManifest = JSON.stringify(manifest);
  console.log(`Writing manifest to ${MANIFEST_PATH}`);
  await writeFile(MANIFEST_PATH, jsonManifest, { encoding: "utf-8" });
  console.log("Sucessfully written manifest.");
};

syncMedia();
