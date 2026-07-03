import {
  ElementType,
  type AcCurrentSource,
  type AcVoltageSource,
  type Ammeter,
  type Battery,
  type Capacitor,
  type ChangedWire,
  type Comp,
  type ConfigBlock,
  type ConfigValue,
  type CurrentControlledSwitch,
  type DcCurrentSource,
  type DeserializedCircuit,
  type DigitalNode,
  type Element,
  type Elements,
  type ExtComp,
  type Fuse,
  type Inductor,
  type Instrument,
  type Project51,
  type Relay,
  type Resistor,
  type Switch,
  type TimeDelaySwitch,
  type VoltageControlledSwitch,
  type Voltmeter,
} from "./types";
import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

const _origSseSend = SSEServerTransport.prototype.send;
SSEServerTransport.prototype.send = function (message: any) {
  console.log(">>> SSE send:", JSON.stringify(message));
  return _origSseSend.call(this, message);
};

const _origWebSend = WebStandardStreamableHTTPServerTransport.prototype.send;
WebStandardStreamableHTTPServerTransport.prototype.send = function (
  message: any,
  options?: any,
) {
  console.log(">>> StreamableHTTP send:", JSON.stringify(message));
  return _origWebSend.call(this, message, options);
};
import {
  acCurrentSourceSchema,
  acVoltageSourceSchema,
  addOutputSchema,
  ammeterSchema,
  batterySchema,
  capacitorSchema,
  currentControlledSwitchSchema,
  dcCurrentSourceSchema,
  elementDataOutputSchema,
  findOutputSchema,
  fuseSchema,
  inductorSchema,
  loadFileSchema,
  relaySchema,
  removeOutputSchema,
  resistorSchema,
  switchSchema,
  timeDelaySwitchSchema,
  updateOutputSchema,
  voltageControlledSwitchSchema,
  voltmeterSchema,
  wireSchema,
} from "./schemas";
import { decodeFile, encodeFile } from "./ewb";
import { createMcpHandler } from "mcp-handler";

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

export enum WireDirection {
  RIGHT = 1,
  UP = 2,
  LEFT = 4, // probably
  DOWN = 8,
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

export function parse(data: Uint8Array) {
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

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

const ROTATION_TO_INDEX = new Map<number, number>([
  [0, 0],
  [90, 1],
  [180, 6],
  [270, 7],
]);
const INDEX_TO_ROTATION = [0, 90, 180, 270] as const;
const MULTIPLIERS = [1, 1000, 1000000, 0.001] as const;

function rotationFromEwbIndex(index: number) {
  return INDEX_TO_ROTATION[index as 0 | 1 | 2 | 3] ?? 0;
}

function rotationToEwbIndex(rotation: number) {
  const index = ROTATION_TO_INDEX.get(rotation);
  if (index === undefined) {
    throw new Error(`Unsupported rotation: ${rotation}`);
  }
  return index;
}

export function deserialize(contents: Uint8Array) {
  const parsed = parse(contents) as unknown as { Project_5_1: Project51 }; // fuck you typescript

  Bun.file("output.json").write(JSON.stringify(parsed, null, 2));

  const changedWires: ChangedWire[] = toArray(
    parsed.Project_5_1.Circuit.Wires?.wire,
  ).map((wire) => ({
    firstEndpoint: {
      elementIndex: wire.pos[0],
      pin: wire.pos[1],
    },
    secondEndpoint: {
      elementIndex: wire.pos[2],
      pin: wire.pos[3],
    },
    segments: Array.from(
      { length: Math.floor(wire.segs.length / 2) },
      (_, i) => ({
        direction: wire.segs[i * 2]!,
        length: wire.segs[i * 2 + 1]!,
      }),
    ),
    color: wire.colour,
    wireId: wire.wire_id,
    nodeP: wire.node_p,
    xFactor: wire.x_factor,
    yFactor: wire.y_factor,
  }));

  function getConnectedWireIds(elementIndex: number) {
    return changedWires
      .filter(
        (w) =>
          w.firstEndpoint.elementIndex === elementIndex ||
          w.secondEndpoint.elementIndex === elementIndex,
      )
      .map((w) => w.wireId);
  }

  console.dir(changedWires, { depth: null });

  const changedElements: Element[] = [];

  // Process elements in flat file order (iterate Elements keys in insertion order)
  const elementsData = parsed.Project_5_1.Circuit.Elements;
  for (const [typeName, elems] of Object.entries(elementsData)) {
    for (const raw of toArray(elems)) {
      if (typeName === "Comp") {
        const comp = raw as Comp;
        const v = comp.Value;
        const pn = comp.PartNum;
        let data: Record<string, unknown> = {};
        let multipliers: Resistor["multipliers"] | null = null;

        if (v)
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
              } else {
                multipliers = {
                  resistance: MULTIPLIERS[comp.ModelUnits[0]!]!,
                  TC1: MULTIPLIERS[comp.ModelUnits[1]!]!,
                  TC2: MULTIPLIERS[comp.ModelUnits[2]!]!,
                  Tnom: MULTIPLIERS[comp.ModelUnits[3]!]!,
                };
              }
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
              data = { mode: v[1], resistance: v[0] } as Ammeter["data"];
              break;
            case PartNum.VOLTMETER:
              data = { mode: v[1], resistance: v[0] } as Voltmeter["data"];
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
          }
        else if (pn === PartNum.NODE) {
          data = {
            m_tptrElem:
              (comp as unknown as Record<string, unknown>).m_tptrElem ?? "",
            m_flags: (comp as unknown as Record<string, unknown>).m_flags ?? 0,
          } as DigitalNode["data"];
        }

        // Collect extra raw properties not captured by typed fields
        const knownKeys = new Set([
          "PartNum",
          "Position",
          "Value",
          "ModelUnits",
          "Common",
          "ModelName",
          "Status",
        ]);
        const rawExtra: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(comp)) {
          if (!knownKeys.has(k)) rawExtra[k] = val;
        }

        const obj: Element = {
          name: PartNum[pn]!,
          rotation: rotationFromEwbIndex(comp.Position[0]!),
          x: comp.Position[1]!,
          y: comp.Position[2]!,
          refId: comp.Common.RefID,
          modelName: comp.ModelName ?? "",
          data,
          connectedWires: getConnectedWireIds(changedElements.length),
          type: ElementType.BASE,
          _value: v ? [...v] : null,
          _modelUnits: [...comp.ModelUnits],
          _status: comp.Status,
          _raw: rawExtra,
        };
        if (multipliers) (obj as Resistor).multipliers = multipliers;
        changedElements.push(obj);
      } else if (typeName === "ExtComp") {
        const comp = raw as ExtComp;
        const v = comp.Value ?? [];

        changedElements.push({
          name: comp.Name,
          rotation: rotationFromEwbIndex(comp.Position[0]!),
          x: comp.Position[1]!,
          y: comp.Position[2]!,
          refId: comp.Common.RefID,
          modelName: comp.ModelName ?? "",
          data: { value: v, data: comp.Data ?? "" },
          connectedWires: getConnectedWireIds(changedElements.length),
          type: ElementType.EXTENSION,
          _value: [...v],
          _modelUnits: comp.ModelUnits ? [...comp.ModelUnits] : [],
          _status: comp.Status,
          _raw: { Data: comp.Data ?? "" },
        } satisfies Element);
      } else if (typeName === "Instrument") {
        const inst = raw as Instrument;

        changedElements.push({
          name: "Instrument",
          rotation: rotationFromEwbIndex(inst.Pos[0]!),
          x: inst.Pos[1]!,
          y: inst.Pos[2]!,
          refId: undefined,
          modelName: "ideal",
          data: {},
          connectedWires: getConnectedWireIds(changedElements.length),
          type: ElementType.INSTRUMENT,
          _value: [],
          _modelUnits: [],
          _status: 0,
          _raw: {},
        } satisfies Element);
      }
    }
  }

  return {
    elements: changedElements,
    wires: changedWires,
  } satisfies DeserializedCircuit;
}

if (import.meta.main) {
  const contents = await Bun.file(process.argv[2]!).bytes();

  const circuit = deserialize(contents);
  console.dir(circuit, { depth: null });

  Bun.file("output.ewb").write(serialize(circuit));
}

function quote(s: string) {
  // Escape backslashes and quotes for A/R string format
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function serialize({ elements, wires }: DeserializedCircuit) {
  const out: string[] = [];

  function emit(line: string = "", indent: number = 0) {
    if (line) out.push(" ".repeat(indent) + line + " ");
    else out.push(" ");
  }

  function emitBlock(name: string, indent: number, fn: () => void) {
    emit(name, indent);
    emit("{", indent);
    fn();
    emit("}", indent);
  }

  // Build Elements block
  emit("", 0);
  emitBlock("Elements", 4, () => {
    for (const elem of elements) {
      if (elem.type === ElementType.BASE) {
        const pn = PartNum[elem.name as keyof typeof PartNum];
        emitBlock(elem.type, 6, () => {
          emit(`PartNum i ${pn}`, 8);
          emit(
            `Position i:3 ${rotationToEwbIndex(elem.rotation)} ${elem.x} ${elem.y}`,
            8,
          );
          if (elem._value)
            emit(`Value r:${elem._value.length} ${elem._value.join(" ")}`, 8);
          emit(
            `ModelUnits i:${elem._modelUnits.length} ${elem._modelUnits.join(" ")}`,
            8,
          );
          emitBlock("Common", 8, () => {
            emit(`RefID A ${quote(elem.refId ?? "")}`, 10);
          });
          if (typeof elem.modelName === "string") {
            emit(`ModelName R ${quote(elem.modelName)}`, 8);
          }
          emit(`Status i ${elem._status}`, 8);
          // Extra raw properties
          for (const [k, val] of Object.entries(elem._raw)) {
            if (typeof val === "number") emit(`${k} i ${val}`, 8);
            else if (typeof val === "string") emit(`${k} A ${quote(val)}`, 8);
            else if (Array.isArray(val))
              emit(`${k} i:${val.length} ${val.join(" ")}`, 8);
          }
        });
      } else if (elem.type === ElementType.EXTENSION) {
        emitBlock(elem.type, 6, () => {
          emit(`Name R ${quote(elem.name)}`, 8);
          emit(
            `Position i:3 ${rotationToEwbIndex(elem.rotation)} ${elem.x} ${elem.y}`,
            8,
          );
          if (elem._value && elem._value.length > 0) {
            emit(`Value r:${elem._value.length} ${elem._value.join(" ")}`, 8);
          }
          emit(
            `ModelUnits i:${elem._modelUnits.length} ${elem._modelUnits.join(" ")}`,
            8,
          );
          emitBlock("Common", 8, () => {
            emit(`RefID A ${quote(elem.refId ?? "")}`, 10);
          });
          const dataStr = elem._raw.Data as string | undefined;
          if (dataStr) emit(`Data R ${quote(dataStr)}`, 8);
          if (elem.modelName) emit(`ModelName R ${quote(elem.modelName)}`, 8);
          emit(`Status i ${elem._status}`, 8);
        });
      } else if (elem.type === ElementType.INSTRUMENT) {
        emitBlock("Instrument", 6, () => {
          emit(`PartNum i 6`, 8);
          emit(
            `Pos i:3 ${rotationToEwbIndex(elem.rotation)} ${elem.x} ${elem.y}`,
            8,
          );
        });
      }
    }
  });

  // Build Wires block
  emitBlock("Wires", 4, () => {
    for (const wire of wires) {
      emitBlock("wire", 6, () => {
        emit(
          `pos i:4 ${wire.firstEndpoint.elementIndex} ${wire.firstEndpoint.pin} ${wire.secondEndpoint.elementIndex} ${wire.secondEndpoint.pin}`,
          8,
        );
        const flatSegs = wire.segments.flatMap((s) => [s.direction, s.length]);
        emit(`segs i:${flatSegs.length} ${flatSegs.join(" ")}`, 8);
        emit(`colour i ${wire.color}`, 8);
        emit(`wire_id i ${wire.wireId}`, 8);
        emit(`node_p A ${quote(wire.nodeP)}`, 8);
        emit(`x_factor r ${wire.xFactor}`, 8);
        emit(`y_factor r ${wire.yFactor}`, 8);
      });
    }
  });

  const elementsAndWires = out.join("\r\n");

  const TEMPLATE = `Project_5_1 
{ 
  CircuitHeader 
  { 
    InternalCircuitVersion i 511 
    ZoomFactor i 80 
    VersionSpecific 
    { 
      SerialNo R "\\"RBS-1999-RBS\\""
        "" 
      Version R "Version 5.12" 
      Restrictions 
      { 
        Name R "Global Restrictions" 
        CircPass R "" 
        Path R "c:\\users\\aljob\\downloads\\electronics-workbench-ewb-5.12-main\\ewb512" 
        RelaxAll i 0 
        Override i 0 
        NoPrint i 0 
        ReadOnly i 0 
        NoFaults i 0 
        NoSub i 0 
        NoValues i 0 
        NoModel i 0 
        NoDisp i 0 
        NoCAnal i 0 
        NoParts i 0 
        NoInst i 0 
        NoFav i 0 
        PBOpt i 1 
        ANOpt i 1 
        NoAnal i:14 1 1 1 1 1 1 1 1 1 1 1 1 1 1 
      }
    }
    Library 
    { 
      Name R "$" 
    }
    PrintSettings 
    { 
      Choices i:13 0 0 0 0 0 0 0 0 0 0 0 0 0 
      WkSpacePageBrk i 0 
      MacroPageBrk i 0 
      PrintZoom i 2000 
    }
  }
  Circuit 
  { 
    Preferences 
    { 
      Mode i 16 
      Info i:10 1 0 100 1 0 1 1 1 10485760 0 
      ShowNodes i 0 
      Fonts 
      { 
        Label 
        { 
          Name R "Arial" 
          Size i -15 
          Type i 0 
          Color i 16711680 
        }
        Model 
        { 
          Name R "Arial" 
          Size i -15 
          Type i 0 
          Color i 16711680 
        }
      }
      Wiring 
      { 
        Manual i 0 
        Auto i 1 
        AutoModed i 0 
        Reroute i 1 
        Still i 0 
        AutoDelete i 1 
      }
    }
    __ELEMENTS_WIRES__
    InstSettings 
    { 
      MultiMeter 
      { 
        Mode i 2 
        InpType i 2 
        Value r:4 1 1 0.01 1 
        Scale i:4 1 3 0 2 
      }
      FuncGen 
      { 
        Mode i 1 
        Wave r:4 1 50 10 0 
        Symmetry i -1 
        Units i:2 0 2 
      }
      Oscilloscope 
      { 
        Pos i:6 0 29 1 4 0 1 
        Value i:6 17 0 3 17 0 3 
        Size i 0 
      }
      Bode 
      { 
        Data i:15 -1 -1 0 30 0 10 0 30 1 1 1 10 0 10 4 
      }
      WordGen 
      { 
        Pattern 
        { 
          Initial i 0 
          Final i 999 
        }
        Data i:5 3 1 1 10 1 
      }
      TruthTable 
      { 
        BoolExpr A "" 
        Mask i 0 
      }
      LogicAnalyzer 
      { 
        Values i:5 1 21 0 2 2 
        ClockMode i 0 
        Pattern A "xxxxxxxxxxxxxxxx" 
        Pattern A "xxxxxxxxxxxxxxxx" 
        Pattern A "xxxxxxxxxxxxxxxx" 
        ClksPerDiv i 0 
        LogicFrequency r:16 10 1 4.45619e-313 4.24399e-314 3.74267e-308 5.30245e-307 2.9708e-312 5.32741e-307 2.1171e-284 2.11816e-284 2.11706e-284 3.74274e-308 1.34774e-295 2.114e-284 3.74282e-308 5.33269e-307 
      }
    }
    WindowInfo 
    { 
      Position i:14 0 7 32 2033 947 -93 -393 2200 1700 0 0 0 0 0 
    }
    InstPos 
    { 
      Oscilloscope i:3 0 22 1 
      FuncGen i:3 6 22 1 
      Oscilloscope i:3 2 25 1 
      MultiMeter i:3 11 24 1 
      WordGen i:3 9 22 1 
      LogicAnalyzer i:3 9 22 1 
      TruthTable i:3 3 22 1 
      Bode i:3 8 23 1 
    }
    PBPos 
    { 
      PBNum i:6 0 2 0 68 70 134 
      PBNum i:6 1 0 55 68 461 177 
      PBNum i:6 2 1 86 68 461 177 
      PBNum i:6 3 0 117 68 391 142 
      PBNum i:6 4 2 148 68 430 177 
      PBNum i:6 5 2 187 68 391 142 
      PBNum i:6 6 2 218 68 391 142 
      PBNum i:6 7 2 249 68 453 142 
      PBNum i:6 8 2 288 68 616 177 
      PBNum i:6 9 2 319 68 554 177 
      PBNum i:6 10 2 358 68 663 142 
      PBNum i:6 11 2 389 68 803 142 
      PBNum i:6 12 2 420 68 857 142 
      PBNum i:6 13 2 459 68 694 142 
      PBNum i:6 14 2 -8 995 62 1061 
      PBNum i:6 15 2 -8 995 62 1061 
      PBNum i:6 16 2 -8 995 62 1061 
      PBNum i:6 17 2 -8 995 62 1061 
    }
    GrapherInfo 
    { 
      Shown i 0 
    }
    SimulationOptions 
    { 
      tolerance r 0.1 
      time_step r 3.5 
      abstol r 1e-12 
      chgtol r 1e-14 
      convabsstep r 0.1 
      convstep r 0.25 
      defad r 0 
      defas r 0 
      defl r 0.0001 
      defw r 0.0001 
      gmin r 1e-12 
      pivrel r 0.001 
      pivtol r 1e-13 
      ramptime r 0 
      reltol r 0.001 
      rshunt r 1e+12 
      temp r 27 
      tnom r 27 
      trtol r 7 
      vntol r 1e-06 
      tstep r 1e-05 
      tmax r 1e-05 
      thresh_volt r 3.5 
      globTemp r 3.5 
      bode_num_points i 100 
      auto_tmax i 1 
      tmax_enab i 0 
      tpoints i 100 
      uic i 2 
      display_opt_enab i 1 
      pre_trigger i 100 
      post_trigger i 1000 
      noopalter i 1 
      convlimit i 1 
      out_of_memory i 0 
      steady_state i 1 
      precision i 1 
      force_AC i 0 
      zero_init_cond i 0 
      time_step_index i 1 
      iterations i 100 
      anal_auto i 0 
      pause_at_end_of_screen i 0 
      num_points i 100 
      same_steps i 1 
      convabstep_enab i 0 
      convstep_enab i 0 
      gminsteps i 10 
      itl1 i 100 
      itl2 i 50 
      itl4 i 25 
      itl6 i 10 
      maxevtiter_enab i 0 
      maxevtiter i 2000 
      maxopalter_enab i 0 
      maxopalter i 1000 
      maxord i 2 
      rshunt_enab i 1 
      srcsteps i 10 
      acct i 1 
      bypass i 1 
      noOpIter i 0 
      tryToCompact i 0 
      integrateMethod i 1 
      eng_notation i 1 
    }
  }
}
`;

  return TEMPLATE.replace("__ELEMENTS_WIRES__", elementsAndWires);
}

export function addBaseElement<T extends Element>({
  circuit,
  name,
  rotation,
  x,
  y,
  data,
  modelName,
  ...additionalProps
}: {
  circuit: DeserializedCircuit;
  name: string;
  rotation: number;
  x: number;
  y: number;
  data: T["data"];
  modelName?: string;
  [additional: string]: unknown;
}) {
  const elem = {
    name,
    rotation,
    x,
    y,
    data,
    modelName: modelName ?? "",
    type: ElementType.BASE,
    _value: Object.values(data as Record<string, number>),
    _modelUnits: [0],
    _raw: {},
    _status: 0,
    connectedWires: [],
    ...additionalProps,
  } as Element;
  circuit.elements.push(elem);
  return elem;
}

function addExtensionElement({
  circuit,
  name,
  rotation,
  x,
  y,
  modelName,
  value,
  data,
}: {
  circuit: DeserializedCircuit;
  name: string;
  rotation: number;
  x: number;
  y: number;
  value: Record<string, number>;
  data: string;
  modelName?: string;
  [additional: string]: unknown;
}) {
  circuit.elements.push({
    name,
    rotation,
    x,
    y,
    data: { value, data },
    modelName: modelName ?? "",
    type: ElementType.EXTENSION,
    _value: Object.values(value), // I guess.....
    _modelUnits: [0],
    _raw: { Data: data },
    _status: 0,
    connectedWires: [],
  } satisfies Element);
}

function addWire({
  circuit,
  firstEndpoint,
  secondEndpoint,
  segments,
  color,
}: {
  circuit: DeserializedCircuit;
} & z.infer<typeof wireSchema>) {
  circuit.wires.push({
    firstEndpoint,
    secondEndpoint,
    segments: segments.map(({ direction, length }) => ({
      direction: WireDirection[direction],
      length,
    })),
    color,
    nodeP: "", // tbc
    wireId: circuit.wires.length,
    xFactor: 1,
    yFactor: 1,
  });
}

function multiplierIndex(mult: number): number {
  const index = MULTIPLIERS.findIndex((m) => m === mult);
  if (index === -1) {
    throw new Error(`Unsupported multiplier: ${mult}`);
  }
  return index;
}
let circuit: DeserializedCircuit | null = null;

export const handler = createMcpHandler(
  (server) => {
    console.log("mreowwww :3");
    server.registerTool(
      "get_agent_behavior_spec",
      {
        description:
          "MANDATORY STARTUP TOOL: call this first in every new task and read the entire EWB MCP agent behavior spec before using any circuit editing tools.",
        outputSchema: z.object({ text: z.string(), mimeType: z.string() }),
        annotations: {
          destructiveHint: false,
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        return ok({
          text: await Bun.file("./AGENT_BEHAVIOR_SPEC.md").text(),
          mimeType: "text/markdown",
        });
      },
    );
    server.registerTool(
      "get_docs",
      {
        description:
          "Optional reference documentation for exact EWB MCP tool schemas and file-format details. Use after get_agent_behavior_spec only when needed.",
        outputSchema: z.object({ text: z.string(), mimeType: z.string() }),
        annotations: {
          destructiveHint: false,
          readOnlyHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        return ok({
          text: await Bun.file("./MCP_DOCUMENTATION.md").text(),
          mimeType: "text/markdown",
        });
      },
    );
    function c() {
      if (!circuit) throw new Error("No circuit loaded");
      return circuit;
    }
    function ok<T extends Record<string, unknown>>(
      data: T,
      isError: boolean = false,
    ) {
      return {
        isError,
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: data,
      };
    }

    type CUDAddProps<T extends Element> = {
      rotation: number;
      x: number;
      y: number;
      data: T["data"];
      modelName?: string;
      [key: string]: unknown;
    };

    function CUD<T extends z.ZodObject<any>>(
      shortName: string,
      elementName: string,
      schema: T,
      config: { description: string },
      cbs: {
        add: (
          input: z.infer<T>,
          ctx: {
            add: <U extends Element>(
              props: CUDAddProps<U>,
            ) => ReturnType<typeof ok>;
          },
        ) => ReturnType<typeof ok>;
        update?: (
          input: {
            where: Partial<z.infer<T>>;
            data: Partial<z.infer<T>>;
          },
          ctx: {
            update: (
              where: Partial<z.infer<T>>,
              data: Partial<z.infer<T>>,
            ) => ReturnType<typeof ok>;
          },
        ) => ReturnType<typeof ok>;
        remove?: (
          input: { where: Partial<z.infer<T>> },
          ctx: {
            remove: (where: Partial<z.infer<T>>) => ReturnType<typeof ok>;
          },
        ) => ReturnType<typeof ok>;
      },
    ) {
      function add<U extends Element>(props: CUDAddProps<U>) {
        const circuit = c();
        const elem = addBaseElement({
          circuit,
          name: elementName,
          ...props,
        });
        return ok({
          action: "add",
          element: elementName,
          index: circuit.elements.length - 1,
          data: Object.fromEntries(
            Object.entries(elem).filter(([k]) => !k.startsWith("_")),
          ),
        });
      }

      function update(where: Partial<z.infer<T>>, data: Partial<z.infer<T>>) {
        const circuit = c();
        const matched: { index: number; elem: Element }[] = [];
        for (const [i, elem] of circuit.elements.entries()) {
          if (
            elem.name === elementName &&
            Object.entries(where).every(
              ([k, v]) =>
                (elem as Record<string, unknown>)[k] === v ||
                elem.data[k] === v,
            )
          ) {
            Object.assign(elem, data);
            matched.push({ index: i, elem });
          }
        }
        return ok({
          action: "update",
          element: elementName,
          updated: matched.length,
          matches: matched.map(({ index, elem }) => ({
            index,
            data: Object.fromEntries(
              Object.entries(elem).filter(([k]) => !k.startsWith("_")),
            ),
          })),
        });
      }

      function remove(where: Partial<z.infer<T>>) {
        const circuit = c();
        const indices: number[] = [];
        for (let i = circuit.elements.length - 1; i >= 0; i--) {
          const elem = circuit.elements[i]!;
          if (
            elem.name === elementName &&
            Object.entries(where).every(
              ([k, v]) =>
                (elem as Record<string, unknown>)[k] === v ||
                elem.data[k] === v,
            )
          ) {
            circuit.elements.splice(i, 1);
            indices.push(i);
          }
        }
        return ok({
          action: "remove",
          element: elementName,
          removed: indices.length,
          indices: indices.reverse(),
        });
      }

      server.registerTool(
        `add_${shortName}`,
        {
          description: config.description,
          inputSchema: schema,
          outputSchema: addOutputSchema,
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: false,
          },
        },
        // @ts-expect-error: T can not be resolved properly
        (input: z.infer<T>) => cbs.add(input, { add }),
      );

      const partialSchema = schema.partial();
      const updateFn =
        cbs.update ??
        ((
          input: { where: Partial<z.infer<T>>; data: Partial<z.infer<T>> },
          { update: u }: { update: typeof update },
        ) => u(input.where, input.data));
      const removeFn =
        cbs.remove ??
        ((
          input: { where: Partial<z.infer<T>> },
          { remove: r }: { remove: typeof remove },
        ) => r(input.where));

      server.registerTool(
        `update_${shortName}`,
        {
          description: config.description,
          inputSchema: z.object({ where: partialSchema, data: partialSchema }),
          outputSchema: updateOutputSchema,
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: false,
          },
        },
        async (input) =>
          updateFn(
            input as { where: Partial<z.infer<T>>; data: Partial<z.infer<T>> },
            { update },
          ),
      );
      server.registerTool(
        `delete_${shortName}`,
        {
          description: config.description,
          inputSchema: z.object({ where: partialSchema }),
          outputSchema: removeOutputSchema,
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            openWorldHint: false,
          },
        },
        (input) =>
          removeFn(input as { where: Partial<z.infer<T>> }, { remove }),
      );
    }
    server.registerTool(
      "new_file",
      {
        description: "Create a new EWB file",
        outputSchema: z.object({}),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      () => {
        circuit = { elements: [], wires: [] };
        return ok({});
      },
    );
    server.registerTool(
      "load_file",
      {
        description: "Load an EWB circuit file",
        outputSchema: loadFileSchema,
        inputSchema: z.object({ fileContents: z.string() }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      ({ fileContents }) => {
        console.log("woah got it!", fileContents);
        try {
          const decoded = decodeFile(fileContents);
          circuit = deserialize(decoded);
          console.log(circuit);
          return ok({
            status: "success",
            length: decoded.length,
          });
        } catch (err) {
          return ok(
            {
              status: "error",
              errorMessage: "Failed to load file",
            },
            true,
          );
        }
      },
    );
    CUD(
      "resistor",
      "RESISTOR",
      resistorSchema,
      {
        description: "Add a resistor to the circuit",
      },
      {
        add: (input, { add }) =>
          add<Resistor>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { resistance: input.resistance, TC1: 0, TC2: 0, Tnom: 5 },
            multipliers: {
              resistance: input.resistanceMultiplier,
              TC1: 0,
              TC2: 0,
              Tnom: 0,
            },
            _modelUnits: [multiplierIndex(input.resistanceMultiplier), 0, 0, 0],
          }),
      },
    );
    CUD(
      "battery",
      "BATTERY",
      batterySchema,
      {
        description: "Add a battery (DC voltage source) to the circuit",
      },
      {
        add: (input, { add }) =>
          add<Battery>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { voltage: input.voltage },
            multipliers: { voltage: input.voltageMultiplier },
            _modelUnits: [multiplierIndex(input.voltageMultiplier), 0, 0],
          }),
      },
    );
    CUD(
      "capacitor",
      "CAPACITOR",
      capacitorSchema,
      {
        description: "Add a capacitor to the circuit",
      },
      {
        add: (input, { add }) =>
          add<Capacitor>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { capacitance: input.capacitance },
            _modelUnits: [multiplierIndex(input.multiplier)],
          }),
        update: ({ where, data }, { update }) => update(where, data),
      },
    );
    CUD(
      "inductor",
      "INDUCTOR",
      inductorSchema,
      {
        description: "Add an inductor to the circuit",
      },
      {
        add: (input, { add }) =>
          add<Inductor>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { inductance: input.inductance },
            _modelUnits: [multiplierIndex(input.multiplier)],
          }),
      },
    );
    CUD(
      "ac_voltage_source",
      "AC_VOLTAGE_SOURCE",
      acVoltageSourceSchema,
      {
        description: "Add an AC voltage source to the circuit",
      },
      {
        add: (input, { add }) =>
          add<AcVoltageSource>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {
              peakVoltage: input.peakVoltage,
              frequency: input.frequency,
              phase: input.phase,
            },
          }),
      },
    );
    CUD(
      "dc_current_source",
      "DC_CURRENT_SOURCE",
      dcCurrentSourceSchema,
      {
        description: "Add a DC current source to the circuit",
      },
      {
        add: (input, { add }) =>
          add<DcCurrentSource>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { current: input.current },
          }),
      },
    );
    CUD(
      "ac_current_source",
      "AC_CURRENT_SOURCE",
      acCurrentSourceSchema,
      {
        description: "Add an AC current source to the circuit",
      },
      {
        add: (input, { add }) =>
          add<AcCurrentSource>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {
              peakCurrent: input.peakCurrent,
              frequency: input.frequency,
              phase: input.phase,
            },
          }),
      },
    );
    CUD(
      "fuse",
      "FUSE",
      fuseSchema,
      {
        description: "Add a fuse to the circuit",
      },
      {
        add: (input, { add }) =>
          add<Fuse>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { rating: input.rating, responseTime: input.responseTime },
          }),
      },
    );
    CUD(
      "relay",
      "RELAY",
      relaySchema,
      {
        description: "Add a relay to the circuit",
      },
      {
        add: (input, { add }) =>
          add<Relay>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {
              pickupVoltage: input.pickupVoltage,
              dropoutVoltage: input.dropoutVoltage,
              pickupTime: input.pickupTime,
              dropoutTime: input.dropoutTime,
            },
          }),
      },
    );
    CUD(
      "switch",
      "SWITCH",
      switchSchema,
      {
        description: "Add a (normally open) switch to the circuit",
      },
      {
        add: (input, { add }) =>
          add<Switch>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { initialState: input.initialState },
          }),
      },
    );
    CUD(
      "time_delay_switch",
      "TIME_DELAY_SWITCH",
      timeDelaySwitchSchema,
      {
        description: "Add a time-delay switch to the circuit",
      },
      {
        add: (input, { add }) =>
          add<TimeDelaySwitch>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {
              tOn: input.tOn,
              tOff: input.tOff,
              delayOn: input.delayOn,
              delayOff: input.delayOff,
            },
          }),
      },
    );
    CUD(
      "voltage_controlled_switch",
      "VOLTAGE_CONTROLLED_SWITCH",
      voltageControlledSwitchSchema,
      {
        description: "Add a voltage-controlled switch to the circuit",
      },
      {
        add: (input, { add }) =>
          add<VoltageControlledSwitch>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {
              rOn: input.rOn,
              rOff: input.rOff,
              threshold: input.threshold,
            },
          }),
      },
    );
    CUD(
      "current_controlled_switch",
      "CURRENT_CONTROLLED_SWITCH",
      currentControlledSwitchSchema,
      {
        description: "Add a current-controlled switch to the circuit",
      },
      {
        add: (input, { add }) =>
          add<CurrentControlledSwitch>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {
              rOn: input.rOn,
              rOff: input.rOff,
              threshold: input.threshold,
            },
          }),
      },
    );
    CUD(
      "ammeter",
      "AMMETER",
      ammeterSchema,
      {
        description:
          "Add an ammeter to the circuit (mode: 0=DC, 1=AC, resistance: minimum of 1)",
      },
      {
        add: (input, { add }) =>
          add<Ammeter>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { resistance: input.resistance, mode: input.mode },
            _modelUnits: [multiplierIndex(input.resistanceMultiplier)],
          }),
      },
    );
    CUD(
      "voltmeter",
      "VOLTMETER",
      voltmeterSchema,
      {
        description:
          "Add a voltmeter to the circuit (mode: 0=DC, 1=AC, resistance: minimum of 1)",
      },
      {
        add: (input, { add }) =>
          add<Voltmeter>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { resistance: input.resistance, mode: input.mode },
            _modelUnits: [multiplierIndex(input.resistanceMultiplier)],
          }),
      },
    );
    server.registerTool(
      "export_file",
      {
        description: "Export the current EWB circuit file to a string",
        inputSchema: z.object({ fileName: z.string() }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
        // outputSchema: z.object({ file: z.string() }),
      },
      async ({ fileName }) => {
        const circuit = c();
        const propBag = serialize(circuit);
        await Bun.file(fileName).write(propBag);
        const data = new TextEncoder().encode(propBag);
        const ewbText = encodeFile(data);
        return {
          content: [
            {
              type: "resource" as const,
              resource: { uri: `ewb://files/${fileName}`, text: ewbText },
            },
          ],
        };
      },
    );
    server.registerTool(
      "get_element_by_index",
      {
        description: "Get an element by its index in the circuit",
        inputSchema: z.object({
          index: z.number(),
          getHiddenFields: z.boolean().optional().default(false),
        }),
        outputSchema: elementDataOutputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ index, getHiddenFields }) => {
        const circuit = c();
        const elem = circuit.elements[index];
        if (!elem)
          return ok(
            {
              status: "error",
              errorMessage: "Element not found",
            },
            true,
          );
        return ok({
          status: "success",
          element: elem.name,
          index,
          data: Object.fromEntries(
            Object.entries(elem.data).filter(
              ([k]) => getHiddenFields || !k.startsWith("_"),
            ),
          ),
        });
      },
    );
    // find elements
    server.registerTool(
      "find_elements",
      {
        description:
          "Find elements in the circuit matching optional name and criteria",
        inputSchema: z.object({
          elementName: z.string().optional(),
          where: z.record(z.string(), z.unknown()).optional(),
          getHiddenFields: z.boolean().optional().default(false),
        }),
        outputSchema: findOutputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ elementName, where, getHiddenFields }) => {
        const circuit = c();
        const matches: { index: number; elem: Element }[] = [];
        for (const [i, elem] of circuit.elements.entries()) {
          if (elementName && elem.name !== elementName) continue;
          if (
            where &&
            !Object.entries(where).every(
              ([k, v]) =>
                (elem as Record<string, unknown>)[k] === v ||
                elem.data[k] === v,
            )
          )
            continue;
          matches.push({ index: i, elem });
        }
        return ok({
          action: "find",
          element: elementName ?? "*",
          total: matches.length,
          matches: matches.map(({ index, elem }) => ({
            index,
            data: Object.fromEntries(
              Object.entries(elem).filter(
                ([k]) => getHiddenFields || !k.startsWith("_"),
              ),
            ),
          })),
        });
      },
    );
    // wires
    server.registerTool(
      "add_wire",
      {
        description: "Add a wire to the circuit",
        inputSchema: wireSchema,
        outputSchema: addOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      (input) => {
        const circuit = c();
        addWire({ circuit, ...input });
        return ok({
          action: "add",
          element: "WIRE",
          index: circuit.wires.length - 1,
          data: { ...input, wireId: circuit.wires.length - 1 },
        });
      },
    );
    server.registerTool(
      "update_wire",
      {
        description: "Update wires in the circuit",
        inputSchema: z.object({
          where: wireSchema.partial(),
          data: wireSchema.partial(),
        }),
        outputSchema: updateOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ where, data }) => {
        const circuit = c();
        const matched: { index: number; wire: ChangedWire }[] = [];
        for (const [i, wire] of circuit.wires.entries()) {
          if (
            Object.entries(where).every(
              ([k, v]) => wire[k as keyof ChangedWire] === v,
            )
          ) {
            Object.assign(wire, data);
            matched.push({ index: i, wire });
          }
        }
        return ok({
          action: "update",
          element: "WIRE",
          updated: matched.length,
          matches: matched.map(({ index, wire }) => ({ index, data: wire })),
        });
      },
    );
    server.registerTool(
      "find_wires",
      {
        description: "Find wires in the circuit matching optional criteria",
        inputSchema: z.object({
          where: z.record(z.string(), z.unknown()).optional(),
        }),
        outputSchema: findOutputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ where }) => {
        const circuit = c();
        const matches: { index: number; wire: ChangedWire }[] = [];
        for (const [i, wire] of circuit.wires.entries()) {
          if (
            where &&
            !Object.entries(where).every(
              ([k, v]) => wire[k as keyof ChangedWire] === v,
            )
          )
            continue;
          matches.push({ index: i, wire });
        }
        return ok({
          action: "find",
          element: "WIRE",
          total: matches.length,
          matches: matches.map(({ index, wire }) => ({ index, data: wire })),
        });
      },
    );
    server.registerTool(
      "delete_wire",
      {
        description: "Delete wires from the circuit",
        inputSchema: z.object({ where: wireSchema.partial() }),
        outputSchema: removeOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: false,
        },
      },
      async ({ where }) => {
        const circuit = c();
        const indices: number[] = [];
        for (let i = circuit.wires.length - 1; i >= 0; i--) {
          const wire = circuit.wires[i]!;
          if (
            Object.entries(where).every(
              ([k, v]) => wire[k as keyof ChangedWire] === v,
            )
          ) {
            circuit.wires.splice(i, 1);
            indices.push(i);
          }
        }
        return ok({
          action: "remove",
          element: "WIRE",
          removed: indices.length,
          indices: indices.reverse(),
        });
      },
    );
  },
  {
    instructions:
      "URGENT: At the very start of every task, immediately call 'get_agent_behavior_spec' and read the entire behavior spec before using any circuit editing tools. Do not skip this step. Call 'get_docs' only when you need exact reference details. Also call 'tools/list' to discover all available tools — the client may not show all of them otherwise.",
    capabilities: {
      tools: {},
      resources: {},
    },
  },
  {
    basePath: "/api",
    verboseLogs: true,
    redisUrl: "redis://localhost:6379",
  },
);
