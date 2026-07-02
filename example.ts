import { addBaseElement, deserialize, serialize } from ".";
import { decodeFile, encodeFile } from "./ewb";
import type { Resistor } from "./types";

const circuit = deserialize(
  decodeFile(await Bun.file(process.argv[2]!).text()),
);

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

const out = encodeFile(new TextEncoder().encode(serialize(circuit)));
console.log(out);
await Bun.file("output.ewb").write(out);
