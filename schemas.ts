import { z } from "zod";

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
  z.literal(1000000000),
]);

export const resistorSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  resistance: z.number(),
  resistanceMultiplier: multiplierSchema.optional().default(1),
});

export const batterySchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  voltage: z.number(),
});

export const capacitorSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  capacitance: z.number(),
  multiplier: multiplierSchema.optional().default(1),
});

export const inductorSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  inductance: z.number(),
  multiplier: multiplierSchema.optional().default(1),
});

export const acVoltageSourceSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  peakVoltage: z.number(),
  frequency: z.number(),
  phase: z.number(),
});

export const dcCurrentSourceSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  current: z.number(),
});

export const acCurrentSourceSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  peakCurrent: z.number(),
  frequency: z.number(),
  phase: z.number(),
});

export const fuseSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  rating: z.number(),
  responseTime: z.number().optional().default(0),
});

export const relaySchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  pickupVoltage: z.number(),
  dropoutVoltage: z.number(),
  pickupTime: z.number(),
  dropoutTime: z.number(),
});

export const switchSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  initialState: z
    .union([z.literal(0), z.literal(1)])
    .optional()
    .default(0),
});

export const timeDelaySwitchSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  tOn: z.number(),
  tOff: z.number(),
  delayOn: z.number(),
  delayOff: z.number(),
});

export const voltageControlledSwitchSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  rOn: z.number(),
  rOff: z.number(),
  threshold: z.number(),
});

export const currentControlledSwitchSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  rOn: z.number(),
  rOff: z.number(),
  threshold: z.number(),
});

export const ammeterSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  mode: z
    .union([z.literal(0), z.literal(1)])
    .optional()
    .default(0),
});

export const voltmeterSchema = z.object({
  rotation: rotationSchema,
  x: z.number(),
  y: z.number(),
  mode: z
    .union([z.literal(0), z.literal(1)])
    .optional()
    .default(0),
});
