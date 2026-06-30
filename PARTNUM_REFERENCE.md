# PartNum Reference for Electronics Workbench 5.12

## PartNum -> Component Mapping

Decoded from the pointer table at `0x0056b20c` in WEWB32.EXE.

| PartNum | Internal Name                            | Example RefID                       |
| ------- | ---------------------------------------- | ----------------------------------- |
| 0       | AC_VOLTAGE_SOURCE                        |                                     |
| 1       | RESISTOR                                 | R1                                  |
| 2       | BATTERY                                  |                                     |
| 3       | CAPACITOR                                |                                     |
| 4       | DIODE                                    |                                     |
| 5       | NPN_TRANSISTOR                           |                                     |
| 6       | INDUCTOR                                 | (also tags `Instrument { }` blocks) |
| 7       | AC_CURRENT_SOURCE                        |                                     |
| 8       | GROUND                                   | "0"                                 |
| 9       | CONNECTOR                                | CONN1, CONN2                        |
| 10      | DC_CURRENT_SOURCE                        |                                     |
| 11      | PNP_TRANSISTOR                           |                                     |
| 12      | AMMETER                                  |                                     |
| 13      | VOLTMETER                                |                                     |
| 14      | TRANSFORMER                              |                                     |
| 15      | OPAMP                                    |                                     |
| 16      | ZENER_DIODE                              |                                     |
| 17      | LED                                      |                                     |
| 18      | BULB                                     |                                     |
| 19      | FUSE                                     |                                     |
| 20      | RELAY                                    |                                     |
| 21      | TIME_DELAY_SWITCH                        |                                     |
| 22      | N_CHANNEL_JFET                           |                                     |
| 23      | P_CHANNEL_JFET                           |                                     |
| 24      | 3_TERMINAL_DEPLETION_N_MOSFET            |                                     |
| 25      | 3_TERMINAL_DEPLETION_P_MOSFET            |                                     |
| 26      | 4_TERMINAL_DEPLETION_N_MOSFET            |                                     |
| 27      | 4_TERMINAL_DEPLETION_P_MOSFET            |                                     |
| 28      | 3_TERMINAL_ENHANCEMENT_N_MOSFET          |                                     |
| 29      | 3_TERMINAL_ENHANCEMENT_P_MOSFET          |                                     |
| 30      | 4_TERMINAL_ENHANCEMENT_N_MOSFET          |                                     |
| 31      | 4_TERMINAL_ENHANCEMENT_P_MOSFET          |                                     |
| 32      | VOLTAGE_CONTROLLED_VOLTAGE_SOURCE (VCVS) |                                     |
| 33      | CURRENT_CONTROLLED_CURRENT_SOURCE (CCCS) |                                     |
| 34      | VOLTAGE_CONTROLLED_CURRENT_SOURCE (VCCS) |                                     |
| 35      | CURRENT_CONTROLLED_VOLTAGE_SOURCE (CCVS) |                                     |
| 36      | VOLTAGE_CONTROLLED_SWITCH                |                                     |
| 37      | CURRENT_CONTROLLED_SWITCH                |                                     |
| 38      | SWITCH                                   |                                     |
| 39      | NODE (digital pin)                       | numbers (1, 2, 3...)                |
| 40      | IC_TEMP                                  |                                     |
| 41      | SUB_TEMP                                 |                                     |

### Special PartNums

- **PartNum 6** also tags `Instrument { }` blocks in the property bag (not actual INDUCTOR components)
- **PartNum 99** tags `Model { }` blocks (SPICE model definitions)
- **PartNum 1000+**: ExtComp types, derived at runtime from a hash of the "CATEGORY:Type" name string

### Special Components

| Component Type | PartNum   | RefID Pattern            | Data Field                |
| -------------- | --------- | ------------------------ | ------------------------- |
| GROUND         | 8         | "0"                      | N/A                       |
| CONNECTOR      | 9         | "CONN1", "CONN2"         | N/A                       |
| NODE (digital) | 39        | number strings "1".."10" | N/A                       |
| CHIP:xxxx      | ExtComp   | "U1", "U2"               | part number (e.g. "4077") |
| ANALOG:textbox | ExtComp   | "PART1".."PART6"         | text label content        |
| DIGITAL:And2   | ExtComp   | "U1".."U6"               | ""                        |
| DIGITAL:Or2    | ExtComp   | "U1".."U6"               | ""                        |
| DIGITAL:Xnor2  | ExtComp   | "U1".."U6"               | ""                        |
| DIGITAL:Nor2   | ExtComp   | "U1".."U6"               | ""                        |
| DIGITAL:Nand2  | ExtComp   | "U1".."U6"               | ""                        |
| DIGITAL:Not    | ExtComp   | "U1".."U7"               | ""                        |
| Instrument     | PartNum=6 | N/A                      | N/A                       |

## Value Array Parameter Meanings

For each Comp in the property bag, the `Value r:N` array contains N doubles.
The `ModelUnits i:N` array contains the exponent prefix for display.

### ModelUnits Prefix Encoding

For each value in the Value array, the corresponding ModelUnits entry is:

| ModelUnits | Meaning          | Examples          |
| ---------- | ---------------- | ----------------- |
| 0          | base unit        | ohms, V, A, F, H  |
| 1          | 10^3 multiplier  | kohms, mA, nF, mH |
| 2          | 10^6 multiplier  | Mohm, uA, uF, H   |
| 3          | 10^-3 multiplier | mohm, mA          |

When ModelUnits is a single value (i:1), it applies to all parameters.
When it matches the Value array length (i:5 for r:5), each parameter has its own prefix.

---

### PartNum 0: AC_VOLTAGE_SOURCE

`Value r:5 [V_peak] [freq_Hz] [phase_deg] [0] [0]`

- V_peak = peak voltage
- freq_Hz = frequency in Hz
- phase_deg = phase in degrees

### PartNum 1: RESISTOR

`Value r:5 [R] [TC1] [TC2] [Tnom] [extra]`

- R = resistance in ohms
- TC1 = linear temperature coefficient (0 = none)
- TC2 = quadratic temperature coefficient (0 = none)
- Tnom = nominal temperature (0 = 27C default)
- extra = always 1 in observed files

Examples:

```
Value r:5 10 0 0 0 0     -> 10 ohm (modelUnits i:1 0 = ohms)
Value r:5 200 0 0 0 0    -> 200 ohm
Value r:5 1000 0 0 5 1   -> 1k ohm (modelUnits i:1 1 = kohms)
```

### PartNum 2: BATTERY / DC Source

`Value r:3 [V] [0] [0]`

### PartNum 3: CAPACITOR

`Value r:3 [C] [0] [0]`

- C = capacitance in farads (ModelUnits determines prefix: 2 = uF, 3 = nF)

### PartNum 6: INDUCTOR

`Value r:3 [L] [0] [0]`

- L = inductance in henries (ModelUnits determines prefix)

### PartNum 7: AC_CURRENT_SOURCE

`Value r:5 [I_peak] [freq_Hz] [phase_deg] [0] [0]`

### PartNum 8: GROUND

`Value r:1 0`

### PartNum 9: CONNECTOR

`Value r:1 0`

### PartNum 10: DC_CURRENT_SOURCE

`Value r:3 [I] [0] [0]`

### PartNum 12: AMMETER

`Value r:2 [mode] [0]`

- mode = 1 (likely AC/DC mode)

### PartNum 13: VOLTMETER

`Value r:2 [mode] [0]`

- mode = 1 (likely AC/DC mode)

### PartNum 19: FUSE

`Value r:2 [rating_A] [response_time?]`

### PartNum 20: RELAY

`Value r:4 [pickup_V] [dropout_V] [pickup_time] [dropout_time]`

### PartNum 21: TIME_DELAY_SWITCH

`Value r:4 [T_on] [T_off] [delay_on] [delay_off]`

### PartNum 36: VOLTAGE_CONTROLLED_SWITCH

`Value r:5 [R_on] [R_off] [V_threshold] [1e12] [1]`

### PartNum 37: CURRENT_CONTROLLED_SWITCH

`Value r:5 [R_on] [R_off] [I_threshold] [1e12] [1]`

### PartNum 38: SWITCH

`Value r:1 [initial_state?]`

### PartNum 39: NODE (digital pin)

`Value r:1 0`
Additional fields: `m_tptrElem A "U5^2"` (source component and pin), `m_flags i 0|8`

### Unconfirmed Value Arrays

The following PartNums have entries in the mapping but no .ewb file examples were available for analysis:

| PartNum | Name               | Likely Value Shape                              |
| ------- | ------------------ | ----------------------------------------------- |
| 4       | DIODE              | `r:?` (SPICE params through Model)              |
| 5       | NPN_TRANSISTOR     | `r:?` (SPICE params through Model)              |
| 11      | PNP_TRANSISTOR     | `r:?` (SPICE params through Model)              |
| 14      | TRANSFORMER        | `r:5 [ratio] [L1] [L2] [R1] [R2]` (speculative) |
| 15      | OPAMP              | `r:?` (likely gains + offsets)                  |
| 16      | ZENER_DIODE        | `r:? [Vz] [Iz] ...`                             |
| 17      | LED                | `r:?`                                           |
| 18      | BULB               | `r:? [power] [Vrated]`                          |
| 22-31   | JFETs / MOSFETs    | `r:?` (SPICE params through Model)              |
| 32-35   | Controlled Sources | `r:5 [gain] ...`                                |

These need to be verified by decoding .ewb files containing those components.

---

## Component Structure

### Basic Comp (PartNums 0-41)

```
PartNum i <N>
Position i:3 <rotation> <x> <y>     (rotation: 0=0deg, 1=90deg, 2=180deg, 3=270deg)
Value r:<M> <v0> <v1> ...
ModelUnits i:<M> <u0> <u1> ...
Common {
  RefID A "<refid>"                   ("R1", "C1", "U1", etc.)
}
ModelName R ""
Status i <0|1>                        (0=normal, 1=faulted?)
```

### ExtComp (PartNum 1000+)

```
Name R "CATEGORY:Type"
Position i:3 <rotation> <x> <y>
Value r:1 0                           (always 0 for ExtComp)
ModelUnits i:1 0
Common {
  RefID A "<refid>"
}
Data R "<part_number_or_text>"
ModelName R "ideal"
Status i 0
```

### Model Block (PartNum 99)

```
Model {
  Name R "<model_name>"
  PartNum i 99
  Params r:19 <... 19 SPICE params ...>
}
```

### Instrument Block (PartNum 6)

```
Instrument {
  PartNum i 6
  Pos i:3 <x> <y>
}
```

---

## ExtComp PartNum Tables (EWX Files)

ExtComp PartNums are assigned **dynamically at runtime** by extension DLLs, not from a fixed table. The EWX files define local component IDs used within each extension, which are hashed/combined with the category name at load time.

### DLL Registration (from EWBEXT.CNF)

```
ext\DIGITAL
ext\ANALOG
ext\CHIP
ext\MEP_A
ext\MEP_B
```

### Observed ExtComp Types from Circuit Files

These are the ExtComp types seen across sample `.out` files:

| Category:Type   | RefID Pattern | Data Field Content      | Notes            |
| --------------- | ------------- | ----------------------- | ---------------- |
| DIGITAL:And2    | U1-U6         | (empty)                 | 2-input AND gate |
| DIGITAL:Or2     | U1-U6         | (empty)                 | 2-input OR gate  |
| DIGITAL:Not     | U1-U7         | (empty)                 | Inverter         |
| DIGITAL:Nand2   | U1-U6         | (empty)                 | 2-input NAND     |
| DIGITAL:Nor2    | U1-U6         | (empty)                 | 2-input NOR      |
| DIGITAL:Xnor2   | U1-U6         | (empty)                 | 2-input XNOR     |
| DIGITAL:Xor2    | U1-U6         | (empty)                 | 2-input XOR      |
| CHIP:xxxx       | U1-U7         | part number e.g. "4077" | Digital IC       |
| ANALOG:textbox  | PART1-PARTn   | text label content      | Schematic text   |
| ANALOG:titleblk | (none)        | title block data        | Title block      |
| ANALOG:net8     | (none)        | network name            | Net label        |

### Extension Internal ID Ranges (from EWX binary analysis)

These are the **internal local IDs** (first argument to `EwbDefineComp`), NOT global PartNums:

| Extension | ID Range | Example Mappings                                                                                                                                                 |
| --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DIGITAL   | 29-117   | And2=29, Or2=36, Not=71, Nor2=50, Nand2=43, Xor2=57, Xnor2=64, And3-8, Or3-8, Nor3-8, Nand3-8, Xor3-8, Xnor3-8, JK, D, RS, HA, FA, Volt, Vdd, Pull, Seg7, AD, DA |
| CHIP      | 179-193  | TemplateAnd, TemplateOr, TemplateNot, etc. + chip templates IDs 11, 128-138 for 7400-7447 series                                                                 |
| ANALOG    | 38-781   | pot=41, opamp=46, 555=47, respk=60, clock=61, net8=768, textbox=780, titleblk=781                                                                                |

The global PartNum used in circuit files (1000+) is computed at runtime as:

```
PartNum = 1000 + hash("CATEGORY:Type") & 0xFFFF  (approximate)
```

This means PartNums may differ between installations if the hash function or load order changes.
