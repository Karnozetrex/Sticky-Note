const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Pure Node.js PNG encoder without external dependencies.
 */
function createPng(width, height, pixelFn) {
  const rowStride = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowStride);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowStride;
    rawData[rowStart] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
      rawData[idx + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // Basic CRC-32 table
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let c = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xFF];
    }
    return (c ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Pixel shader rendering a yellow sticky note with a realistic curled corner and red pushpin.
 */
function stickyNotePixel(x, y, w, h) {
  const pad = Math.max(1, Math.floor(w * 0.08));
  const noteRight = w - pad;
  const noteBottom = h - pad;

  // Transparent border
  if (x < pad || x >= noteRight || y < pad || y >= noteBottom) {
    // Soft shadow outside note
    if (x >= pad - 2 && x <= noteRight + 2 && y >= pad - 1 && y <= noteBottom + 3) {
      return [0, 0, 0, 25];
    }
    return [0, 0, 0, 0];
  }

  // Curled bottom-right corner calculation
  const curlSize = Math.max(4, Math.floor(w * 0.28));
  const cornerOriginX = noteRight - curlSize;
  const cornerOriginY = noteBottom - curlSize;

  const inCurlBox = (x >= cornerOriginX) && (y >= cornerOriginY);
  const curlDist = (x - cornerOriginX) + (y - cornerOriginY);

  // 1. Cutout area beyond the curl fold
  if (inCurlBox && curlDist > curlSize + 1) {
    // Drop shadow under the lifted curl
    if (curlDist <= curlSize + 4) {
      return [0, 0, 0, 45];
    }
    return [0, 0, 0, 0];
  }

  // 2. Folded flap (peeled corner triangle showing lighter underside)
  if (inCurlBox && curlDist >= curlSize - 1) {
    if (curlDist === curlSize - 1 || curlDist === curlSize) {
      return [180, 140, 20, 255]; // Crease line shadow
    }
    // Lighter cream/paper back
    return [255, 252, 235, 255];
  }

  // 3. Red Pushpin at top center
  const pinX = Math.floor(w / 2);
  const pinY = pad + Math.max(2, Math.floor(h * 0.1));
  const distPin = Math.hypot(x - pinX, y - pinY);
  const pinRadius = Math.max(1.5, w * 0.065);

  if (distPin <= pinRadius) {
    // Pushpin head highlight & shadow
    if (distPin <= pinRadius * 0.4 && x < pinX && y < pinY) {
      return [255, 120, 120, 255]; // Highlight
    }
    return [220, 38, 38, 255]; // Rich red
  }
  // Subtle pin shadow
  if (distPin <= pinRadius + 1.5 && y > pinY) {
    return [0, 0, 0, 50];
  }

  // 4. Subtle ruled lines on note
  const line1 = Math.floor(h * 0.40);
  const line2 = Math.floor(h * 0.55);
  const line3 = Math.floor(h * 0.70);
  const marginL = pad + Math.floor(w * 0.12);
  const marginR = w - pad - Math.floor(w * 0.12);

  if ((y === line1 || y === line2 || y === line3) && x >= marginL && x <= marginR) {
    if (!inCurlBox || curlDist < curlSize - 4) {
      return [234, 179, 8, 180]; // Warm amber ruled line
    }
  }

  // 5. Authentic sticky yellow gradient
  const gradientFactor = y / h;
  const r = 254;
  const g = Math.floor(240 - gradientFactor * 25);
  const b = Math.floor(138 - gradientFactor * 40);

  return [r, g, b, 255];
}

/**
 * Builds a multi-resolution Windows .ico file containing multiple embedded PNG images.
 */
function createIco(images) {
  // Header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(images.length, 4); // count

  let offset = 6 + images.length * 16;
  const entries = [];
  const datas = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(img.data.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset

    entries.push(entry);
    datas.push(img.data);
    offset += img.data.length;
  }

  return Buffer.concat([header, ...entries, ...datas]);
}

/**
 * Builds a macOS .icns file with modern PNG chunks.
 */
function createIcns(entries) {
  const chunks = [];
  for (const entry of entries) {
    const typeBuf = Buffer.from(entry.type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(8 + entry.png.length, 0);
    chunks.push(Buffer.concat([typeBuf, lenBuf, entry.png]));
  }

  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(8 + body.length, 4);

  return Buffer.concat([header, body]);
}

// Generate all target formats
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('[Assets] Generating StickyPad icons...');

// 1. Standard PNGs
const png256 = createPng(256, 256, stickyNotePixel);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png256);

const png128 = createPng(128, 128, stickyNotePixel);
const png64 = createPng(64, 64, stickyNotePixel);
const png48 = createPng(48, 48, stickyNotePixel);
const png32 = createPng(32, 32, stickyNotePixel);
const png16 = createPng(16, 16, stickyNotePixel);

fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), png32);

// 2. Windows .ico containing 16, 32, 48, 64, 128, 256
const icoData = createIco([
  { width: 16, height: 16, data: png16 },
  { width: 32, height: 32, data: png32 },
  { width: 48, height: 48, data: png48 },
  { width: 64, height: 64, data: png64 },
  { width: 128, height: 128, data: png128 },
  { width: 256, height: 256, data: png256 }
]);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoData);

// 3. macOS .icns containing standard PNG chunks:
const icnsData = createIcns([
  { type: 'icp4', png: png16 },
  { type: 'icp5', png: png32 },
  { type: 'icp6', png: png64 },
  { type: 'ic07', png: png128 },
  { type: 'ic08', png: png256 }
]);
fs.writeFileSync(path.join(assetsDir, 'icon.icns'), icnsData);

console.log('[Assets] Successfully generated:');
console.log('  - assets/icon.png (Linux / App)');
console.log('  - assets/tray-icon.png (System Tray)');
console.log('  - assets/icon.ico (Windows)');
console.log('  - assets/icon.icns (macOS)');
