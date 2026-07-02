import { crc32 } from "node:zlib";

const LEN_EXTRA_BITS = [3, 2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7];
const LEN_SORTED = [5, 3, 1, 6, 10, 2, 12, 20, 4, 24, 8, 48, 16, 32, 64, 0];
const LEN_BASE_FLAGS = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8];
const LEN_BASE_VALUES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 14, 22, 38, 70, 134, 262,
];
const DIST_EXTRA_BITS = [
  2, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8,
  8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
];
const DIST_SORTED = [
  3, 13, 5, 25, 9, 17, 1, 62, 30, 46, 14, 54, 22, 38, 6, 58, 26, 42, 10, 50, 18,
  34, 66, 2, 124, 60, 92, 28, 108, 44, 76, 12, 116, 52, 84, 20, 100, 36, 68, 4,
  120, 56, 88, 24, 104, 40, 72, 8, 240, 112, 176, 48, 208, 80, 144, 16, 224, 96,
  160, 32, 192, 64, 128, 0,
];

function buildHuffTable(
  numSyms: number,
  extraBits: number[],
  sortedOrder: number[],
): number[] {
  const tbl = new Array<number>(256).fill(0);
  for (let i = numSyms - 1; i >= 0; i--) {
    const blen = extraBits[i]!;
    let sidx = sortedOrder[i]!;
    while (sidx < 256) {
      tbl[sidx] = i;
      sidx += 1 << blen;
    }
  }
  return tbl;
}

const LENGTH_TBL = buildHuffTable(16, LEN_EXTRA_BITS, LEN_SORTED);
const DISTANCE_TBL = buildHuffTable(64, DIST_EXTRA_BITS, DIST_SORTED);

class BitReader {
  data: Uint8Array;
  pos: number;
  buf: number;
  bits: number;

  constructor(data: Uint8Array, buf = 0, pos = 0) {
    this.data = data;
    this.pos = pos;
    this.buf = buf;
    this.bits = 0;
  }

  consume(n: number) {
    if (n <= 0) return true;
    if (this.bits < n) {
      this.buf >>>= this.bits;
      if (this.pos >= this.data.length) return false;
      this.buf |= this.data[this.pos]! << 8;
      this.pos++;
      this.buf >>>= n - this.bits;
      this.bits = 8 - (n - this.bits);
    } else {
      this.buf >>>= n;
      this.bits -= n;
    }
    return true;
  }

  read(n: number) {
    const savedBuf = this.buf;
    const savedBits = this.bits;
    const savedPos = this.pos;
    const ok = this.consume(n);
    const val = n < 16 ? savedBuf & ((1 << n) - 1) : savedBuf;
    if (!ok) {
      this.buf = savedBuf;
      this.bits = savedBits;
      this.pos = savedPos;
      return null;
    }
    return val;
  }

  peek(n: number) {
    const savedBuf = this.buf;
    const savedBits = this.bits;
    const savedPos = this.pos;
    const ok = this.consume(n);
    const val = n < 16 ? savedBuf & ((1 << n) - 1) : savedBuf;
    this.buf = savedBuf;
    this.bits = savedBits;
    this.pos = savedPos;
    return ok ? val : null;
  }

  skip(n: number) {
    return this.consume(n);
  }
}

function readSymbol(br: BitReader) {
  const bit = br.read(1);
  if (bit === null) return 0x306;
  if (bit === 0) {
    const val = br.read(8);
    if (val === null) return 0x306;
    return val;
  }
  const peek8 = br.peek(8);
  if (peek8 === null) return 0x306;
  const idx = LENGTH_TBL[peek8]!;
  const eb = LEN_EXTRA_BITS[idx]!;
  if (eb) br.skip(eb);
  const flags = LEN_BASE_FLAGS[idx]!;
  if (flags) {
    const extra2 = br.peek(flags);
    if (extra2 === null) return 0x306;
    br.skip(flags);
    return extra2 + LEN_BASE_VALUES[idx]! + 0x100;
  }
  return idx + 0x100;
}

function decodeDistance(br: BitReader, matchLen: number, distBits: number) {
  const peek8 = br.peek(8);
  if (peek8 === null) return 0;
  const dsym = DISTANCE_TBL[peek8]!;
  const eb = DIST_EXTRA_BITS[dsym]!;
  if (eb) br.skip(eb);
  if (matchLen === 2) {
    const extra = br.read(2);
    if (extra === null) return 0;
    return ((dsym << 2) | extra) + 1;
  } else {
    const extra = br.read(distBits);
    if (extra === null) return 0;
    return ((dsym << distBits) | extra) + 1;
  }
}

function pkwareDecompress(data: Uint8Array) {
  if (data.length < 4) return null;
  const litFlag = data[0]!;
  const distBits = data[1]!;
  if (distBits < 4 || distBits > 6 || (litFlag !== 0 && litFlag !== 1))
    return null;
  const br = new BitReader(data, data[2]!, 3);
  const ring = new Uint8Array(0x2000);
  let ringPos = 0x1000;
  const result: number[] = [];
  while (true) {
    const sym = readSymbol(br);
    if (sym === null || sym > 0x304) break;
    if (sym < 0x100) {
      ring[ringPos & 0x1fff] = sym;
      ringPos++;
    } else {
      const matchLen = sym - 0xfe;
      const dist = decodeDistance(br, matchLen, distBits);
      if (dist === 0) break;
      for (let i = 0; i < matchLen; i++) {
        const src = (ringPos - dist) & 0x1fff;
        ring[ringPos & 0x1fff] = ring[src]!;
        ringPos++;
      }
    }
    if (ringPos > 0x1fff) {
      result.push(...ring.subarray(0x1000, 0x2000));
      ring.set(ring.subarray(0x1000, 0x2000), 0);
      ringPos -= 0x1000;
    }
  }
  if (ringPos > 0x1000) {
    result.push(...ring.subarray(0x1000, ringPos));
  }
  return new Uint8Array(result);
}

class BitWriter {
  data: number[] = [];
  acc = 0;
  accBits = 0;

  writeBits(value: number, nBits: number) {
    if (nBits <= 0) return;
    this.acc |= (value & ((1 << nBits) - 1)) << this.accBits;
    this.acc >>>= 0;
    this.accBits += nBits;
    while (this.accBits >= 8) {
      this.data.push(this.acc & 0xff);
      this.acc >>>= 8;
      this.accBits -= 8;
    }
  }

  flush() {
    if (this.accBits) {
      this.data.push(this.acc & 0xff);
      this.acc = 0;
      this.accBits = 0;
    }
  }

  getBytes() {
    return new Uint8Array(this.data);
  }
}

class HashChain {
  data: Uint8Array;
  n: number;
  dictSize: number;
  maxLen: number;
  NUM_HASHES = 256 * 4 + 256 * 5;
  hashTbl: number[];
  chain: number[];
  windowBase = 0;

  constructor(data: Uint8Array, dictSize = 0x400, maxLen = 0x204) {
    this.data = data;
    this.n = data.length;
    this.dictSize = dictSize;
    this.maxLen = maxLen;
    this.hashTbl = new Array(this.NUM_HASHES + 1).fill(0);
    this.chain = [];
    if (this.n >= 2) {
      this.rebuild(0, this.n);
    }
  }

  private rebuild(start: number, end: number) {
    const count = new Array(this.NUM_HASHES + 1).fill(0);
    for (let i = start; i < end - 1; i++) {
      const h = this.data[i]! * 4 + this.data[i + 1]! * 5;
      count[h]!++;
    }
    let total = 0;
    for (let h = 0; h < this.NUM_HASHES; h++) {
      total += count[h]!;
      this.hashTbl[h] = total;
    }
    this.chain = new Array(end - start - 1).fill(0);
    for (let i = end - 2; i >= start; i--) {
      const h = this.data[i]! * 4 + this.data[i + 1]! * 5;
      this.hashTbl[h]!--;
      this.chain[this.hashTbl[h]!] = i;
    }
    this.windowBase = start;
  }

  findMatch(pos: number): [number, number] {
    if (pos < 2 || pos + 2 > this.n) return [0, 0];
    const h = this.data[pos]! * 4 + this.data[pos + 1]! * 5;
    let chainIdx = this.hashTbl[h]!;
    const validMin = pos - this.dictSize + 1;
    const maxCand = pos - 2;
    if (chainIdx >= this.chain.length) return [0, 0];
    if (this.chain[chainIdx]! < validMin) {
      while (chainIdx < this.chain.length && this.chain[chainIdx]! < validMin) {
        chainIdx++;
      }
      if (chainIdx >= this.chain.length) return [0, 0];
      this.hashTbl[h] = chainIdx;
    }
    if (this.chain[chainIdx]! > maxCand) return [0, 0];
    let bestLen = 1;
    let bestD0 = 0;
    while (chainIdx < this.chain.length) {
      const cand = this.chain[chainIdx]!;
      if (cand > maxCand) break;
      if (this.data[cand + bestLen - 1]! !== this.data[pos + bestLen - 1]!) {
        chainIdx++;
        continue;
      }
      if (this.data[cand]! !== this.data[pos]!) {
        chainIdx++;
        continue;
      }
      let ml = 2;
      const limit = Math.min(this.maxLen, this.n - pos);
      while (ml < limit && this.data[cand + ml]! === this.data[pos + ml]!) {
        ml++;
      }
      if (bestLen <= ml) {
        bestLen = ml;
        bestD0 = pos - cand - 1;
      }
      chainIdx++;
    }
    if (bestLen < 2) return [0, 0];
    return [bestLen, bestD0];
  }
}

function lengthEncode(matchLen: number): [number, number] {
  const V = matchLen - 2;
  for (let idx = 0; idx < 16; idx++) {
    const base = LEN_BASE_VALUES[idx]!;
    const flags = LEN_BASE_FLAGS[idx]!;
    if (flags) {
      if (base <= V && V < base + (1 << flags)) return [idx, V - base];
    } else {
      if (V === base) return [idx, 0];
    }
  }
  return [15, V - 262];
}

function pkwareCompress(data: Uint8Array) {
  if (data.length === 0) return new Uint8Array([0, 4, 0]);
  const bw = new BitWriter();
  const n = data.length;
  const hc = new HashChain(data);
  const valid = (ml: number) => ml >= 2;
  let i = 0;
  while (i < n) {
    let [matchLen, matchD0] = hc.findMatch(i);
    while (valid(matchLen) && !(matchLen === 2 && matchD0 >= 0x100)) {
      if (i + matchLen > n) {
        matchLen = n - i - 1;
        if (!valid(matchLen)) break;
      }
      if (matchLen > 7 || i + 1 >= n) break;
      const savedD0 = matchD0;
      const [nextLen, nextD0] = hc.findMatch(i + 1);
      if (!valid(nextLen)) break;
      if (
        !(
          nextLen > matchLen + 1 ||
          (nextLen === matchLen + 1 && savedD0 >= 0x81)
        )
      )
        break;
      bw.writeBits(0, 1);
      bw.writeBits(data[i]!, 8);
      i++;
      matchLen = nextLen;
      matchD0 = nextD0;
    }
    if (
      matchLen &&
      valid(matchLen) &&
      matchD0 + 1 <= 0x400 &&
      !(matchLen === 2 && matchD0 >= 0x100)
    ) {
      let lidxUse: number;
      let lextraUse: number;
      let lextraBitsUse: number;
      if (matchLen <= 9) {
        lidxUse = matchLen - 2;
        lextraUse = 0;
        lextraBitsUse = 0;
      } else {
        [lidxUse, lextraUse] = lengthEncode(matchLen);
        lextraBitsUse = LEN_BASE_FLAGS[lidxUse]!;
      }
      let dsym: number;
      let dextra: number;
      let dextraBits: number;
      if (matchLen === 2) {
        dsym = matchD0 >> 2;
        dextra = matchD0 & 3;
        dextraBits = 2;
      } else {
        dsym = matchD0 >> 4;
        dextra = matchD0 & 0xf;
        dextraBits = 4;
      }
      bw.writeBits(1, 1);
      bw.writeBits(LEN_SORTED[lidxUse]!, LEN_EXTRA_BITS[lidxUse]!);
      if (lextraBitsUse) bw.writeBits(lextraUse, lextraBitsUse);
      bw.writeBits(DIST_SORTED[dsym]!, DIST_EXTRA_BITS[dsym]!);
      bw.writeBits(dextra, dextraBits);
      i += matchLen;
      continue;
    }
    bw.writeBits(0, 1);
    bw.writeBits(data[i]!, 8);
    i++;
  }
  bw.writeBits(0xff01, 16);
  bw.flush();
  const stream = bw.getBytes();
  if (stream.length === 0) return new Uint8Array([0, 4, 0]);
  const out = new Uint8Array(3 + Math.max(0, stream.length - 1));
  out[0] = 0;
  out[1] = 4;
  out[2] = stream[0]!;
  if (stream.length > 1) out.set(stream.subarray(1), 3);
  return out;
}

function decodeType2Chars(text: string) {
  const result: number[] = [];
  let i = 0;
  while (i < text.length - 1) {
    const c1 = text[i]!;
    const c2 = text[i + 1]!;
    if (c1 === "\r" || c1 === "\n" || c1 === "/" || c1 === " ") {
      i++;
      continue;
    }
    if (c1 === "!" || c1 === "$") break;
    result.push(
      ((c1.charCodeAt(0) - 0x30) << 3) | ((c2.charCodeAt(0) - 0x30) >> 2),
    );
    i += 2;
  }
  return new Uint8Array(result);
}

function encodeType2Chars(data: Uint8Array) {
  let out = "";
  for (let i = 0; i < data.length; i++) {
    out += String.fromCharCode((data[i]! >> 3) + 0x30);
    out += String.fromCharCode(((data[i]! & 7) << 2) + 0x30);
  }
  return out;
}

function decodeBody(text: string) {
  const parts = text.split("$");
  const result: number[] = [];
  for (const part of parts) {
    let p = part;
    const exclIdx = p.indexOf("!");
    if (exclIdx !== -1) p = p.substring(0, exclIdx);
    if (!p) continue;
    const block = decodeType2Chars(p);
    const d = pkwareDecompress(block);
    if (d) result.push(...d);
  }
  return new Uint8Array(result);
}

function encodeBody(data: Uint8Array) {
  const parts: string[] = [];
  for (let offset = 0; offset < data.length; offset += 0x400) {
    const chunk = data.subarray(offset, offset + 0x400);
    const compressed = pkwareCompress(chunk);
    parts.push(encodeType2Chars(compressed));
  }
  return parts.join("$");
}

function parseHeader(text: string) {
  let body = "";
  let inData = false;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("UsingVectorGraphics:")) {
      inData = true;
      continue;
    }
    if (inData && line) {
      let l = line;
      if (l.startsWith("/")) l = l.substring(1);
      body += l;
    }
  }
  return body;
}

function computeXorCrc(data: Uint8Array, chunkSize = 0x400) {
  let crc = 0;
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const chunk = data.subarray(offset, offset + chunkSize);
    crc ^= crc32(Buffer.from(chunk)) >>> 0;
  }
  return crc;
}

function chunks65(s: string) {
  const ch: string[] = [];
  for (let i = 0; i < s.length; i += 65) ch.push(s.substring(i, i + 65));
  return ch;
}

export function decodeFile(text: string) {
  const body = parseHeader(text);
  const crcIdx = body.indexOf("!");
  const data =
    crcIdx !== -1 ? decodeBody(body.substring(0, crcIdx)) : decodeBody(body);
  return data;
}

export function encodeFile(data: Uint8Array) {
  const encoded = encodeBody(data);
  const crc = computeXorCrc(data);
  const ch = chunks65(encoded);

  let body = "";
  for (let idx = 0; idx < ch.length; idx++) {
    body +=
      (idx === 0 ? "/" : "") + ch[idx]! + (idx < ch.length - 1 ? "\n" : "");
  }
  body += `$!${crc.toString(16).padStart(8, "0")}`;

  return [
    "Electronics Workbench Circuit File",
    "Version: 5",
    "Charset: ANSI",
    "Description: ",
    '"" ',
    "EncryptionType: 2",
    "UsingVectorGraphics: 0",
    "",
    body,
  ].join("\r\n");
}
