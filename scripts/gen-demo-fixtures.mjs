// Snapshots a live Browserr instance into static JSON fixtures for the public
// demo build. Run against a dev server that has a real TMDB key configured:
//
//   node scripts/gen-demo-fixtures.mjs            (defaults to 127.0.0.1:3000)
//   BASE=http://localhost:3000 node scripts/gen-demo-fixtures.mjs
//
// Only public TMDB catalog data is captured - no secrets, no Seerr data.
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const OUT = "public/demo";

const getJson = async (path) => {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
};

mkdirSync(`${OUT}/titles`, { recursive: true });

const home = await getJson("/api/home");
writeFileSync(`${OUT}/home.json`, JSON.stringify(home));

// Capture detail for the hero slides + the first few cards of every rail so the
// most-clicked titles open with real cast/trailer/"more like this" data.
const targets = new Map();
for (const slide of home.hero) targets.set(`${slide.item.mediaType}:${slide.item.id}`, slide.item);
for (const rail of home.rails) {
  for (const item of rail.items.slice(0, 4)) targets.set(`${item.mediaType}:${item.id}`, item);
}

let ok = 0;
let fail = 0;
for (const item of targets.values()) {
  try {
    const detail = await getJson(`/api/title/${item.mediaType}/${item.id}`);
    writeFileSync(`${OUT}/titles/${item.mediaType}-${item.id}.json`, JSON.stringify(detail));
    ok++;
  } catch {
    fail++;
  }
}

try {
  writeFileSync(`${OUT}/regions.json`, JSON.stringify(await getJson("/api/regions")));
} catch {
  /* optional */
}

console.log(`fixtures: rails=${home.rails.length} hero=${home.hero.length} titles ok=${ok} fail=${fail}`);
