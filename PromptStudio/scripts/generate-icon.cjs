const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
function crc32(buf) { let c = 0xffffffff; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4); size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([size, name, data, crc]); }
function curve(start, control1, control2, end) {
  return Array.from({ length: 10 }, (_, i) => {
    const t = (i + 1) / 10;
    const u = 1 - t;
    return start.map((value, axis) => u ** 3 * value + 3 * u ** 2 * t * control1[axis] + 3 * u * t ** 2 * control2[axis] + t ** 3 * end[axis]);
  });
}

const letterP = [[63, 177], [63, 79], [99, 79], ...curve([99, 79], [138, 79], [138, 130], [99, 130]), [64, 130]];
const letterS = [[192, 85],
  ...curve([192, 85], [169, 67], [143, 79], [145, 101]),
  ...curve([145, 101], [147, 121], [194, 119], [194, 149]),
  ...curve([194, 149], [194, 177], [163, 184], [139, 167])
];

function onStroke(x, y, points, radius) {
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const dx = points[i][0] - ax;
    const dy = points[i][1] - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    if ((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= radius ** 2) return true;
  }
  return false;
}

function colorAt(x, y) {
  const dx = Math.max(0, Math.abs(x - 128) - 76);
  const dy = Math.max(0, Math.abs(y - 128) - 76);
  const corner = dx * dx + dy * dy;
  if (corner > 48 ** 2) return null;
  if (onStroke(x, y, letterP, 9.5)) return [247, 242, 230];
  if (onStroke(x, y, letterS, 9.5)) return [222, 190, 133];
  if (corner > 44 ** 2) return [67, 57, 45];
  return [21, 22, 26];
}

function renderPng(size) {
  const stride = size * 4 + 1;
  const pixels = Buffer.alloc(size * stride);
  const scale = 256 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const colors = [];
      for (const oy of [0.25, 0.75]) {
        for (const ox of [0.25, 0.75]) {
          const color = colorAt((x + ox) * scale, (y + oy) * scale);
          if (color) colors.push(color);
        }
      }
      if (!colors.length) continue;
      const offset = y * stride + 1 + x * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = Math.round(colors.reduce((sum, color) => sum + color[channel], 0) / colors.length);
      }
      pixels[offset + 3] = Math.round(colors.length * 255 / 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map(renderPng);
const directory = Buffer.alloc(6 + 16 * sizes.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = directory[entry + 1] = size % 256;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(images[index].length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}
fs.writeFileSync(path.join(__dirname, '../ui/icon.png'), images.at(-1));
fs.writeFileSync(path.join(__dirname, '../ui/icon.ico'), Buffer.concat([directory, ...images]));
