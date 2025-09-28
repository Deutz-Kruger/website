import path from "node:path";

import type { casePreviewSchema } from "@content/config.ts";
import { type CollectionEntry, getEntries, z } from "astro:content";

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
