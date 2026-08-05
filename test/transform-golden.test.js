import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transform } from "../app/transform.js";
import { loadTransformMapping, readRepo } from "./helpers.js";

const mapping = loadTransformMapping();

describe("golden examples (verbose)", () => {
  for (const file of ["merge_customers.pq", "example_1.pq", "csv_sales.pq"]) {
    it(`matches fixture for ${file}`, () => {
      const input = readRepo("examples", file);
      const expected = readRepo(
        "test/fixtures/golden",
        file.replace(/\.pq$/, ".verbose.pq")
      );
      const { output, warnings } = transform(input, mapping, {
        namingMode: "verbose",
      });
      assert.equal(output, expected);
      assert.deepEqual(warnings, []);
    });
  }
});
