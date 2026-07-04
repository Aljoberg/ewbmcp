import {
  ElementType,
  type AcCurrentSource,
  type AcVoltageSource,
  type Ammeter,
  type Battery,
  type Bulb,
  type Capacitor,
  type ChangedWire,
  type Connector,
  type CUDAddProps,
  type CUDCbsProps,
  type CurrentControlledSwitch,
  type DcCurrentSource,
  type DeserializedCircuit,
  type Diode,
  type Element,
  type Fuse,
  type Ground,
  type Inductor,
  type Led,
  type NpnTransistor,
  type PnpTransistor,
  type Relay,
  type Resistor,
  type Switch,
  type TimeDelaySwitch,
  type Transformer,
  type VoltageControlledSwitch,
  type Voltmeter,
  type ZenerDiode,
} from "./types";
import { z } from "zod";
import {
  acCurrentSourceSchema,
  acVoltageSourceSchema,
  addOutputSchema,
  ammeterSchema,
  batterySchema,
  bulbSchema,
  capacitorSchema,
  connectorSchema,
  currentControlledSwitchSchema,
  dcCurrentSourceSchema,
  diodeSchema,
  elementDataOutputSchema,
  findOutputSchema,
  fuseSchema,
  gateSchema,
  groundSchema,
  inductorSchema,
  ledSchema,
  loadFileSchema,
  npnTransistorSchema,
  pnpTransistorSchema,
  probeSchema,
  relaySchema,
  vccSchema,
  removeOutputSchema,
  resistorSchema,
  switchSchema,
  timeDelaySwitchSchema,
  transformerSchema,
  updateOutputSchema,
  voltageControlledSwitchSchema,
  voltmeterSchema,
  wireSchema,
  zenerDiodeSchema,
} from "./schemas";
import { decodeFile, encodeFile } from "./ewb";
import { serialize } from "./serializer";
import { deserialize } from "./deserializer";
import {
  addBaseElement,
  addWire,
  addExtensionElement,
  multiplierIndex,
  gateMatches,
  ok,
} from "./helpers";
import { createMcpHandler } from "mcp-handler";

// TODO redis
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

    function CUD<T extends z.ZodObject<any>>(
      shortName: string,
      elementName: string,
      schema: T,
      config: { description: string },
      cbs: CUDCbsProps<T>,
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
        try {
          const decoded = decodeFile(fileContents);
          circuit = deserialize(decoded);
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
    CUD(
      "ground",
      "GROUND",
      groundSchema,
      { description: "Add a ground reference to the circuit" },
      {
        add: (input, { add }) =>
          add<Ground>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {},
            _value: [0],
          }),
      },
    );
    CUD(
      "connector",
      "CONNECTOR",
      connectorSchema,
      { description: "Add a connector (junction point) to the circuit" },
      {
        add: (input, { add }) =>
          add<Connector>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {},
            _value: [0],
          }),
      },
    );
    CUD(
      "diode",
      "DIODE",
      diodeSchema,
      { description: "Add a diode to the circuit" },
      {
        add: (input, { add }) =>
          add<Diode>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {},
            _value: [0],
          }),
      },
    );
    CUD(
      "zener_diode",
      "ZENER_DIODE",
      zenerDiodeSchema,
      { description: "Add a zener diode to the circuit" },
      {
        add: (input, { add }) =>
          add<ZenerDiode>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {},
            _value: [0],
          }),
      },
    );
    CUD(
      "led",
      "LED",
      ledSchema,
      { description: "Add an LED to the circuit" },
      {
        add: (input, { add }) =>
          add<Led>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {},
            _value: [0],
          }),
      },
    );
    CUD(
      "npn_transistor",
      "NPN_TRANSISTOR",
      npnTransistorSchema,
      { description: "Add an NPN transistor to the circuit" },
      {
        add: (input, { add }) =>
          add<NpnTransistor>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {},
            _value: [0],
          }),
      },
    );
    CUD(
      "pnp_transistor",
      "PNP_TRANSISTOR",
      pnpTransistorSchema,
      { description: "Add a PNP transistor to the circuit" },
      {
        add: (input, { add }) =>
          add<PnpTransistor>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {},
            _value: [0],
          }),
      },
    );
    CUD(
      "transformer",
      "TRANSFORMER",
      transformerSchema,
      { description: "Add a transformer to the circuit" },
      {
        add: (input, { add }) =>
          add<Transformer>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: {},
            _value: [0],
          }),
      },
    );
    CUD(
      "bulb",
      "BULB",
      bulbSchema,
      { description: "Add a bulb (lamp) to the circuit" },
      {
        add: (input, { add }) =>
          add<Bulb>({
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            data: { maxPower: input.maxPower, maxVoltage: input.maxVoltage },
          }),
      },
    );

    server.registerTool(
      "add_gate",
      {
        description: "Add a logic gate to the circuit",
        inputSchema: gateSchema,
        outputSchema: addOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      (input) => {
        const circuit = c();
        const name =
          input.gateType === "NOT"
            ? "DIGITAL:Not"
            : `DIGITAL:${input.gateType[0]!.toUpperCase() + input.gateType.slice(1).toLowerCase()}${input.inputCount}`;
        addExtensionElement({
          circuit,
          name,
          rotation: input.rotation,
          x: input.x,
          y: input.y,
          value: {},
          data: "",
          modelName: "ideal",
        });
        return ok({
          action: "add",
          element: `${input.gateType}_GATE`,
          index: circuit.elements.length - 1,
          data: {
            name,
            gateType: input.gateType,
            inputCount: input.inputCount,
          },
        });
      },
    );
    server.registerTool(
      "update_gate",
      {
        description: "Update logic gates in the circuit",
        inputSchema: z.object({
          where: gateSchema.partial(),
          data: gateSchema.partial(),
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
        const matches: { index: number; elem: Element }[] = [];
        for (const [i, elem] of circuit.elements.entries()) {
          if (elem.type !== ElementType.EXTENSION) continue;
          if (!gateMatches(elem, where as Record<string, unknown>)) continue;
          matches.push({ index: i, elem });
        }
        for (const m of matches) {
          if (data.gateType !== undefined || data.inputCount !== undefined) {
            const t = data.gateType ?? "AND";
            const c =
              data.gateType === "NOT" ? undefined : (data.inputCount ?? 2);
            m.elem.name = c ? `DIGITAL:${t}${c}` : `DIGITAL:${t}`;
          }
          Object.assign(m.elem, data);
        }
        return ok({
          action: "update",
          element: "GATE",
          updated: matches.length,
          matches: matches.map(({ index, elem }) => ({
            index,
            data: Object.fromEntries(
              Object.entries(elem).filter(([k]) => !k.startsWith("_")),
            ),
          })),
        });
      },
    );
    server.registerTool(
      "delete_gate",
      {
        description: "Delete logic gates from the circuit",
        inputSchema: z.object({
          where: gateSchema.partial(),
        }),
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
        for (const [i, elem] of circuit.elements.entries()) {
          if (elem.type !== ElementType.EXTENSION) continue;
          if (!gateMatches(elem, where as Record<string, unknown>)) continue;
          indices.push(i);
        }
        for (let i = circuit.elements.length - 1; i >= 0; i--) {
          if (indices.includes(i)) circuit.elements.splice(i, 1);
        }
        return ok({
          action: "remove",
          element: "GATE",
          removed: indices.length,
          indices: indices.sort((a, b) => a - b),
        });
      },
    );
    CUD(
      "probe",
      "DIGITAL:ProbeR",
      probeSchema,
      { description: "Add a red logic probe to the circuit" },
      {
        add: (input, _ctx) => {
          const circuit = c();
          addExtensionElement({
            circuit,
            name: "DIGITAL:ProbeR",
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            value: {},
            data: "",
            modelName: "ideal",
          });
          return ok({
            action: "add",
            element: "PROBE",
            index: circuit.elements.length - 1,
            data: { name: "DIGITAL:ProbeR" },
          });
        },
      },
    );
    CUD(
      "vcc",
      "DIGITAL:Volt",
      vccSchema,
      { description: "Add a VCC (+5V) power source to the circuit" },
      {
        add: (input, _ctx) => {
          const circuit = c();
          addExtensionElement({
            circuit,
            name: "DIGITAL:Volt",
            rotation: input.rotation,
            x: input.x,
            y: input.y,
            value: {},
            data: "",
            modelName: "ideal",
          });
          return ok({
            action: "add",
            element: "VCC",
            index: circuit.elements.length - 1,
            data: { name: "DIGITAL:Volt" },
          });
        },
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
      "URGENT: At the very start, immediately call 'get_agent_behavior_spec' and read the entire behavior spec before using any circuit editing tools. Do not skip this step. Follow every instruction carefully. Call 'get_docs' only when you need exact reference details. Also call 'tools/list' to discover all available tools — the client may not show all of them otherwise.",
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
