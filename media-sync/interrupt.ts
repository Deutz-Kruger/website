const FORCE_INTERRUPT_DELAY_MS = 2000;

export interface InterruptHandlerOptions {
  forceExit(): void;
  now?: () => number;
  pause(): void;
  writeError(message: string): void;
  writeInfo(message: string): void;
}

/**
 * Handles duplicate SIGINT delivery from terminal process groups and pnpm.
 * A later, deliberate interrupt still provides a force-exit escape hatch.
 */
export const createInterruptHandler = (
  options: InterruptHandlerOptions,
): (() => void) => {
  const now = options.now ?? Date.now;
  let pauseRequestedAt: number | undefined;

  return () => {
    const currentTime = now();
    if (pauseRequestedAt === undefined) {
      pauseRequestedAt = currentTime;
      options.writeInfo(
        "\nPause requested\n  Finishing in-flight requests and saving the checkpoint...",
      );
      options.pause();
      return;
    }

    if (currentTime - pauseRequestedAt < FORCE_INTERRUPT_DELAY_MS) return;

    options.writeError(
      "\nForced exit\n  The latest completed checkpoint remains reusable.",
    );
    options.forceExit();
  };
};
