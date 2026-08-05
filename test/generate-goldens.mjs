import { transform } from "../app/transform.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mapping = JSON.parse(readFileSync(join(root, "app/mapping.json"), "utf8"));
delete mapping["$version"];

const outDir = join(root, "test/fixtures/golden");
mkdirSync(outDir, { recursive: true });

for (const file of ["merge_customers.pq", "example_1.pq", "csv_sales.pq"]) {
  const input = readFileSync(join(root, "examples", file), "utf8");
  const { output } = transform(input, mapping, { namingMode: "verbose" });
  const outName = file.replace(/\.pq$/, ".verbose.pq");
  writeFileSync(join(outDir, outName), output);
  console.log("wrote", outName);
}
