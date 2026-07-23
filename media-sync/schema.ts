import { z } from "zod";

export const MEDIA_CREATOR = "deutz-krueger-portfolio";
export const MEDIA_SCHEMA_VERSION = "1";
export const MANIFEST_SCHEMA_VERSION = "2";
export const LQIP_MAX_DIMENSION = 32;
export const LQIP_MAX_DATA_URI_LENGTH = 4 * 1024;

export const mediaTypeSchema = z.enum(["image", "video"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

export const lqipSchema = z.object({
  src: z
    .string()
    .max(LQIP_MAX_DATA_URI_LENGTH)
    .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/),
  width: z.number().int().positive().max(LQIP_MAX_DIMENSION),
  height: z.number().int().positive().max(LQIP_MAX_DIMENSION),
  hasAlpha: z.boolean(),
});
export type Lqip = z.infer<typeof lqipSchema>;

const validateLqipDimensions = (
  source: { width: number; height: number; lqip: Lqip },
  context: z.RefinementCtx,
) => {
  const scale = Math.min(
    LQIP_MAX_DIMENSION / source.width,
    LQIP_MAX_DIMENSION / source.height,
    1,
  );
  const expectedWidth = Math.max(1, Math.round(source.width * scale));
  const expectedHeight = Math.max(1, Math.round(source.height * scale));
  if (
    source.lqip.width !== expectedWidth ||
    source.lqip.height !== expectedHeight
  ) {
    context.addIssue({
      code: "custom",
      message: `LQIP dimensions must be ${expectedWidth}x${expectedHeight}`,
      path: ["lqip"],
    });
  }
};

export const manifestValueSchema = z
  .object({
    id: z.string().min(1),
    type: mediaTypeSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    lqip: lqipSchema,
  })
  .superRefine(validateLqipDimensions);
export type ManifestEntry = z.infer<typeof manifestValueSchema>;

export const manifestSchema = z.object({
  schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  entries: z.record(z.string(), manifestValueSchema),
});
export type Manifest = z.infer<typeof manifestSchema>;

export const managedMetadataSchema = z.object({
  schemaVersion: z.literal(MEDIA_SCHEMA_VERSION),
  sourcePath: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  staleSince: z.iso.datetime().optional(),
});
export type ManagedMetadata = z.infer<typeof managedMetadataSchema>;

export const localMediaFileSchema = z
  .object({
    absolutePath: z.string().min(1),
    sourcePath: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    type: mediaTypeSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    duration: z.number().positive().optional(),
    lqip: lqipSchema,
  })
  .superRefine(validateLqipDimensions);
export type LocalMediaFile = z.infer<typeof localMediaFileSchema>;

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
