import type { ConfigBlock, ConfigValue } from "./types";

const DELIMITERS = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20];

const enum TypeCode {
  UNKNOWN,
  CONTAINER,
  INT32,
  DOUBLE,
  INT32_ARRAY,
  DOUBLE_ARRAY,
  UPPERCASE_STRING,
  TYPE_A_STRING,
  TYPE_R_STRING,
}

class Stream {
  constructor(
    private data: Uint8Array,
    private pos: number = 0,
  ) {}

  readChar() {
    if (this.pos >= this.data.length) return -1;
    const byte = this.data[this.pos]!;
    this.pos++;
    return byte;
  }

  _skipDelimiters() {
    while (true) {
      const char = this.readChar();
      if (char === -1) return -1;
      if (!DELIMITERS.includes(char)) return char;
    }
  }

  readToken() {
    const first = this._skipDelimiters();
    if (first === -1) return null;
    const chars = [first];
    while (true) {
      const char = this.readChar();
      if (char === -1 || DELIMITERS.includes(char)) break;
      chars.push(char);
    }
    return String.fromCharCode(...chars);
  }

  readInt() {
    const token = this.readToken();
    if (token === null) return 0;
    const int = parseInt(token);
    return isNaN(int) ? 0 : int;
  }

  readFloat() {
    const token = this.readToken();
    if (token === null) return 0;
    const float = parseFloat(token);
    return isNaN(float) ? 0.0 : float;
  }

  readQuotedValue() {
    const c = this._skipDelimiters();
    const term = c;

    const close = term;

    const parts = [];
    if (term !== 0x27 && term !== 0x22) {
      parts.push(term);
    }
    while (true) {
      let char = this.readChar();
      if (char === -1) break;
      if (char === 0x5c) {
        char = this.readChar();
        if (char === -1) break;
        parts.push(char);
      } else if (char === close) break;
      else if (char === 0x0d || char === 0x0a) break;
      else parts.push(char);
    }

    return String.fromCharCode(...parts);
  }
}

export function parse(data: Uint8Array) {
  const stream = new Stream(data);

  function parseOne(parent: ConfigBlock) {
    const name = stream.readToken();
    if (name === null || name === "}") return null;
    if (name.startsWith('"') || name.startsWith("'")) return true;

    const type = stream.readToken();
    if (type === null) return null;

    let typeCode: TypeCode = TypeCode.UNKNOWN;
    let count = 0;

    if (type === "{") {
      typeCode = TypeCode.CONTAINER;
    } else if (type && type[0] === "i") {
      if (type.includes(":")) {
        typeCode = TypeCode.INT32_ARRAY;
        count = parseInt(type.split(":")[1]!);
      } else typeCode = TypeCode.INT32;
    } else if (type && type[0] === "r") {
      if (type.includes(":")) {
        typeCode = TypeCode.DOUBLE_ARRAY;
        count = parseInt(type.split(":")[1]!);
      } else typeCode = TypeCode.DOUBLE;
    } else if (type === "M") typeCode = TypeCode.UPPERCASE_STRING;
    else if (type === "A") typeCode = TypeCode.TYPE_A_STRING;
    else if (type === "R") typeCode = TypeCode.TYPE_R_STRING;

    let value: number | string | number[] | null = null;

    switch (typeCode) {
      case TypeCode.CONTAINER:
        const newContainer: ConfigBlock = {};
        while (true) {
          const result = parseOne(newContainer);
          if (result === null) break;
        }
        if (name in parent) {
          const prev = parent[name]!;
          if (Array.isArray(prev)) {
            (prev as ConfigValue[]).push(newContainer);
          } else {
            parent[name] = [prev, newContainer];
          }
        } else {
          parent[name] = newContainer;
        }
        return newContainer;
      case TypeCode.INT32:
        value = stream.readInt();
        break;
      case TypeCode.DOUBLE:
        value = stream.readFloat();
        break;
      case TypeCode.INT32_ARRAY:
        value = Array.from({ length: count }, () => stream.readInt());
        break;
      case TypeCode.DOUBLE_ARRAY:
        value = Array.from({ length: count }, () => stream.readFloat());
        break;
      case TypeCode.UPPERCASE_STRING:
        throw new Error("UPPERCASE_STRING not supported");
      case TypeCode.TYPE_A_STRING:
      case TypeCode.TYPE_R_STRING:
        value = stream.readQuotedValue();
        break;
      default:
        value = stream.readQuotedValue();
        break;
    }

    if (name in parent) {
      const prev = parent[name]!;
      if (Array.isArray(prev)) {
        (prev as ConfigValue[]).push(value);
      } else {
        parent[name] = [prev, value];
      }
    } else {
      parent[name] = value;
    }

    return value;
  }

  const root: ConfigBlock = {};
  while (true) {
    const result = parseOne(root);
    if (result === null) break;
  }

  return root;
}
