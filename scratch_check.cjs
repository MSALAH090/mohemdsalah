const fs = require('fs');
const content = fs.readFileSync('src/lib/players.ts', 'utf-8');

const rowsMatch = content.match(/const ROWS: Row\[\] = \[([\s\S]*?)\];/);
const rowsStr = rowsMatch[1];
const ids = [];
const regex = /\["([^"]+)"/g;
let m;
while ((m = regex.exec(rowsStr)) !== null) {
  ids.push(m[1]);
}

const imagesMatch = content.match(/export const PLAYER_IMAGES: Record<string, string> = {([\s\S]*?)};/);
const imagesStr = imagesMatch[1];
const images = {};
const imgRegex = /([a-zA-Z0-9_]+):\s*"([^"]+)"/g;
while ((m = imgRegex.exec(imagesStr)) !== null) {
  images[m[1]] = m[2];
}

const missing = [];
for (const id of ids) {
  if (!images[id]) missing.push(id);
}

const urlToIds = {};
for (const [id, url] of Object.entries(images)) {
  if (!urlToIds[url]) urlToIds[url] = [];
  urlToIds[url].push(id);
}

const duplicates = Object.entries(urlToIds).filter(([url, ids]) => ids.length > 1);

console.log("Missing:", missing);
console.log("Duplicates:");
for (const [url, dupIds] of duplicates) {
  console.log(`${url}: ${dupIds.join(', ')}`);
}
