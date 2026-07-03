import type { MultiplicativeOperator } from "typescript";
import type { WireDirection } from ".";

export interface ConfigBlock extends Record<string, ConfigValue> {}

export type ConfigValue =
  | number
  | string
  | number[]
  | ConfigBlock
  | ConfigBlock[]
  | (number | string | number[] | ConfigBlock)[];

export interface Root {
  Project_5_1: Project51;
}

export interface Project51 {
  CircuitHeader: CircuitHeader;
  Circuit: Circuit;
}

export interface CircuitHeader {
  InternalCircuitVersion: number;
  ZoomFactor: number;
  VersionSpecific: VersionSpecific;
  Library: Library;
  PrintSettings: PrintSettings;
}

export interface VersionSpecific {
  SerialNo: string;
  Version: string;
  Ewb_Restrictions: EwbRestrictions;
}

export interface EwbRestrictions {
  Name: string;
  CircPass: string;
  Path: string;
  RelaxAll: number;
  Override: number;
  NoPrint: number;
  ReadOnly: number;
  NoFaults: number;
  NoSub: number;
  NoValues: number;
  NoModel: number;
  NoDisp: number;
  NoCAnal: number;
  NoParts: number;
  NoInst: number;
  NoFav: number;
  PBOpt: number;
  ANOpt: number;
  NoAnal: number[];
}

export interface Library {
  Name: string;
  Elements?: {
    ExtComp: ExtComp[];
  };
}

export interface PrintSettings {
  Choices: number[];
  WkSpacePageBrk: number;
  MacroPageBrk: number;
  PrintZoom: number;
}

export interface Circuit {
  Models?: Models;
  Preferences: Preferences;
  Elements: Elements;
  Wires: Wires;
  InstSettings: InstSettings;
  WindowInfo: WindowInfo;
  InstPos: InstPos;
  PBPos: Pbpos;
  GrapherInfo: GrapherInfo;
  SimulationOptions: SimulationOptions;
}

export interface Models {
  Model: Model[];
}

export interface Model {
  Name: string;
  PartNum: number;
  Params: number[];
}

export interface Preferences {
  Mode: number;
  Info: number[];
  ShowNodes: number;
  Fonts: Fonts;
  Wiring: Wiring;
}

export interface Fonts {
  Label: Label;
  Model: Model;
}

export interface Label {
  Name: string;
  Size: number;
  Type: number;
  Color: number;
}

export interface Model {
  Name: string;
  Size: number;
  Type: number;
  Color: number;
}

export interface Wiring {
  Manual: number;
  Auto: number;
  AutoModed: number;
  Reroute: number;
  Still: number;
  AutoDelete: number;
}

export interface Elements {
  Comp: Comp[];
  ExtComp?: ExtComp[];
  Instrument?: Instrument[];
}

export interface Comp {
  PartNum: number;
  Position: number[];
  Value?: number[];
  ModelUnits: number[];
  Common: Common;
  ModelName?: string;
  Status: number;
}

export interface Common {
  RefID: string;
}

export interface ExtComp {
  Name: string;
  Position: number[];
  Value?: number[];
  ModelUnits: number[];
  Common: Common;
  Data?: string;
  ModelName?: string;
  Status: number;
  Attributes?: Attributes;
  [key: string]: unknown;
}

export interface Attributes {
  Font: Font;
}

export interface Font {
  Name: string;
  Size: number;
  Type: number;
  Color: number;
}

export interface Instrument {
  PartNum: number;
  Pos: number[];
}

export interface Wires {
  wire: Wire | Wire[];
}

export interface Wire {
  /** [endpointA_idx, endpointA_pin, endpointB_idx, endpointB_pin]
   *  Indices are flat across all Elements (Comp + ExtComp + Instrument in order). */
  pos: [number, number, number, number];
  /** Visual routing segments: pairs of (direction, length).
   *  Direction: 1=right, 2=down, 4=left, 8=up (?) — needs Ghidra confirmation. */
  segs: number[];
  /** Color index (0 = default/black). */
  colour: number;
  /** Wire identifier. */
  wire_id: number;
  /** Electrical node/net name. Wires with same node_p are connected. */
  node_p: string;
  /** Display scale factor X. */
  x_factor: number;
  /** Display scale factor Y. */
  y_factor: number;
}

export interface InstSettings {
  MultiMeter: MultiMeter;
  FuncGen: FuncGen;
  Oscilloscope: Oscilloscope;
  Bode: Bode;
  WordGen: WordGen;
  TruthTable: TruthTable;
  LogicAnalyzer: LogicAnalyzer;
}

export interface MultiMeter {
  Mode: number;
  InpType: number;
  Value: number[];
  Scale: number[];
}

export interface FuncGen {
  Mode: number;
  Wave: number[];
  Symmetry: number;
  Units: number[];
}

export interface Oscilloscope {
  Pos: number[];
  Value: number[];
  Size: number;
}

export interface Bode {
  Data: number[];
}

export interface WordGen {
  Pattern: Pattern;
  Data: number[];
}

export interface Pattern {
  Initial: number;
  Final: number;
}

export interface TruthTable {
  BoolExpr: string;
  Mask: number;
}

export interface LogicAnalyzer {
  Values: number[];
  ClockMode: number;
  Pattern: string[];
  ClksPerDiv: number;
  LogicFrequency: number[];
}

export interface WindowInfo {
  Position: number[];
}

export interface InstPos {
  Oscilloscope: [number, number, number, number[]];
  FuncGen: number[];
  MultiMeter: number[];
  WordGen: number[];
  LogicAnalyzer: number[];
  TruthTable: number[];
  Bode: number[];
}

export interface Pbpos {
  PBNum: any[];
}

export interface GrapherInfo {
  Shown: number;
}

export interface SimulationOptions {
  tolerance: number;
  time_step: number;
  abstol: number;
  chgtol: number;
  convabsstep: number;
  convstep: number;
  defad: number;
  defas: number;
  defl: number;
  defw: number;
  gmin: number;
  pivrel: number;
  pivtol: number;
  ramptime: number;
  reltol: number;
  rshunt: number;
  temp: number;
  tnom: number;
  trtol: number;
  vntol: number;
  tstep: number;
  tmax: number;
  thresh_volt: number;
  globTemp: number;
  bode_num_points: number;
  auto_tmax: number;
  tmax_enab: number;
  tpoints: number;
  uic: number;
  display_opt_enab: number;
  pre_trigger: number;
  post_trigger: number;
  noopalter: number;
  convlimit: number;
  out_of_memory: number;
  steady_state: number;
  precision: number;
  force_AC: number;
  zero_init_cond: number;
  time_step_index: number;
  iterations: number;
  anal_auto: number;
  pause_at_end_of_screen: number;
  num_points: number;
  same_steps: number;
  convabstep_enab: number;
  convstep_enab: number;
  gminsteps: number;
  itl1: number;
  itl2: number;
  itl4: number;
  itl6: number;
  maxevtiter_enab: number;
  maxevtiter: number;
  maxopalter_enab: number;
  maxopalter: number;
  maxord: number;
  rshunt_enab: number;
  srcsteps: number;
  acct: number;
  bypass: number;
  noOpIter: number;
  tryToCompact: number;
  integrateMethod: number;
  eng_notation: number;
}

export const enum ElementType {
  BASE = "Comp", // Comp
  EXTENSION = "ExtComp", // ExtComp
  INSTRUMENT = "Instrument", // Instrument
}

export interface Element {
  name: string;
  rotation: number;
  x: number;
  y: number;
  refId?: string;
  modelName: string;
  data: Record<string, unknown>;
  /** Array of wire IDs connected to this element, ordered by pin index. */
  connectedWires: number[];
  type: ElementType;
  /** Raw Value array for serialization. */
  _value: number[] | null;
  /** Raw ModelUnits array for serialization. */
  _modelUnits: number[];
  /** Status field. */
  _status: number;
  /** Catch-all for extra raw properties not in the typed interface (e.g. m_tptrElem). */
  _raw: Record<string, unknown>;
  [k: string]: unknown; // anything specific
}

export interface AcVoltageSource extends Element {
  data: {
    peakVoltage: number;
    frequency: number;
    phase: number;
  };
}

export interface Resistor extends Element {
  data: {
    resistance: number;
    TC1: number;
    TC2: number;
    Tnom: number;
  };
  multipliers: {
    resistance: number;
    TC1: number;
    TC2: number;
    Tnom: number;
  };
}

export interface Battery extends Element {
  data: {
    voltage: number;
  };
  multipliers: {
    voltage: number;
  };
}

export interface Capacitor extends Element {
  data: {
    capacitance: number;
  };
}

export interface Inductor extends Element {
  data: {
    inductance: number;
  };
}

export interface AcCurrentSource extends Element {
  data: {
    peakCurrent: number;
    frequency: number;
    phase: number;
  };
}

export interface DcCurrentSource extends Element {
  data: {
    current: number;
  };
}

export interface Ammeter extends Element {
  data: {
    mode: number;
    resistance: number;
  };
  multipliers: {
    resistance: number;
  };
}

export interface Voltmeter extends Element {
  data: {
    mode: number;
    resistance: number;
  };
  multipliers: {
    resistance: number;
  };
}

export interface Fuse extends Element {
  data: {
    rating: number;
    responseTime: number;
  };
}

export interface Relay extends Element {
  data: {
    pickupVoltage: number;
    dropoutVoltage: number;
    pickupTime: number;
    dropoutTime: number;
  };
}

export interface TimeDelaySwitch extends Element {
  data: {
    tOn: number;
    tOff: number;
    delayOn: number;
    delayOff: number;
  };
}

export interface VoltageControlledSwitch extends Element {
  data: {
    rOn: number;
    rOff: number;
    threshold: number;
  };
}

export interface CurrentControlledSwitch extends Element {
  data: {
    rOn: number;
    rOff: number;
    threshold: number;
  };
}

export interface Switch extends Element {
  data: {
    initialState: number;
  };
}

export interface Ground extends Element {
  data: Record<string, never>;
}

export interface Connector extends Element {
  data: Record<string, never>;
}

export interface Diode extends Element {
  data: Record<string, never>;
}

export interface NpnTransistor extends Element {
  data: Record<string, never>;
}

export interface PnpTransistor extends Element {
  data: Record<string, never>;
}

export interface Transformer extends Element {
  data: Record<string, never>;
}

export interface ZenerDiode extends Element {
  data: Record<string, never>;
}

export interface Led extends Element {
  data: Record<string, never>;
}

export interface Bulb extends Element {
  data: {
    maxPower: number;
    maxVoltage: number;
  };
}

export interface DigitalNode extends Element {
  data: {
    m_tptrElem: string;
    m_flags: number;
  };
}

export interface ChangedWire {
  firstEndpoint: {
    elementIndex: number;
    pin: number;
  };
  secondEndpoint: {
    elementIndex: number;
    pin: number;
  };
  segments: {
    direction: WireDirection;
    length: number;
  }[];
  color: number;
  wireId: number;
  nodeP: string;
  xFactor: number;
  yFactor: number;
}

export interface DeserializedCircuit {
  elements: Element[];
  wires: ChangedWire[];
  // more tba
}
