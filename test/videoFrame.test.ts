import assert from "node:assert/strict";
import test from "node:test";

import { onNextPresentedVideoFrame } from "../src/scripts/video-frame";

test("video reveal waits for a presented frame and can be cancelled", () => {
  let frameCallback: (() => void) | null = null;
  let cancelledCallbackId: number | null = null;
  let revealed = false;

  const video = {
    cancelVideoFrameCallback(callbackId: number) {
      cancelledCallbackId = callbackId;
    },
    requestVideoFrameCallback(callback: () => void) {
      frameCallback = callback;
      return 42;
    },
  } as unknown as HTMLVideoElement;

  const cancel = onNextPresentedVideoFrame(video, () => {
    revealed = true;
  });

  assert.equal(revealed, false);
  assert.ok(frameCallback);

  (frameCallback as () => void)();
  assert.equal(revealed, true);

  cancel();
  assert.equal(cancelledCallbackId, 42);
});
