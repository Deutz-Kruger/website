import assert from "node:assert/strict";
import test from "node:test";

import { indexMediaBlocks, indexMediaGroups } from "../src/utils/mediaOrder";
import { buildVideoPosterSources } from "../src/utils/videoPoster";

test("video poster sources are responsive, ordered, and aspect-correct", () => {
  const sources = buildVideoPosterSources(
    {
      id: "video/id",
      type: "video",
      width: 1920,
      height: 1080,
    },
    "/src/content/media/video.mp4",
  );

  assert.equal(sources.width, 1920);
  assert.equal(sources.height, 1080);
  assert.match(sources.src, /video%2Fid/);
  assert.match(sources.src, /width=1280&height=720$/);
  assert.deepEqual(
    [...sources.srcset.matchAll(/width=(\d+)&height=(\d+) [^,]+/g)].map(
      ([, width, height]) => [Number(width), Number(height)],
    ),
    [
      [480, 270],
      [768, 432],
      [1280, 720],
    ],
  );
  assert.match(sources.srcset, / 480w, .* 768w, .* 1280w$/);
});

test("video poster sources reject image manifest entries", () => {
  assert.throws(
    () =>
      buildVideoPosterSources(
        {
          id: "image-id",
          type: "image",
          width: 100,
          height: 50,
        },
        "/src/content/media/image.png",
      ),
    /Expected video media.*received "image"/,
  );
});

test("media ordering tracks the first image independently across groups", () => {
  const groups = [
    {
      blocks: [
        { _block: "text", id: "intro" },
        { _block: "video", id: "hero-video" },
        { _block: "image", id: "first-image" },
      ],
    },
    {
      blocks: [
        { _block: "text", id: "copy" },
        { _block: "image", id: "second-image" },
        { _block: "video", id: "second-video" },
      ],
    },
  ];

  const indexedGroups = indexMediaGroups(groups);
  assert.deepEqual(
    indexedGroups.map(({ mediaStartIndex, imageStartIndex }) => ({
      mediaStartIndex,
      imageStartIndex,
    })),
    [
      { mediaStartIndex: 0, imageStartIndex: 0 },
      { mediaStartIndex: 2, imageStartIndex: 1 },
    ],
  );

  const firstGroupBlocks = indexMediaBlocks(
    indexedGroups[0].group.blocks,
    indexedGroups[0].mediaStartIndex,
    indexedGroups[0].imageStartIndex,
  );
  const secondGroupBlocks = indexMediaBlocks(
    indexedGroups[1].group.blocks,
    indexedGroups[1].mediaStartIndex,
    indexedGroups[1].imageStartIndex,
  );

  assert.equal(firstGroupBlocks[1].mediaIndex, 0);
  assert.equal(firstGroupBlocks[2].mediaIndex, 1);
  assert.equal(firstGroupBlocks[2].imageIndex, 0);
  assert.equal(secondGroupBlocks[1].mediaIndex, 2);
  assert.equal(secondGroupBlocks[1].imageIndex, 1);
  assert.equal(secondGroupBlocks[2].mediaIndex, 3);
});
