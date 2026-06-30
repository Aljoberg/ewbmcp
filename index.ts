import type {
  AcCurrentSource,
  AcVoltageSource,
  Ammeter,
  Battery,
  Capacitor,
  ConfigBlock,
  ConfigValue,
  CurrentControlledSwitch,
  DcCurrentSource,
  DigitalNode,
  Element,
  ExtComp,
  Fuse,
  Inductor,
  Instrument,
  Project51,
  Relay,
  Resistor,
  Switch,
  TimeDelaySwitch,
  VoltageControlledSwitch,
  Voltmeter,
} from "./types";

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

enum PartNum {
  AC_VOLTAGE_SOURCE,
  RESISTOR,
  BATTERY,
  CAPACITOR,
  DIODE,
  NPN_TRANSISTOR,
  INDUCTOR,
  AC_CURRENT_SOURCE,
  GROUND,
  CONNECTOR,
  DC_CURRENT_SOURCE,
  PNP_TRANSISTOR,
  AMMETER,
  VOLTMETER,
  TRANSFORMER,
  OPAMP,
  ZENER_DIODE,
  LED,
  BULB,
  FUSE,
  RELAY,
  TIME_DELAY_SWITCH,
  N_CHANNEL_JFET,
  P_CHANNEL_JFET,
  "3_TERMINAL_DEPLETION_N_MOSFET",
  "3_TERMINAL_DEPLETION_P_MOSFET",
  "4_TERMINAL_DEPLETION_N_MOSFET",
  "4_TERMINAL_DEPLETION_P_MOSFET",
  "3_TERMINAL_ENHANCEMENT_N_MOSFET",
  "3_TERMINAL_ENHANCEMENT_P_MOSFET",
  "4_TERMINAL_ENHANCEMENT_N_MOSFET",
  "4_TERMINAL_ENHANCEMENT_P_MOSFET",
  VOLTAGE_CONTROLLED_VOLTAGE_SOURCE,
  CURRENT_CONTROLLED_CURRENT_SOURCE,
  VOLTAGE_CONTROLLED_CURRENT_SOURCE,
  CURRENT_CONTROLLED_VOLTAGE_SOURCE,
  VOLTAGE_CONTROLLED_SWITCH,
  CURRENT_CONTROLLED_SWITCH,
  SWITCH,
  NODE,
  IC_TEMP,
  SUB_TEMP,
}

class Stream {
  constructor(
    private data: Uint8Array,
    private pos: number = 0,
    // private mode: number = 0,
    // private rotation: number = 0,
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
    return isNaN(float) ? 0.0 : float; // same as readInt but more enforced, readInt can't parse floats
  }

  readQuotedValue() {
    const c = this._skipDelimiters();
    const term = c;

    const close = term; // for now, if there's any others like {} this may get changed

    const parts = [];
    if (term !== 0x27 && term !== 0x22) {
      parts.push(term);
    }
    while (true) {
      let char = this.readChar();
      if (char === -1) break;
      if (char === 0x5c) {
        // backslash
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

function parse(data: Uint8Array) {
  const stream = new Stream(data);

  function parseOne(parent: ConfigBlock) {
    const name = stream.readToken();
    if (name === null || name === "}") return null;
    if (name.startsWith('"') || name.startsWith("'")) return true; // random stray "" on a line

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
        // ??
        value = stream.readQuotedValue(); // good luck lol
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

const contents = await Bun.file(process.argv[2]!).bytes();

const parsed = parse(contents) as unknown as { Project_5_1: Project51 }; // fuck you typescript

console.dir(parsed, { depth: null });

Bun.file("output.json").write(JSON.stringify(parsed, null, 2));

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

const MULTIPLIERS = [0, 1000, 1000000, 1000000000];

const elementsComp = parsed.Project_5_1.Circuit.Elements.Comp;

const changedElements: Element[] = [];

for (const comp of elementsComp) {
  let data: Record<string, unknown> = {};
  const v = comp.Value;
  const pn = comp.PartNum;
  let multipliers: Resistor["multipliers"] | null = null; // ig

  switch (pn) {
    case PartNum.AC_VOLTAGE_SOURCE:
      data = {
        peakVoltage: v[0],
        frequency: v[1],
        phase: v[2],
      } as AcVoltageSource["data"];
      break;
    case PartNum.RESISTOR:
      data = {
        resistance: v[0],
        TC1: v[1],
        TC2: v[2],
        Tnom: v[3],
      } as Resistor["data"];
      if (comp.ModelUnits.length === 1) {
        const mult = MULTIPLIERS[comp.ModelUnits[0]!]!;
        multipliers = {
          resistance: mult,
          TC1: mult,
          TC2: mult,
          Tnom: mult,
        };
      } else
        multipliers = {
          resistance: MULTIPLIERS[comp.ModelUnits[0]!]!,
          TC1: MULTIPLIERS[comp.ModelUnits[1]!]!,
          TC2: MULTIPLIERS[comp.ModelUnits[2]!]!,
          Tnom: MULTIPLIERS[comp.ModelUnits[3]!]!,
        };
      break;
    case PartNum.BATTERY:
      data = { voltage: v[0] } as Battery["data"];
      break;
    case PartNum.CAPACITOR:
      data = { capacitance: v[0] } as Capacitor["data"];
      break;
    case PartNum.INDUCTOR:
      data = { inductance: v[0] } as Inductor["data"];
      break;
    case PartNum.AC_CURRENT_SOURCE:
      data = {
        peakCurrent: v[0],
        frequency: v[1],
        phase: v[2],
      } as AcCurrentSource["data"];
      break;
    case PartNum.DC_CURRENT_SOURCE:
      data = { current: v[0] } as DcCurrentSource["data"];
      break;
    case PartNum.AMMETER:
      data = { mode: v[0] } as Ammeter["data"];
      break;
    case PartNum.VOLTMETER:
      data = { mode: v[0] } as Voltmeter["data"];
      break;
    case PartNum.FUSE:
      data = { rating: v[0], responseTime: v[1] ?? 0 } as Fuse["data"];
      break;
    case PartNum.RELAY:
      data = {
        pickupVoltage: v[0],
        dropoutVoltage: v[1],
        pickupTime: v[2],
        dropoutTime: v[3],
      } as Relay["data"];
      break;
    case PartNum.TIME_DELAY_SWITCH:
      data = {
        tOn: v[0],
        tOff: v[1],
        delayOn: v[2],
        delayOff: v[3],
      } as TimeDelaySwitch["data"];
      break;
    case PartNum.VOLTAGE_CONTROLLED_SWITCH:
      data = {
        rOn: v[0],
        rOff: v[1],
        threshold: v[2],
      } as VoltageControlledSwitch["data"];
      break;
    case PartNum.CURRENT_CONTROLLED_SWITCH:
      data = {
        rOn: v[0],
        rOff: v[1],
        threshold: v[2],
      } as CurrentControlledSwitch["data"];
      break;
    case PartNum.SWITCH:
      data = { initialState: v[0] ?? 0 } as Switch["data"];
      break;
    case PartNum.NODE:
      data = {
        m_tptrElem:
          (comp as unknown as Record<string, unknown>).m_tptrElem ?? "",
        m_flags: (comp as unknown as Record<string, unknown>).m_flags ?? 0,
      } as DigitalNode["data"];
      break;
  }

  const obj = {
    name: PartNum[pn]!,
    rotation: comp.Position[0]!,
    x: comp.Position[1]!,
    y: comp.Position[2]!,
    refId: comp.Common.RefID,
    modelName: comp.ModelName || "ideal",
    // multipliers: [...comp.ModelUnits],
    data,
  };

  if (multipliers) (obj as Resistor).multipliers = multipliers;

  changedElements.push(obj);
}

for (const comp of toArray(parsed.Project_5_1.Circuit.Elements.ExtComp)) {
  const name = comp.Name;
  const v = comp.Value ?? [];
  const prefix = name.split(":")[0]!;

  changedElements.push({
    name,
    rotation: comp.Position[0]!,
    x: comp.Position[1]!,
    y: comp.Position[2]!,
    refId: comp.Common.RefID,
    modelName: comp.ModelName || "ideal",
    // multipliers: [...comp.ModelUnits],
    data: { value: v, data: comp.Data ?? "" },
  });
}

for (const inst of toArray(parsed.Project_5_1.Circuit.Elements.Instrument)) {
  changedElements.push({
    name: "Instrument",
    rotation: inst.Pos[0]!,
    x: inst.Pos[1]!,
    y: inst.Pos[2]!,
    refId: undefined,
    modelName: "ideal",
    // multipliers: [],
    data: {},
  });
}

console.dir(changedElements, { depth: null });

// Wires (flat indices refer to element order in .out file, NOT changedElements index)
console.log(
  `\n--- WIRES (${toArray(parsed.Project_5_1.Circuit.Wires.wire).length}) ---`,
);
for (const w of toArray(parsed.Project_5_1.Circuit.Wires.wire)) {
  console.log(
    `  [${w.pos[0]}:${w.pos[1]}] --node=${w.node_p}--> [${w.pos[2]}:${w.pos[3]}]  segs=[${w.segs}]`,
  );
}
