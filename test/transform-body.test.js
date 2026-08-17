import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transform, parseSteps } from "../app/transform.js";
import { loadTransformMapping } from "./helpers.js";

const mapping = loadTransformMapping();

describe("getStepBody uses declaration index", () => {
  it("extracts the declaration body when the name is referenced earlier", () => {
    const input = `let
    Earlier = #"Changed Type",
    #"Changed Type" = Table.TransformColumnTypes(Source, {{"A", type text}})
in
    Earlier`;

    const steps = parseSteps(input);
    const changed = steps.find((s) => s.name === "Changed Type");
    assert.ok(changed);
    assert.ok(changed.eqIndex > input.indexOf('Earlier = #"Changed Type"'));

    const { output, warnings } = transform(input, mapping, {
      namingMode: "numbered",
    });
    assert.match(output, /Type\s*=\s*Table\.TransformColumnTypes/);
    assert.match(output, /Earlier\s*=\s*Type/);
    assert.ok(!output.includes('Earlier = #"Changed Type"'));
    assert.deepEqual(
      warnings.filter((w) => w.includes("Could not extract")),
      []
    );
  });
});
