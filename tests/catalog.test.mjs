import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCatalog } from "../scripts/validate.mjs";

const validTool = {
  id: "sample-tool",
  name: "sample-tool",
  description: "A sample CLI tool.",
  language: "Rust",
  category: "Developer tools",
  install: "cargo install sample-tool",
  repo: "https://github.com/example/sample-tool"
};

test("the checked-in catalog is valid and has unique entries", async () => {
  const catalog = JSON.parse(await readFile(new URL("../tools.json", import.meta.url), "utf8"));
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(catalog.length >= 8);
});

test("rejects a non-array catalog", () => {
  assert.match(validateCatalog({})[0], /JSON array/);
});

test("rejects missing required fields", () => {
  const errors = validateCatalog([{ id: "missing-fields" }]);
  assert.ok(errors.some(error => error.includes('"name"')));
  assert.ok(errors.some(error => error.includes('"install"')));
});

test("rejects duplicate and reserved IDs", () => {
  const errors = validateCatalog([validTool, { ...validTool }, { ...validTool, id: "submit" }]);
  assert.ok(errors.some(error => error.includes("duplicate id")));
  assert.ok(errors.some(error => error.includes('id "submit" is reserved')));
});

test("rejects unsafe repository URLs", () => {
  const errors = validateCatalog([{ ...validTool, repo: "javascript:alert(1)" }]);
  assert.ok(errors.some(error => error.includes("valid HTTPS URL")));
});

test("rejects repository URLs with embedded credentials", () => {
  const errors = validateCatalog([{ ...validTool, repo: "https://user:pass@example.com/repo" }]);
  assert.ok(errors.some(error => error.includes("embedded credentials")));
});

test("rejects multiline install commands", () => {
  const errors = validateCatalog([{ ...validTool, install: "npm install\necho unsafe" }]);
  assert.ok(errors.some(error => error.includes("single-line command")));
});

test("rejects invalid IDs", () => {
  const errors = validateCatalog([{ ...validTool, id: "Bad_ID" }]);
  assert.ok(errors.some(error => error.includes("lowercase letters")));
});

test("the CLI Hub keeps its monospace, square-corner visual system", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /--mono\s*:\s*ui-monospace/);
  assert.match(html, /body\s*\{[^}]*font:[^}]*var\(--mono\)/s);
  assert.match(html, /\.btn\s*\{[^}]*border-radius:\s*0/s);
  assert.match(html, /\.searchbox,\.filter,\.search-submit\s*\{[^}]*border-radius:\s*0/s);
  assert.match(html, /button,\[role="button"\],input\[type="button"\],input\[type="submit"\],input\[type="reset"\].*?\{border-radius:\s*0!important\}/s);
});

test("the tool submission action points to the repository issue template", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /issues\/new\?template=tool-submission\.md/);
  assert.match(html, /class="submit-tool"/);
});
