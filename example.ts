import { addBaseElement, deserialize, serialize } from ".";
import type { Resistor } from "./types";

const circuit = deserialize(await Bun.file(process.argv[2]!).bytes());

// adds 500 ohm resistor (upor)
addBaseElement<Resistor>({
  circuit,
  name: "RESISTOR",
  rotation: 0,
  x: 1000,
  y: 1000,
  data: {
    resistance: 500,
    TC1: 0,
    TC2: 0,
    Tnom: 5,
  },
});

const out = serialize(circuit);
console.log(out);
await Bun.file("output.out").write(out);