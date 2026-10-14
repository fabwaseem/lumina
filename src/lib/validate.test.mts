import assert from "node:assert/strict";
import test from "node:test";
import {
  clampInt,
  isCivitaiAssetUrl,
  isHttpUrl,
  isModelHash,
  isPromptId,
  isSafeComfyName,
  normalizeApiKey,
  parsePositiveInt,
  sanitizeFilename,
  sanitizeFilters,
  sanitizeSaveFolder,
} from "./validate.ts";

const fallback = {
  query: "",
  sort: "Newest" as const,
  period: "AllTime" as const,
  nsfwLevel: "None" as const,
};

test("isHttpUrl accepts ComfyUI loopback and rejects other schemes", () => {
  assert.equal(isHttpUrl("http://127.0.0.1:8188"), true);
  assert.equal(isHttpUrl("https://example.com/path"), true);
  assert.equal(isHttpUrl("file:///etc/passwd"), false);
  assert.equal(isHttpUrl("http://user:pass@127.0.0.1"), false);
  assert.equal(isHttpUrl("not a url"), false);
});

test("isCivitaiAssetUrl only allows https civitai hosts", () => {
  assert.equal(
    isCivitaiAssetUrl("https://image.civitai.com/x/width=450/photo.jpeg"),
    true,
  );
  assert.equal(isCivitaiAssetUrl("http://image.civitai.com/a.png"), false);
  assert.equal(isCivitaiAssetUrl("https://evil.civitai.com.attacker.test/a"), false);
});

test("hashes, prompt ids, and filenames are constrained", () => {
  assert.equal(isModelHash("ABCDEF1234"), true);
  assert.equal(isModelHash("../secret"), false);
  assert.equal(isPromptId("abc-123_DEF"), true);
  assert.equal(isPromptId("id/../../x"), false);
  assert.equal(isSafeComfyName("image.png"), true);
  assert.equal(isSafeComfyName("../image.png"), false);
  assert.equal(sanitizeFilename("../../lora.safetensors"), "lora.safetensors");
  assert.equal(sanitizeFilename(".."), "download");
});

test("numeric and secret inputs are bounded", () => {
  assert.equal(parsePositiveInt("42"), 42);
  assert.equal(parsePositiveInt(0), null);
  assert.equal(parsePositiveInt("1.5"), null);
  assert.equal(clampInt("nope", 1, 10, 3), 3);
  assert.equal(clampInt(99, 1, 10, 3), 10);
  assert.equal(normalizeApiKey("  abc123  "), "abc123");
  assert.equal(normalizeApiKey("bad key"), null);
  assert.equal(normalizeApiKey(""), "");
});

test("filters and save folders drop unsafe values", () => {
  const filters = sanitizeFilters(
    {
      query: "  cat\u0000 ",
      sort: "Nope" as never,
      period: "Week",
      nsfwLevel: "Soft",
      username: " artist ",
      modelId: -4,
      baseModels: ["SDXL 1.0", "", 4 as never],
    },
    fallback,
  );
  assert.equal(filters.query, "cat");
  assert.equal(filters.sort, "Newest");
  assert.equal(filters.period, "Week");
  assert.equal(filters.username, "artist");
  assert.equal(filters.modelId, undefined);
  assert.deepEqual(filters.baseModels, ["SDXL 1.0"]);
  assert.equal(sanitizeSaveFolder("../output"), undefined);
  assert.equal(sanitizeSaveFolder("ZIT"), "ZIT");
});
