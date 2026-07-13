import { z } from "zod";

export const MEDIA_CREATOR = "deutz-krueger-portfolio";
export const MEDIA_SCHEMA_VERSION = "1";

export const mediaTypeSchema = z.enum(["image", "video"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

export const manifestValueSchema = z.object({
  id: z.string().min(1),
  type: mediaTypeSchema,
  width: z.number().positive(),
  height: z.number().positive(),
});
export type ManifestEntry = z.infer<typeof manifestValueSchema>;

export const manifestSchema = z.record(z.string(), manifestValueSchema);
export type Manifest = z.infer<typeof manifestSchema>;

export const managedMetadataSchema = z.object({
  schemaVersion: z.literal(MEDIA_SCHEMA_VERSION),
  sourcePath: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  staleSince: z.iso.datetime().optional(),
});
export type ManagedMetadata = z.infer<typeof managedMetadataSchema>;

export interface LocalMediaFile {
  absolutePath: string;
  sourcePath: string;
  sha256: string;
  type: MediaType;
  width: number;
  height: number;
  duration?: number;
}

export interface RemoteMedia {
  id: string;
  type: MediaType;
  creator?: string;
  filename?: string;
  uploaded?: string;
  metadata?: unknown;
  readyToStream?: boolean;
  status?: string;
}

export const legacyAuditCandidateSchema = z.object({
  id: z.string().min(1),
  type: mediaTypeSchema,
  filename: z.string().min(1),
  uploaded: z.string().optional(),
  matchingSourcePaths: z.array(z.string().min(1)).min(1),
});
export type LegacyAuditCandidate = z.infer<typeof legacyAuditCandidateSchema>;

export const legacyAuditReportSchema = z.object({
  generatedAt: z.iso.datetime(),
  candidates: z.array(legacyAuditCandidateSchema),
});
export type LegacyAuditReport = z.infer<typeof legacyAuditReportSchema>;

export const legacyCleanupStatusSchema = z.enum([
  "deleted",
  "missing",
  "protected",
  "tagged",
  "filename-mismatch",
  "type-mismatch",
  "failed",
]);
export type LegacyCleanupStatus = z.infer<typeof legacyCleanupStatusSchema>;

export const legacyCleanupResultItemSchema = z.object({
  id: z.string().min(1),
  type: mediaTypeSchema,
  status: legacyCleanupStatusSchema,
  message: z.string().optional(),
});
export type LegacyCleanupResultItem = z.infer<
  typeof legacyCleanupResultItemSchema
>;

export const legacyCleanupResultSchema = z.object({
  schemaVersion: z.literal("1"),
  reportSha256: z.string().regex(/^[a-f0-9]{64}$/),
  reportGeneratedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  results: z.array(legacyCleanupResultItemSchema),
});
export type LegacyCleanupResult = z.infer<typeof legacyCleanupResultSchema>;
