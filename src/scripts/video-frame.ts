type VideoWithFrameCallbacks = HTMLVideoElement & {
  cancelVideoFrameCallback?: (callbackId: number) => void;
  requestVideoFrameCallback?: (callback: () => void) => number;
};

/**
 * Runs a callback once the browser has presented a decoded video frame.
 * Falls back to two animation frames for browsers without the video-frame API.
 */
export function onNextPresentedVideoFrame(
  video: HTMLVideoElement,
  callback: () => void,
): () => void {
  const videoWithFrameCallbacks = video as VideoWithFrameCallbacks;

  if (videoWithFrameCallbacks.requestVideoFrameCallback) {
    const callbackId =
      videoWithFrameCallbacks.requestVideoFrameCallback(callback);

    return () => {
      videoWithFrameCallbacks.cancelVideoFrameCallback?.(callbackId);
    };
  }

  let secondAnimationFrame: number | null = null;
  const firstAnimationFrame = requestAnimationFrame(() => {
    secondAnimationFrame = requestAnimationFrame(callback);
  });

  return () => {
    cancelAnimationFrame(firstAnimationFrame);
    if (secondAnimationFrame !== null) {
      cancelAnimationFrame(secondAnimationFrame);
    }
  };
}
