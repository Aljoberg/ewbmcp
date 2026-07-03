# Agent Behavior Spec for the EWB MCP

This document is the mandatory operational starting point for agents using the EWB MCP. It is not a full API reference. Use `get_docs` only when you need exact tool schemas or file-format details.

# Core Circuit Behavior Upgrade (v2 ADDITION)

The MCP is not only a circuit editor.

It is a **complete circuit generator that MUST always produce:**

- Electrically valid circuits
- Closed-loop complete circuits
- Immediately runnable EWB schematics
- Visually clean and readable layouts

Partial or incomplete circuits are NOT valid final outputs.

---

# Circuit Completion & Quality Requirement (MANDATORY)

## 1. Electrical Validity (HARD REQUIREMENT)

A circuit is ONLY valid if:

- At least one closed loop exists
- Every voltage source has a return path to its negative terminal
- No floating or dangling components exist (unless explicitly requested)

Formal rule:

A valid circuit must allow traversal:

Battery(+) → components → Battery(−)

If not satisfied:

- The agent MUST fix the circuit automatically
- The agent MUST NOT export

---

## 2. Loop Closure Rule

If a circuit is a chain:

Battery → components → open end

Then the agent MUST:

- connect back to Battery(−)
- or introduce a proper return path

No open chains allowed in final output.

---

## 3. Auto-Ground Inference

If a return path is missing:

- Infer Battery(−) as reference ground
- Automatically complete return connection

Unless explicitly forbidden by the user.

---

## 4. Schematic Quality Rules

### Layout

- Battery: left side
- Flow: left → right
- Return path: bottom or clean loop back left
- Components aligned in rows for series circuits

### Wiring

- Prefer straight or single-segment wires
- Avoid crossings
- Keep wiring minimal and readable

---

## 5. Canonical Circuit Templates

Default builds MUST follow:

### Series DC Circuit

Battery → Ammeter → Resistor → Battery(−)

### RC Circuit

Battery → Resistor → Capacitor → Battery(−)

### Voltage Divider

Battery → R1 → R2 → Battery(−)

If user request is vague, use canonical template.

---

## 6. Ammeter Rules (STRICT)

- Must be in series path
- Must not break loop integrity
- Do NOT rotate the ammeter — rotation negates the output. Use pin 1 for the left connection and pin 0 for the right instead.
- Must always be part of closed loop

---

## 7. Pre-Export Validation (MANDATORY)

Before calling `export_file`, the agent MUST perform:

### A. Connectivity Check

- Confirm at least one closed loop exists
- Confirm Battery(+) connects to Battery(−)

### B. Completeness Check

- No floating components
- No open-ended wires

### C. Layout Check

- Left-to-right readability
- No overlapping components
- Minimal wire complexity

### D. Instrument Check

- Ammeter correctly placed in series
- No bypassed measurement devices

If any check fails:

- repair circuit
- re-validate
- only then export

---

## 8. Export Rule

Export is ONLY allowed when:

- Electrical validity is satisfied
- Schematic quality rules are satisfied
- Pre-export validation passes

If user requests early export:

- automatically fix circuit first
- then export final version

---

## Core Workflow

Every session starts by establishing the current circuit state.

1. If the user wants a new circuit, call `new_file`.
2. If the user provides or references an existing `.ewb` file, read the raw `.ewb` text and call `load_file` with `fileContents`.
3. Inspect or modify the in-memory circuit with element and wire tools.
4. When the user asks for an export, calls the work complete, or asks for the `.ewb`, call `export_file`.
5. Treat the resource text returned by `export_file` as the encoded `.ewb` payload to give back to the user.

Do not call element or wire tools before `new_file` or `load_file`. The MCP keeps one in-memory circuit; creating or loading a file replaces the current one.

## Startup Checklist

At the beginning of a task:

- This spec should already have been read through `get_agent_behavior_spec` before any editing tool is used.
- Call `get_docs` only if you need the full reference docs or exact schema details.
- Call `new_file` for blank-circuit construction.
- Call `load_file` for existing-circuit editing.
- Use `find_elements` and `find_wires` to understand an existing circuit before changing it.
- Record element indices returned by `add_*` tools. Wire endpoints use those indices.

For existing files, prefer inspection before mutation. Load the file, list elements and wires, then make targeted updates.

## Export Behavior

`export_file` serializes the current in-memory circuit and returns an MCP resource whose `text` is the `.ewb` file content.

Important behavior:

- The returned resource text is the thing to present as the exported EWB file.
- The `fileName` argument is still required.
- The current implementation also writes a local file side effect, but agents should not depend on that side effect as the user-facing encoded export.
- If the user only asks to keep editing, do not export early unless you need a checkpoint.

When manually using the repository's Python encoder instead of the MCP, encode with `ewb.py` using `--type 2 --compress`.

## Mental Model

The MCP edits a simplified circuit model:

- `elements`: a flat array of components, extension components, and instruments.
- `wires`: connections between element pins.

Wire endpoints refer to the flat element array:

```json
{ "elementIndex": 0, "pin": 1 }
```

The element index is not a schematic coordinate. It is the array index returned by `add_*`, `find_elements`, or `get_element_by_index`.

Deleting elements can make existing wire endpoint indices invalid. If you delete components, inspect wires afterward and update or delete affected wires.

## Coordinates and Placement

Use `x` and `y` to place components. Existing examples generally place visible components around `x: 1000`, `y: 800` or nearby - you should usually also place components there.

Practical placement rules:

- **The workspace is 2000 x 2000 pixels.** That is enormous. Use it.
- **Space components WAY out.** Put things at least **200 px apart** in x and y. The ammeter is ~150 px wide by itself, so 200 px is the bare minimum when one is involved.
- Most other components are ~60-80 px, so spacing them 200+ px apart makes the schematic readable instead of a tangled mess.
- Keep simple left-to-right circuits around the visible workspace center.
- Use consistent rows and columns so wire segments can be short and readable.
- Avoid overlapping elements. The MCP does not perform layout collision checks.

## Rotation and Pins

Rotation controls which side each pin appears on, so it directly affects wiring.

The MCP accepts public rotation values in degrees:

- `0`
- `90`
- `180`
- `270`

The implementation converts those degree values to EWB's internal `Position[0]` index when serializing and converts them back when loading files.

Pin conventions are component-specific. If you are unsure, inspect a known-good `.ewb` example containing the component and copy the pattern.

Known critical case:

- The ammeter's pin `0` is on the right side at `rotation: 0`, pin `1` on the left. Do NOT rotate the ammeter to flip pins — **rotation negates the output** (current reads negative). Instead, just pick the correct pin index: use **pin 1** for left connections, **pin 0** for right.

## Multipliers

Some component values are split into a numeric display value and a multiplier. Use the MCP's multiplier fields instead of pre-scaling the displayed number.

Supported multiplier values in the current schemas:

| Multiplier | Meaning in agent input              | Typical use                           |
| ---------- | ----------------------------------- | ------------------------------------- |
| `1`        | base unit                           | ohm, V, A, F, H                       |
| `1000`     | kilo-style display                  | kohm, kV, etc.                        |
| `1000000`  | mega/micro-style EWB display bucket | Mohm, uF, etc. depending on component |
| `0.001`    | milli/nano-style EWB display bucket | mA, nF, etc. depending on component   |

Examples:

- 10 kohm resistor: `resistance: 10`, `resistanceMultiplier: 1000`.
- 5 V battery: `voltage: 5`, `voltageMultiplier: 1000000`.
- 100 nF capacitor: `capacitance: 100`, `multiplier: 0.001`.

Do not enter 10 kohm as `resistance: 10000` with `resistanceMultiplier: 1` unless the user explicitly wants the base-unit display. The simulated value may be equivalent, but the schematic display and serialized `ModelUnits` will differ.

Battery note:

- EWB stores battery voltage with a microvolt base. For ordinary volt values, use `voltageMultiplier: 1000000`, which serializes to `ModelUnits` index `2`.
- The battery schema defaults `voltageMultiplier` to `1000000`; do not override it to `1` for normal volt batteries.

Current limitations:

- The schema does not accept `1e9`.
- Multiplier meanings come from EWB `ModelUnits`, and the visible unit label can depend on the component type.
- For loaded files, inspect returned `multipliers` or hidden `_modelUnits` when exact display preservation matters.

## Element Tools

Use `add_<type>` to create supported base components:

- `add_resistor`
- `add_battery`
- `add_capacitor`
- `add_inductor`
- `add_ac_voltage_source`
- `add_dc_current_source`
- `add_ac_current_source`
- `add_fuse`
- `add_relay`
- `add_switch`
- `add_time_delay_switch`
- `add_voltage_controlled_switch`
- `add_current_controlled_switch`
- `add_ammeter`
- `add_voltmeter`
- `add_ground`
- `add_connector`
- `add_diode`
- `add_zener_diode`
- `add_led`
- `add_npn_transistor`
- `add_pnp_transistor`
- `add_transformer`
- `add_bulb`

Use `find_elements` before bulk updates or deletes. `update_*` and `delete_*` match every element satisfying `where`, not just the first match.

For exact edits:

1. Use `find_elements` with a narrow `where`.
2. Confirm match count.
3. Use `update_*` or `delete_*`.

If you need raw preservation details, call `find_elements` or `get_element_by_index` with `getHiddenFields: true`.

## Wire Tools

Use `add_wire` to connect two element pins.

Each wire needs:

- `firstEndpoint`: `{ elementIndex, pin }`
- `secondEndpoint`: `{ elementIndex, pin }`
- `segments`: visual route instructions
- `color`: usually `0`

Directions are passed as strings:

- `RIGHT`
- `UP`
- `LEFT`
- `DOWN`

Keep wire paths simple. For a basic side-by-side connection, one straight segment is usually enough:

```json
{
  "firstEndpoint": { "elementIndex": 0, "pin": 0 },
  "secondEndpoint": { "elementIndex": 1, "pin": 1 },
  "segments": [{ "direction": "RIGHT", "length": 80 }],
  "color": 0
}
```

Use `find_wires` after wiring an existing circuit to confirm endpoints. Use `delete_wire` carefully because it can remove multiple matching wires.

## Building a Simple Circuit

For a simple generated demo, use this flow:

1. `new_file`
2. Add a battery near the left.
3. Add a resistor to the right of the battery.
4. Add an ammeter in series (keep `rotation: 0`; use **pin 1** for left-side connections, **pin 0** for right).
5. Add wires between adjacent pins.
6. Inspect with `find_elements` and `find_wires`.
7. Export only when the user asks for the `.ewb` or final file.

Do not assume the first wiring attempt is visually correct if rotations are involved. Prefer simple placements and minimal rotations.

## Editing Existing Circuits

When modifying an existing `.ewb`:

1. `load_file`
2. `find_elements` with `getHiddenFields: false` for a readable overview.
3. `find_wires` to understand connectivity.
4. Use `get_element_by_index` for specific components.
5. Make targeted changes.
6. Reinspect the changed elements and affected wires.
7. `export_file` when requested.

Preserve unknown fields. Avoid deleting and recreating components in existing files unless necessary, because loaded components may contain raw fields the simplified add tools do not recreate.

## Practical Cautions

- This MCP is an editor, not a circuit simulator. It does not validate electrical correctness.
- It does not automatically route wires around obstacles.
- It does not guarantee pin semantics for every part. Use known-good sample files when pin order matters.
- Hidden fields beginning with `_` are serialization details. Read them when preserving fidelity, but do not invent them in normal agent workflows.
- `find_elements` and `find_wires` criteria use exact equality. Nested object matching is not deep matching.
- Empty `where` objects on update/delete tools can match everything of that tool's element type. Avoid broad deletes unless the user clearly asked for them.

## When to Consult Reference Docs

Use `get_docs` for:

- Full tool schemas
- Output shapes
- File-format notes

Use existing `.ewb` examples for:

- Pin order
- Rotations
- Real component spacing
- Wire segment patterns
