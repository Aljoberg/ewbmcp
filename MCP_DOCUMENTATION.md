# EWB Circuit Editor — MCP Server Documentation

## Overview

This MCP server provides read/write access to Electronics Workbench (EWB) circuit files (.ewb). It can parse, create, modify, and save circuit files — including components, wires, and all settings.

### Session Workflow

This is reference documentation. Agents should first call `get_agent_behavior_spec` and read the behavior spec. Use this document only when exact schemas, tool fields, or file-format details are needed.

1. **Start** — Call `new_file` to create a blank circuit, or `load_file` with raw .ewb contents to load an existing one.
2. **Operate** — Use any of the element/wire tools (add, update, delete, find) to inspect and modify the circuit.
3. **Export** — When the user asks for the file or at the end of the session, call `export_file` and present the result to the user.

### Sample Circuit

If the user asks for a sample/demo circuit, build a simple series circuit with a **battery**, a **resistor**, and an **ammeter**. Don't forget to set the ammeter's rotation so its pins face the right direction for wiring; `rotation: 180` puts ammeter pin `0` on the left and usually renders cleaner in left-to-right circuits.

## Tools

### Session Management

#### `new_file`

Create a new empty circuit (clears any loaded circuit).

- **Input**: `{}`
- **Output**: `{}`

---

#### `load_file`

Load an EWB circuit file from its string content.

- **Input**:
  - `fileContents` (string) — Raw .ewb file text (including headers)
- **Output**:
  - `status` ("success" | "error")
  - `length` (number, optional) — Uncompressed byte length
  - `errorMessage` (string, optional)

---

#### `export_file`

Export the current circuit to a .ewb file string. Also writes to a local file on disk (if a fileName is provided).

- **Input**:
  - `fileName` (string) — Name/path to write the file to
- **Output**: Resource content with `text` containing the .ewb string, URI `file:///ewb/{fileName}`

---

### Element Inspection

#### `get_element_by_index`

Get a single element by its flat index in the circuit's element array.

- **Input**:
  - `index` (number) — Element index
  - `getHiddenFields` (boolean, optional, default: false) — Include `_value`, `_modelUnits`, `_status`, `_raw` fields
- **Output**:
  - `status` ("success" | "error")
  - `element` (string, optional)
  - `index` (number, optional)
  - `data` (object, optional) — The element's data fields
  - `errorMessage` (string, optional)

---

#### `find_elements`

Search elements by name and/or criteria.

- **Input**:
  - `elementName` (string, optional) — Filter by element type name (e.g. "RESISTOR", "BATTERY")
  - `where` (object, optional) — Key-value criteria to match against element fields or data
  - `getHiddenFields` (boolean, optional, default: false) — Include internal fields
- **Output**:
  - `action` ("find")
  - `element` (string) — The searched name or `*`
  - `total` (number) — Number of matches
  - `matches` (array) — `{ index: number, data: object }[]`

---

### Component Create/Update/Delete (CUD)

Each component type has **three** tools: `add_<type>`, `update_<type>`, `delete_<type>`.

All components share these base fields:

- `rotation` (0 | 90 | 180 | 270) — **Rotation matters.** It flips which pins are on which side, which affects how wires connect. Always consider the orientation when placing components.
- `x` (number) — Grid X position (increases rightward)
- `y` (number) — Grid Y position (increases upward; **(0, 0) is bottom-left**)

> The EWB window opens at **x: 0–2000, y: 0–2000** centered around **x: 1000, y: 800**. There is **plenty of room** — space components out generously. Most components are ~60–80 px wide but an ammeter is ~150 px. Put things **at least 200 px apart** in x and y; you have the space and it keeps the schematic readable.

#### resistor

| Tool              | Input Fields                                                                       | Notes                          |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| `add_resistor`    | rotation, x, y, resistance, resistanceMultiplier? (1\|1000\|1e6\|0.001, default 1) | Also sets TC1=0, TC2=0, Tnom=5 |
| `update_resistor` | `{ where: Partial<input>, data: Partial<input> }`                                  | Matches by any field           |
| `delete_resistor` | `{ where: Partial<input> }`                                                        | Deletes matching elements      |

#### battery

| Tool             | Input Fields                                                                   |
| ---------------- | ------------------------------------------------------------------------------ |
| `add_battery`    | rotation, x, y, voltage, voltageMultiplier? (1\|1000\|1e6\|0.001, default 1e6) |
| `update_battery` | `{ where, data }`                                                              |
| `delete_battery` | `{ where }`                                                                    |

> Battery voltage uses a microvolt base in EWB. For ordinary volt values, use `voltageMultiplier: 1000000`, which serializes to `ModelUnits` index `2`.

#### capacitor

| Tool               | Input Fields                                                              |
| ------------------ | ------------------------------------------------------------------------- |
| `add_capacitor`    | rotation, x, y, capacitance, multiplier? (1\|1000\|1e6\|0.001, default 1) |
| `update_capacitor` | `{ where, data }`                                                         |
| `delete_capacitor` | `{ where }`                                                               |

#### inductor

| Tool              | Input Fields                                        |
| ----------------- | --------------------------------------------------- |
| `add_inductor`    | rotation, x, y, inductance, multiplier? (default 1) |
| `update_inductor` | `{ where, data }`                                   |
| `delete_inductor` | `{ where }`                                         |

#### ac_voltage_source

| Tool                       | Input Fields                                  |
| -------------------------- | --------------------------------------------- |
| `add_ac_voltage_source`    | rotation, x, y, peakVoltage, frequency, phase |
| `update_ac_voltage_source` | `{ where, data }`                             |
| `delete_ac_voltage_source` | `{ where }`                                   |

#### dc_current_source

| Tool                       | Input Fields            |
| -------------------------- | ----------------------- |
| `add_dc_current_source`    | rotation, x, y, current |
| `update_dc_current_source` | `{ where, data }`       |
| `delete_dc_current_source` | `{ where }`             |

#### ac_current_source

| Tool                       | Input Fields                                  |
| -------------------------- | --------------------------------------------- |
| `add_ac_current_source`    | rotation, x, y, peakCurrent, frequency, phase |
| `update_ac_current_source` | `{ where, data }`                             |
| `delete_ac_current_source` | `{ where }`                                   |

#### fuse

| Tool          | Input Fields                                              |
| ------------- | --------------------------------------------------------- |
| `add_fuse`    | rotation, x, y, rating, responseTime? (number, default 0) |
| `update_fuse` | `{ where, data }`                                         |
| `delete_fuse` | `{ where }`                                               |

#### relay

| Tool           | Input Fields                                                           |
| -------------- | ---------------------------------------------------------------------- |
| `add_relay`    | rotation, x, y, pickupVoltage, dropoutVoltage, pickupTime, dropoutTime |
| `update_relay` | `{ where, data }`                                                      |
| `delete_relay` | `{ where }`                                                            |

#### switch

| Tool            | Input Fields                                    |
| --------------- | ----------------------------------------------- |
| `add_switch`    | rotation, x, y, initialState? (0\|1, default 0) |
| `update_switch` | `{ where, data }`                               |
| `delete_switch` | `{ where }`                                     |

#### time_delay_switch

| Tool                       | Input Fields                                 |
| -------------------------- | -------------------------------------------- |
| `add_time_delay_switch`    | rotation, x, y, tOn, tOff, delayOn, delayOff |
| `update_time_delay_switch` | `{ where, data }`                            |
| `delete_time_delay_switch` | `{ where }`                                  |

#### voltage_controlled_switch

| Tool                               | Input Fields                         |
| ---------------------------------- | ------------------------------------ |
| `add_voltage_controlled_switch`    | rotation, x, y, rOn, rOff, threshold |
| `update_voltage_controlled_switch` | `{ where, data }`                    |
| `delete_voltage_controlled_switch` | `{ where }`                          |

#### current_controlled_switch

| Tool                               | Input Fields                         |
| ---------------------------------- | ------------------------------------ |
| `add_current_controlled_switch`    | rotation, x, y, rOn, rOff, threshold |
| `update_current_controlled_switch` | `{ where, data }`                    |
| `delete_current_controlled_switch` | `{ where }`                          |

#### ammeter

| Tool             | Input Fields                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `add_ammeter`    | rotation, x, y, resistance? (min 1, default 1), resistanceMultiplier?, mode? (0=DC \| 1=AC, default 0) |
| `update_ammeter` | `{ where, data }`                                                                                      |
| `delete_ammeter` | `{ where }`                                                                                            |

> **⚠️ CRITICAL: At `rotation: 0`, the ammeter's 0th pin is on the RIGHT side, pin 1 on the LEFT.** Do NOT rotate the ammeter to flip pins — rotation **negates the output** (current reads negative). Instead, just pick the correct pin index: use **pin 1** for the left connection and **pin 0** for the right connection.
> **Resistance must be >= 1.** A value of 0 causes a divide-by-zero and the circuit simulates as +INF.

#### voltmeter

| Tool               | Input Fields                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `add_voltmeter`    | rotation, x, y, resistance? (min 1, default 1), resistanceMultiplier?, mode? (0=DC \| 1=AC, default 0) |
| `update_voltmeter` | `{ where, data }`                                                                                      |
| `delete_voltmeter` | `{ where }`                                                                                            |

---

### CUD Output Schemas

All add/update/delete tools return one of:

**add**:

```json
{ "action": "add", "element": "<TYPE>", "index": <number>, "data": { ... } }
```

**update**:

```json
{ "action": "update", "element": "<TYPE>", "updated": <count>, "matches": [{ "index": <n>, "data": { ... } }] }
```

**delete**:

```json
{ "action": "remove", "element": "<TYPE>", "removed": <count>, "indices": [<numbers>] }
```

---

### Wire Tools

#### `find_wires`

Find wires in the circuit matching optional criteria.

- **Input**:
  - `where` (object, optional) — Key-value criteria to match against wire fields
- **Output**:
  - `action` ("find")
  - `element` ("WIRE")
  - `total` (number) — Number of matches
  - `matches` (array) — `{ index: number, data: ChangedWire }[]`

#### `add_wire`

- **Input**:
  - `firstEndpoint` — `{ elementIndex: number, pin: number }`
  - `secondEndpoint` — `{ elementIndex: number, pin: number }`
  - `segments` — Array of `{ direction: "UP" | "DOWN" | "LEFT" | "RIGHT", length: number }`
  - `color` (number)
- **Output**: `{ action: "add", element: "WIRE", index, data: { ... } }`

#### `update_wire`

- **Input**: `{ where: Partial<wireInput>, data: Partial<wireInput> }`
- **Output**: `{ action: "update", element: "WIRE", updated, matches }`

#### `delete_wire`

- **Input**: `{ where: Partial<wireInput> }`
- **Output**: `{ action: "remove", element: "WIRE", removed, indices }`

---

### Element Indexing

Elements are stored in a **flat array** ordered by their appearance in the original .ewb file. The order is: all `Comp` entries first (in insertion order), then `ExtComp` entries, then `Instrument` entries.

Wire endpoint indices refer to this flat element array.

---

## EWB File Format

### File Structure

```
Electronics Workbench Circuit File
Version: 5
Charset: ANSI
Description:
""
EncryptionType: 2
UsingVectorGraphics: 0

/<encoded_data>$!<8_hex_CRC>
```

### Encryption Type 2

The encoded body uses 5+3-bit split encoding + PKWARE "implosion" compression:

1. **Character encoding**: Each byte → two chars: `char1 = (byte >> 3) + 0x30`, `char2 = ((byte & 7) << 2) + 0x30`
2. **PKWARE compression**: Blocks separated by `$`, each independently compressed using LZSS-style implosion with Huffman-coded length/distance symbols
3. **CRC**: XOR of CRC-32 of each 0x400-byte chunk, appended as `$!XXXXXXXX`

### Internal Property Bag Format

Decompressed data is a text-based hierarchical token format:

```
Name {
  SubName i 42
  ArrayField i:3 1 2 3
  StringField R "hello world"
}
```

**Type codes**:

- `{ }` — Container (nested object)
- `i` / `i:N` — Int32 / Int32 array
- `r` / `r:N` — Double / Double array
- `A` / `R` — Quoted string (backslash-escaped)
- `M` — XOR-encoded uppercase string (not commonly used)

Duplicate field names are auto-collected into arrays.

### Top-Level Structure

```
Project_5_1 {
  CircuitHeader { ... }
  Circuit {
    Preferences { ... }
    Elements {
      Comp { PartNum i 1 Position i:3 0 100 200 Value r:1 1000 ... }
      ...
    }
    Wires {
      wire { pos i:4 0 0 1 0 segs i:4 1 50 2 30 colour i 0 ... }
      ...
    }
    InstSettings { ... }
    WindowInfo { ... }
    SimulationOptions { ... }
  }
}
```

---

## Part Number Reference

| ID    | Name                      | Value[] Fields                                         |
| ----- | ------------------------- | ------------------------------------------------------ |
| 0     | AC_VOLTAGE_SOURCE         | peakVoltage, frequency, phase                          |
| 1     | RESISTOR                  | resistance, TC1, TC2, Tnom                             |
| 2     | BATTERY                   | voltage                                                |
| 3     | CAPACITOR                 | capacitance                                            |
| 4     | DIODE                     | —                                                      |
| 5     | NPN_TRANSISTOR            | —                                                      |
| 6     | INDUCTOR                  | inductance                                             |
| 7     | AC_CURRENT_SOURCE         | peakCurrent, frequency, phase                          |
| 8     | GROUND                    | —                                                      |
| 9     | CONNECTOR                 | —                                                      |
| 10    | DC_CURRENT_SOURCE         | current                                                |
| 11    | PNP_TRANSISTOR            | —                                                      |
| 12    | AMMETER                   | mode (0=DC, 1=AC)                                      |
| 13    | VOLTMETER                 | mode (0=DC, 1=AC)                                      |
| 14    | TRANSFORMER               | —                                                      |
| 15    | OPAMP                     | —                                                      |
| 16    | ZENER_DIODE               | —                                                      |
| 17    | LED                       | —                                                      |
| 18    | BULB                      | —                                                      |
| 19    | FUSE                      | rating, responseTime                                   |
| 20    | RELAY                     | pickupVoltage, dropoutVoltage, pickupTime, dropoutTime |
| 21    | TIME_DELAY_SWITCH         | tOn, tOff, delayOn, delayOff                           |
| 22    | N_CHANNEL_JFET            | —                                                      |
| 23    | P_CHANNEL_JFET            | —                                                      |
| 24-29 | MOSFET (various)          | —                                                      |
| 30    | VCVS                      | —                                                      |
| 31    | CCCS                      | —                                                      |
| 32    | VCCS                      | —                                                      |
| 33    | CCVS                      | —                                                      |
| 34    | VOLTAGE_CONTROLLED_SWITCH | rOn, rOff, threshold                                   |
| 35    | CURRENT_CONTROLLED_SWITCH | rOn, rOff, threshold                                   |
| 36    | SWITCH                    | initialState                                           |
| 37    | NODE                      | m_tptrElem, m_flags                                    |

---

## Examples

### Load a circuit and read elements

```json
// 1. Load file
{
  "method": "tools/call",
  "params": { "name": "load_file", "arguments": { "fileContents": "<raw .ewb text>" } }
}

// 2. List elements
{
  "method": "tools/call",
  "params": { "name": "find_elements", "arguments": {} }
}

// 3. Get specific element
{
  "method": "tools/call",
  "params": { "name": "get_element_by_index", "arguments": { "index": 0, "getHiddenFields": false } }
}
```

### Add a 10kΩ resistor

```json
{
  "method": "tools/call",
  "params": {
    "name": "add_resistor",
    "arguments": {
      "rotation": 0,
      "x": 500,
      "y": 300,
      "resistance": 10,
      "resistanceMultiplier": 1000
    }
  }
}
```

### Wire two components together

```json
{
  "method": "tools/call",
  "params": {
    "name": "add_wire",
    "arguments": {
      "firstEndpoint": { "elementIndex": 0, "pin": 0 },
      "secondEndpoint": { "elementIndex": 1, "pin": 0 },
      "segments": [{ "direction": "RIGHT", "length": 50 }],
      "color": 0
    }
  }
}
```

### Export modified circuit

```json
{
  "method": "tools/call",
  "params": { "name": "export_file", "arguments": { "fileName": "output.ewb" } }
}
```
