import path from "node:path";

import type { casePreviewSchema } from "@content/config.ts";
import { type CollectionEntry, getEntries, getEntry, z } from "astro:content";

export interface PageMetaData {
  /**
   * The title of the page.
   */
  title: string;
  /**
   * The description of the page.
   */
  description: string;
  /**
   * The URL of the page.
   */
  url: string;
}

export interface LegalData {
  /**
   * Data related to the impressum (legal notice).
   */
  impressum: {
    title: string;
    body: string;
  };
  /**
   * Data related to the privacy policy.
   */
  privacy: {
    title: string;
    body: string;
  };
}

export type CasePaths = z.infer<typeof casePreviewSchema>;

/**
 * Extracts slugs from an array of file paths.
 *
 * @remarks
 * This function is typically used with paths obtained from `casePreviewSchema`
 * which are expected to be file paths like "path/to/file.json".
 * It removes the directory and file extension, returning just the base name.
 *
 * Given an array of file paths (e.g., ["path/to/file1.json", "path/to/file2.json"]),
 * this function returns an array of their base names without the extension (e.g., ["file1", "file2"]).
 * If the input array is empty or null, an empty array is returned.
 *
 * @param paths - An array of file paths, typically from `casePreviewSchema`.
 * @returns An array of extracted slugs (file names without extensions).
 */
export const extractSlugsFromPaths = (paths: CasePaths): string[] => {
  if (!paths?.length) return [];
  return paths.map((filePath) => path.basename(filePath, ".json"));
};

/**
 * Resolves an array of case IDs into their corresponding Astro collection entries.
 *
 * This function takes an array of string IDs, which are expected to correspond to entries
 * in the "cases" collection, and fetches the full collection entries for them.
 * If the input array is empty or null, it returns a promise that resolves to an empty array.
 *
 * @param ids - An array of string IDs for case entries.
 * @returns A promise that resolves to an array of `CollectionEntry<"cases">`.
 */
export const resolveCasePreview = (
  ids: string[],
): Promise<CollectionEntry<"cases">[]> => {
  if (!ids?.length) {
    return Promise.resolve([]);
  }
  return getEntries(ids.map((id) => ({ collection: "cases" as const, id })));
};

/**
 * Fetches the global settings data from the Astro content collection.
 *
 * This function retrieves the single entry named "settings" from the "settings" collection.
 * It throws an error if the settings data cannot be found.
 *
 * @returns A promise that resolves to the `CollectionEntry<"settings">` object.
 * @throws {Error} If the settings data cannot be fetched.
 */
export const getSettingsData = async (): Promise<
  CollectionEntry<"settings">
> => {
  const settingsData = await getEntry("settings", "settings");
  if (!settingsData) {
    throw new Error("Settings couldn't be fetched");
  }
  return settingsData;
};

/**
 * Retrieves page metadata (title, description, URL) from the global settings.
 *
 * This function asynchronously fetches the settings data and extracts the
 * `title`, `description`, and `url` properties to form a `PageMetaData` object.
 *
 * @returns A promise that resolves to a `PageMetaData` object.
 */
export const getPageMetaData = async (): Promise<PageMetaData> => {
  const settingsData = await getSettingsData();
  const { title, description, url } = settingsData.data;
  return { title, description, url };
};

/**
 * Retrieves legal data (impressum and privacy policy) from the global settings.
 *
 * This function asynchronously fetches the settings data and extracts the `legal` property.
 *
 * @returns A promise that resolves to a `LegalData` object.
 */
export const getLegalData = async (): Promise<LegalData> => {
  const settingsData = await getSettingsData();
  const { legal } = settingsData.data;
  return legal;
};
