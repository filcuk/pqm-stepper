import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transform, parseSteps } from "../app/transform.js";
import { loadTransformMapping } from "./helpers.js";

const mapping = loadTransformMapping();

describe("single-line let", () => {
  it("parses and renames same-line declarations", () => {
    const input =
      'let Source = Excel.Workbook(File.Contents("a.xlsx"), null, true), #"Changed Type" = Table.TransformColumnTypes(Source, {{"A", type text}}) in #"Changed Type"';

    const steps = parseSteps(input);
    assert.deepEqual(
      steps.map((s) => (s.isQuoted ? `#"${s.name}"` : s.name)),
      ["Source", '#"Changed Type"']
    );

    const { output, warnings } = transform(input, mapping, {
      namingMode: "numbered",
    });
    assert.equal(
      output,
      'let Workbook = Excel.Workbook(File.Contents("a.xlsx"), null, true), Type = Table.TransformColumnTypes(Workbook, {{"A", type text}}) in Type'
    );
    assert.deepEqual(warnings, []);
  });

  it("warns when a let block has no step declarations", () => {
    const { output, warnings } = transform("let\nin\n    1", mapping);
    assert.equal(output, "let\nin\n    1");
    assert.ok(
      warnings.some((w) =>
        w.includes("Found a let block but no step declarations")
      )
    );
  });

  it("does not treat record fields as steps", () => {
    const input = `let
    Src = Sql.Database("srv", "db", [
        Query = "select 1"
    ]),
    #"Changed Type" = Table.TransformColumnTypes(Src, {{"Query", type text}})
in
    #"Changed Type"`;

    const steps = parseSteps(input);
    assert.deepEqual(
      steps.map((s) => s.name),
      ["Src", "Changed Type"]
    );
  });
});
