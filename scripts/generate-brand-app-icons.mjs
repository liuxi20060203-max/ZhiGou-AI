import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceIcon = resolve(root, 'public/brand/icon-192.png');
const faviconPath = resolve(root, 'app/favicon.ico');
const appleIconPath = resolve(root, 'app/apple-icon.png');

const png = await readFile(sourceIcon);
const header = Buffer.alloc(22);

// ICONDIR: reserved, image type, image count.
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

// ICONDIRENTRY: 0 means 256 px; this source is 192 px.
header.writeUInt8(192, 6);
header.writeUInt8(192, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);

await Promise.all([
  writeFile(faviconPath, Buffer.concat([header, png])),
  copyFile(sourceIcon, appleIconPath),
]);
