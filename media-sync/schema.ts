// TODO: Add metadata to manifestValueSchema

import { z } from "zod";

/**
 * Represents the possible media types supported by the synchronization process.
 */
export type MediaType = "image" | "video" | "unknown";

/**
 * An array of valid media types that can be stored in the manifest.
 */
export const VALID_MEDIA_TYPES: MediaType[] = ["image", "video"] as const;

/**
 * Zod schema for a single entry in the media manifest.
 * @property id - The unique identifier of the media on the remote service (e.g., Cloudflare).
 * @property type - The type of media, restricted to 'image' or 'video'.
 * @property createdAt - The ISO string timestamp when the media was uploaded/processed.
 * @property hash - The XXH64 hash of the media file content.
 */
export const manifestValueSchema = z.object({
  id: z.string(),
  type: z.enum(VALID_MEDIA_TYPES),
  createdAt: z.string(),
  hash: z.string(),
});

/**
 * Zod schema for the entire media manifest.
 * It's a record where keys are file paths (strings) and values are `manifestValueSchema` objects.
 */
export const manifestSchema = z.record(z.string(), manifestValueSchema);
