/**
 * Type guard to check if an unknown error object has a 'code' property.
 * This is useful for distinguishing specific types of errors, like those returned by Node.js APIs (e.g., `ENOENT`).
 * @param error - The unknown error object to check.
 * @returns True if the error is an object with a 'code' property, false otherwise.
 */
export const isErrorWithCode = (error: unknown): error is { code: string } => {
  return typeof error === "object" && error !== null && "code" in error;
};
