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
});

test("the tool submission action points to the repository issue template", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /issues\/new\?template=tool-submission\.md/);
  assert.match(html, /class="submit-tool"/);
});


test("the CLI Hub exposes 51 unique routes across 11 navigation groups", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const marker = "const pageDefinitions=";
  const start = html.indexOf(marker);
  const end = html.indexOf(".map(([id,title,group,description,status])=>", start);
  assert.ok(start >= 0 && end > start, "page definitions must remain a JSON-compatible route list");
  const pages = JSON.parse(html.slice(start + marker.length, end));
  assert.equal(pages.length, 51);
  assert.equal(new Set(pages.map(([id]) => id)).size, 51);
  assert.equal(new Set(pages.map(([, , group]) => group)).size, 11);
});

test("the CLI Hub keeps grouped navigation and browser history routing", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="main-nav"/);
  assert.match(html, /function buildNavigation\(/);
  assert.match(html, /history\.pushState\(/);
  assert.match(html, /addEventListener\("popstate"/);
  assert.match(html, /data-go-page/);
  assert.match(html, /drawer-open/);
});


test("local project workspace pages are implemented without a backend", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /function renderProjects\(/);
  assert.match(html, /function renderNewProject\(/);
  assert.match(html, /function renderDashboard\(/);
  assert.match(html, /function renderEnvironments\(/);
  assert.match(html, /function renderActivity\(/);
  assert.match(html, /ocodejs-cli-projects/);
  assert.match(html, /id="project-form"/);
  assert.match(html, /data-delete-project=/);
});

test("local project creation and deletion record browser-local activity", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /addEventListener\("submit"/);
  assert.match(html, /projects\.unshift\(project\)/);
  assert.match(html, /projects=projects\.filter/);
  assert.match(html, /recordWorkspaceEvent\("Project created"/);
  assert.match(html, /recordWorkspaceEvent\("Project deleted"/);
  assert.match(html, /ocodejs-cli-activity/);
});


test("home introduces community libraries with real brand marks and animated media", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /media\.giphy\.com\/media\/.+\/giphy\.gif/);
  assert.match(html, /cdn\.simpleicons\.org/);
  assert.match(html, /alt="'\+esc\(lib\.name\)\+' logo"/);
  assert.match(html, /communityLibraries=/);
  assert.match(html, /function renderLibraryCards\(/);
  assert.match(html, /function renderHome\(/);
});

test("community ranking uses npm last-month downloads and labels its scope", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /api\.npmjs\.org\/downloads\/point\/last-month/);
  assert.match(html, /sort\(\(a,b\)=>b\.downloads-a\.downloads\)/);
  assert.match(html, /last 30 days/);
  assert.match(html, /not a ranking of all npm packages|không phải bảng xếp hạng toàn bộ npm/i);
  assert.match(html, /https:\/\/www\.npmjs\.com\/package\//);
});


test("navigation exposes 50 unique pages across 11 groups", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const match = html.match(/const pageDefinitions=(\[[\s\S]*?\])\.map\(\(\[id,title,group,description,status\]\)/);
  assert.ok(match, "page definitions should be present");
  const pages = JSON.parse(match[1]);
  assert.equal(pages.length, 51);
  assert.equal(new Set(pages.map(page => page[0])).size, 51);
  assert.equal(new Set(pages.map(page => page[2])).size, 11);
  assert.match(html, /id="nav-search"/);
  assert.match(html, /function buildNavigation\(\)/);
  assert.match(html, /nav-search.*addEventListener/s);
  assert.match(html, /overflow-y:auto/);
});


test("library cards use official brand colors and logos", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const color of ["61DAFB", "FFFFFF", "646CFF", "3178C6", "06B6D4", "4FC08D", "FF3E00", "BC52EE", "5A67D8"]) {
    assert.ok(html.includes(color), "expected brand color " + color);
  }
  assert.match(html, /cdn\.simpleicons\.org/);
  assert.match(html, /official brand logo/);
});

test("Lucide icons are applied to navigation and tool cards", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /lucide@latest\/dist\/umd\/lucide\.min\.js/);
  assert.match(html, /data-lucide=.*routeLucideIcons/);
  assert.match(html, /data-lucide="\$\{toolLucideIcons\[t\.id\]/);
  assert.match(html, /function refreshIcons\(\)/);
  assert.match(html, /DOMContentLoaded,refreshIcons/);
  assert.match(html, /renderCatalog\(\);refreshIcons\(\)/);
});


test("Marketplace page links to official VS Code GitHub and Google catalogs", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /\["marketplace","Marketplace","Developer Hub"/);
  assert.match(html, /https:\/\/marketplace\.visualstudio\.com\/vscode/);
  assert.match(html, /https:\/\/github\.com\/marketplace/);
  assert.match(html, /https:\/\/console\.cloud\.google\.com\/marketplace/);
  assert.match(html, /marketplace-grid/);
  assert.match(html, /marketplace:"store"/);
  assert.match(html, /"marketplace"\]\?\.includes|marketplace.*quick access/i);
});


test("Home prompt composer saves requests into the local Agents queue", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="home-prompt-form"/);
  assert.match(html, /id="home-prompt-input"/);
  assert.match(html, /data-prompt-preset=/);
  assert.match(html, /function loadPromptQueue\(/);
  assert.match(html, /ocodejs-cli-prompt-queue/);
  assert.match(html, /setPage\("agents"\)/);
  assert.match(html, /Prompt queued/);
});

test("Agents queue exposes search, status, and export controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /function renderAgentQueue\(/);
  assert.match(html, /id="agent-queue-search"/);
  assert.match(html, /id="agent-queue-status"/);
  assert.match(html, /data-agent-status=/);
  assert.match(html, /data-agent-download=/);
  assert.match(html, /data-agent-export/);
  assert.match(html, /data-agent-remove=/);
});

test("Agents route is a valid JavaScript line and the app states execution limits", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /if\(view==="agents"\)\{renderAgentQueue\(\);return\}/);
  assert.equal(html.includes('\\n if(view==="agents")'), false);
  assert.match(html, /no code is generated or run yet/);
});

test("OCode.js keeps the pure-black surface and monochrome button systems", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="ocode-pure-black-surface-system"/);
  assert.match(html, /id="ocode-monochrome-button-system"/);
  assert.match(html, /--bg:#000000!important/);
  assert.match(html, /background:#ffffff!important/);
  assert.match(html, /background:#000000!important/);
});
