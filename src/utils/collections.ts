import path from "node:path";

import type { casePreviewSchema } from "@content/config.ts";
import { type CollectionEntry, getEntries, getEntry, z } from "astro:content";

export interface PageMetaData {
  title: string;
  description: string;
  url: string;
}

export interface LegalData {
  impressum: {
    title: string;
    body: string;
  };
  privacy: {
    title: string;
    body: string;
  };
}

export type CasePaths = z.infer<typeof casePreviewSchema>;

export const extractSlugsFromPaths = (paths: CasePaths): string[] => {
  if (!paths?.length) return [];
  return paths.map((filePath) => path.basename(filePath, ".json"));
};

export const resolveCasePreview = (
  ids: string[],
): Promise<CollectionEntry<"cases">[]> => {
  if (!ids?.length) {
    return Promise.resolve([]);
  }
  return getEntries(ids.map((id) => ({ collection: "cases" as const, id })));
};

export const getSettingsData = async (): Promise<
  CollectionEntry<"settings">
> => {
  const settingsData = await getEntry("settings", "settings");
  if (!settingsData) {
    throw new Error("Settings couldn't be fetched");
  }
  return settingsData;
};

export const getPageMetaData = async (): Promise<PageMetaData> => {
  const settingsData = await getSettingsData();
  const { title, description, url } = settingsData.data;
  return { title, description, url };
};

export const getLegalData = async (): Promise<LegalData> => {
  const settingsData = await getSettingsData();
  const { legal } = settingsData.data;
  return legal;
};
