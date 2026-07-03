import { z } from "zod";

// misc

export const loadFileSchema = z.object({
  status: z.string(),
  length: z.number().optional(),
  errorMessage: z.string().optional(),
});

// wires

export const wireSchema = z.object({
  firstEndpoint: z.object({
    elementIndex: z.number(),
    pin: z.number(),
  }),
  secondEndpoint: z.object({
    elementIndex: z.number(),
    pin: z.number(),
  }),
  segments: z.array(
    z.object({
      direction: z.enum(["UP", "DOWN", "LEFT", "RIGHT"]),
      length: z.number(),
    }),
  ),
  color: z.number(), // may change
});

// base elements

export const rotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

export const multiplierSchema = z.union([
  z.literal(1),
  z.literal(1000),
  z.literal(1000000),
  z.literal(0.001),
]);

export const resistorSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  resistance: z.number(),
  resistanceMultiplier: multiplierSchema.optional().default(1),
});

export const batterySchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  voltage: z.number(),
  voltageMultiplier: multiplierSchema.optional().default(1000000),
});

export const capacitorSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  capacitance: z.number(),
  multiplier: multiplierSchema.optional().default(1),
});

export const inductorSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  inductance: z.number(),
  multiplier: multiplierSchema.optional().default(1),
});

export const acVoltageSourceSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  peakVoltage: z.number(),
  frequency: z.number(),
  phase: z.number(),
});

export const dcCurrentSourceSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  current: z.number(),
});

export const acCurrentSourceSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  peakCurrent: z.number(),
  frequency: z.number(),
  phase: z.number(),
});

export const fuseSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  rating: z.number(),
  responseTime: z.number().optional().default(0),
});

export const relaySchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  pickupVoltage: z.number(),
  dropoutVoltage: z.number(),
  pickupTime: z.number(),
  dropoutTime: z.number(),
});

export const switchSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  initialState: z
    .union([z.literal(0), z.literal(1)])
    .optional()
    .default(0),
});

export const timeDelaySwitchSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  tOn: z.number(),
  tOff: z.number(),
  delayOn: z.number(),
  delayOff: z.number(),
});

export const voltageControlledSwitchSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  rOn: z.number(),
  rOff: z.number(),
  threshold: z.number(),
});

export const currentControlledSwitchSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  rOn: z.number(),
  rOff: z.number(),
  threshold: z.number(),
});

export const ammeterSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  resistance: z.number().min(1).optional().default(1),
  mode: z
    .union([z.literal(0), z.literal(1)])
    .optional()
    .default(0),
  resistanceMultiplier: multiplierSchema.optional().default(0.001),
});

export const voltmeterSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  resistance: z.number().min(1).optional().default(1),
  mode: z
    .union([z.literal(0), z.literal(1)])
    .optional()
    .default(0),
  resistanceMultiplier: multiplierSchema.optional().default(0.001),
});

export const groundSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
});

export const connectorSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
});

export const diodeSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
});

export const npnTransistorSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
});

export const pnpTransistorSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
});

export const transformerSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
});

export const zenerDiodeSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
});

export const ledSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
});

export const bulbSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  maxPower: z.number(),
  maxVoltage: z.number(),
});

export const gateTypeSchema = z.enum([
  "AND",
  "OR",
  "NOT",
  "NOR",
  "NAND",
  "XOR",
  "XNOR",
]);

export const gateSchema = z.object({
  rotation: rotationSchema.optional().default(0),
  x: z.number(),
  y: z.number(),
  gateType: gateTypeSchema,
  inputCount: z.number().min(2).max(8).optional().default(2),
});

export const probeSchema = z.object({
  rotation: z
    .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
    .optional()
    .default(0),
  x: z.number(),
  y: z.number(),
});

// output schemas

export const addOutputSchema = z.object({
  action: z.literal("add"),
  element: z.string(),
  index: z.number(),
  data: z.record(z.string(), z.unknown()),
});

export const updateOutputSchema = z.object({
  action: z.literal("update"),
  element: z.string(),
  updated: z.number(),
  matches: z.array(
    z.object({
      index: z.number(),
      data: z.record(z.string(), z.unknown()),
    }),
  ),
});

export const removeOutputSchema = z.object({
  action: z.literal("remove"),
  element: z.string(),
  removed: z.number(),
  indices: z.array(z.number()),
});

export const findOutputSchema = z.object({
  action: z.literal("find"),
  element: z.string(),
  total: z.number(),
  matches: z.array(
    z.object({
      index: z.number(),
      data: z.record(z.string(), z.unknown()),
    }),
  ),
});

export const elementDataOutputSchema = z.object({
  status: z.string(),
  element: z.string().optional(),
  index: z.number().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  errorMessage: z.string().optional(),
});
