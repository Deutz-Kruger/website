import { z } from "zod";

export type MediaType = "image" | "video" | "unknown";

export const VALID_MEDIA_TYPES: MediaType[] = ["image", "video"] as const;

export const manifestValueSchema = z.object({
  id: z.string(),
  type: z.enum(VALID_MEDIA_TYPES),
  createdAt: z.string(),
  hash: z.string(),
});

export const manifestSchema = z.record(z.string(), manifestValueSchema);
