import { resolve } from "node:path";

export const DEFAULT_MEDIA_ROOT = resolve("./src/content/media");
export const DEFAULT_PROJECT_ROOT = resolve(".");

export const SCAN_CONCURRENCY = 4;
export const SYNC_CONCURRENCY = 3;
export const IMAGE_LQIP_CONCURRENCY = 4;
export const VIDEO_LQIP_CONCURRENCY = 2;

/** Runs asynchronous work with a fixed concurrency limit. */
export const mapConcurrent = async <T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, runWorker),
  );
  return results;
};
