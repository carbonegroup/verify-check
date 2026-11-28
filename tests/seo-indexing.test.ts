import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("the sitemap exposes only the public VerifyCheck homepage", () => {
  const sitemap = read("src/app/sitemap.ts");

  assert.match(sitemap, /url:\s*siteUrl/);
  assert.doesNotMatch(sitemap, /login|dashboard|scanner|\/api\//i);
});

test("robots.txt references the sitemap and excludes API crawling", () => {
  const robots = read("src/app/robots.ts");

  assert.match(robots, /sitemap\.xml/);
  assert.match(robots, /disallow:\s*\["\/api\/"\]/);
  assert.match(robots, /allow:\s*"\/"|allow:\s*'\/'/);
});

test("operational and authentication pages are marked noindex", () => {
  const privatePages = [
    "src/app/login/page.tsx",
    "src/app/dashboard/page.tsx",
    "src/app/auth/complete/page.tsx",
  ];

  for (const path of privatePages) {
    assert.match(read(path), /index:\s*false/);
    assert.match(read(path), /follow:\s*false/);
  }

  assert.match(read("public/scanner/index.html"), /name="robots" content="noindex,nofollow"/);
});

test("the homepage declares the selected canonical URL and WebSite data", () => {
  const home = read("src/app/page.tsx");

  assert.match(home, /canonical:\s*"\/"/);
  assert.match(home, /https:\/\/verify-check-one\.vercel\.app\//);
  assert.match(home, /"@type":\s*"WebSite"/);
});
