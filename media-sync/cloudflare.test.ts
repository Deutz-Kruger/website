import assert from "node:assert/strict";
import test from "node:test";

import { CloudflareMediaClient } from "./cloudflare";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("Images V2 inventory paginates and retries rate limits", async () => {
  const urls: string[] = [];
  let calls = 0;
  const client = new CloudflareMediaClient({
    accountId: "account",
    apiToken: "token",
    sleep: async () => {},
    fetch: async (input) => {
      calls += 1;
      const url = input.toString();
      urls.push(url);
      if (calls === 1) {
        return jsonResponse(
          { success: false, errors: [{ code: 10000, message: "rate" }] },
          429,
        );
      }
      if (!url.includes("continuation_token")) {
        return jsonResponse({
          success: true,
          result: {
            continuation_token: "next",
            images: [{ id: "one", creator: "creator" }],
          },
        });
      }
      return jsonResponse({
        success: true,
        result: { images: [{ id: "two", creator: "creator" }] },
      });
    },
  });

  const images = await client.listImages("creator");
  assert.deepEqual(
    images.map((image) => image.id),
    ["one", "two"],
  );
  assert.equal(calls, 3);
  assert.match(urls[1], /creator=creator/);
  assert.match(urls[2], /continuation_token=next/);
});

test("Cloudflare client rejects malformed success envelopes", async () => {
  const client = new CloudflareMediaClient({
    accountId: "account",
    apiToken: "token",
    fetch: async () => jsonResponse({ success: true }),
  });

  await assert.rejects(client.listImages(), /Cloudflare API error/);
});

test("Stream inventory accepts include_counts response wrapper", async () => {
  const client = new CloudflareMediaClient({
    accountId: "account",
    apiToken: "token",
    fetch: async () =>
      jsonResponse({
        success: true,
        result: {
          range: 1,
          total: 1,
          videos: [
            {
              uid: "video",
              creator: "creator",
              readyToStream: true,
              status: { state: "ready" },
            },
          ],
        },
      }),
  });

  const videos = await client.listVideos("creator");
  assert.deepEqual(
    videos.map((video) => video.id),
    ["video"],
  );
});

test("Cloudflare client retries idempotent network failures", async () => {
  let calls = 0;
  const client = new CloudflareMediaClient({
    accountId: "account",
    apiToken: "token",
    sleep: async () => {},
    fetch: async () => {
      calls += 1;
      if (calls < 3) throw new Error("temporary network error");
      return jsonResponse({ success: true, result: { images: [] } });
    },
  });

  assert.deepEqual(await client.listImages(), []);
  assert.equal(calls, 3);
});

test("Stream wait polls pending video until ready", async () => {
  let calls = 0;
  const client = new CloudflareMediaClient({
    accountId: "account",
    apiToken: "token",
    sleep: async () => {},
    fetch: async () => {
      calls += 1;
      return jsonResponse({
        success: true,
        result: {
          uid: "video",
          readyToStream: calls > 1,
          status: { state: calls > 1 ? "ready" : "inprogress" },
        },
      });
    },
  });

  const video = await client.waitForVideoReady("video", {
    intervalMs: 0,
    timeoutMs: 1000,
  });
  assert.equal(video.status, "ready");
  assert.equal(calls, 2);
});

test("Stream wait rejects encoding errors and timeouts", async () => {
  const errorClient = new CloudflareMediaClient({
    accountId: "account",
    apiToken: "token",
    fetch: async () =>
      jsonResponse({
        success: true,
        result: {
          uid: "video",
          readyToStream: false,
          status: { state: "error" },
        },
      }),
  });
  await assert.rejects(
    errorClient.waitForVideoReady("video"),
    /encoding failed/,
  );

  const timeoutClient = new CloudflareMediaClient({
    accountId: "account",
    apiToken: "token",
    fetch: async () => {
      throw new Error("should not fetch after expired deadline");
    },
  });
  await assert.rejects(
    timeoutClient.waitForVideoReady("video", { timeoutMs: -1 }),
    /Timed out/,
  );
});
