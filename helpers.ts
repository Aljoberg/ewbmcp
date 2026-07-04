import {
  type DeserializedCircuit,
  type Element,
  ElementType,
  MULTIPLIERS,
  WireDirection,
} from "./types";

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

export function addExtensionElement({
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
    _value: Object.values(value),
    _modelUnits: [0],
    _raw: { Data: data },
    _status: 0,
    connectedWires: [],
  } satisfies Element);
}

export function addWire({
  circuit,
  firstEndpoint,
  secondEndpoint,
  segments,
  color,
}: {
  circuit: DeserializedCircuit;
  firstEndpoint: { elementIndex: number; pin: number };
  secondEndpoint: { elementIndex: number; pin: number };
  segments: { direction: string; length: number }[];
  color: number;
}) {
  circuit.wires.push({
    firstEndpoint,
    secondEndpoint,
    segments: segments.map(({ direction, length }) => ({
      direction: WireDirection[direction as keyof typeof WireDirection],
      length,
    })),
    color,
    nodeP: "",
    wireId: circuit.wires.length,
    xFactor: 1,
    yFactor: 1,
  });
}

export function multiplierIndex(mult: number) {
  const index = MULTIPLIERS.findIndex((m) => m === mult);
  if (index === -1) {
    throw new Error(`Unsupported multiplier: ${mult}`);
  }
  return index;
}

export function gateMatches(elem: Element, where: Record<string, unknown>) {
  if (where.gateType === undefined && where.inputCount === undefined) {
    return Object.entries(where).every(
      ([k, v]) =>
        (elem as Record<string, unknown>)[k] === v || elem.data[k] === v,
    );
  }
  const gateMatch = elem.name.match(
    /^DIGITAL:(And|Or|Not|Nor|Nand|Xor|Xnor)(\d*)$/i,
  );
  if (!gateMatch) return false;
  const type = gateMatch[1]!;
  const count = gateMatch[2] ? parseInt(gateMatch[2]!) : 1;
  if (where.gateType !== undefined && where.gateType !== type) return false;
  if (where.inputCount !== undefined && where.inputCount !== count)
    return false;
  return Object.entries(where).every(
    ([k, v]) =>
      k === "gateType" ||
      k === "inputCount" ||
      (elem as Record<string, unknown>)[k] === v ||
      elem.data[k] === v,
  );
}

export function ok<T extends Record<string, unknown>>(
  data: T,
  isError: boolean = false,
) {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}
