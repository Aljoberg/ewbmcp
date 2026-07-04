import {
  type AcCurrentSource,
  type AcVoltageSource,
  type Ammeter,
  type Battery,
  type Bulb,
  type Capacitor,
  type ChangedWire,
  type Comp,
  type Connector,
  type CurrentControlledSwitch,
  type DcCurrentSource,
  type DeserializedCircuit,
  type Diode,
  type DigitalNode,
  type Element,
  type ExtComp,
  type Fuse,
  type Ground,
  type Inductor,
  type Instrument,
  type Led,
  type NpnTransistor,
  type PnpTransistor,
  type Project51,
  type Relay,
  type Resistor,
  type Switch,
  type TimeDelaySwitch,
  type Transformer,
  type VoltageControlledSwitch,
  type Voltmeter,
  type ZenerDiode,
  ElementType,
  MULTIPLIERS,
  PartNum,
  rotationFromEwbIndex,
} from "./types";
import { parse } from "./parser";

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function deserialize(contents: Uint8Array) {
  const parsed = parse(contents) as unknown as { Project_5_1: Project51 };

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

  const changedElements: Element[] = [];

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
          label: comp.Label,
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
          label: comp.Label,
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
