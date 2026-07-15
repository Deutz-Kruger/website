import assert from "node:assert/strict";
import test from "node:test";

import {
  renderSafeMarkdown,
  serializeJsonLd,
} from "../src/utils/contentSecurity";

test("renderSafeMarkdown removes raw HTML and unsafe links", () => {
  const rendered = renderSafeMarkdown(`
# Safe heading

<script>alert("xss")</script>

[unsafe](javascript:alert%281%29)
[protocol relative](//example.com/path)
[safe](https://example.com/path?q=1&value=2)
[email](mailto:hi@example.com)
  `);

  assert.match(rendered, /<h1>Safe heading<\/h1>/);
  assert.doesNotMatch(rendered, /<script|alert\("xss"\)/i);
  assert.doesNotMatch(rendered, /href="javascript:|href="\/\//i);
  assert.match(
    rendered,
    /href="https:\/\/example\.com\/path\?q=1&amp;value=2"/,
  );
  assert.match(rendered, /href="mailto:hi@example\.com"/);
});

test("renderSafeMarkdown does not render Markdown images", () => {
  const rendered = renderSafeMarkdown(
    `![safe alt](https://example.com/image.png "title")`,
  );

  assert.equal(rendered.trim(), "<p>safe alt</p>");
});

test("serializeJsonLd cannot terminate its script element", () => {
  const serialized = serializeJsonLd({
    description: "</script><script>alert(1)</script>",
  });

  assert.doesNotMatch(serialized, /<\/script>/i);
  assert.match(serialized, /\\u003c\/script>/);
  assert.deepEqual(JSON.parse(serialized), {
    description: "</script><script>alert(1)</script>",
  });
});
