import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple CSS class names, resolving Tailwind CSS conflicts.
 * It uses `clsx` for conditional class joining and `tailwind-merge` for intelligently merging Tailwind classes.
 *
 * @param inputs - An array of `ClassValue` (strings, objects, arrays, or booleans) to be combined.
 * @returns A single string containing the merged and resolved Tailwind class names.
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};
