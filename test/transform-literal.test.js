import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transform } from "../app/transform.js";
import { loadTransformMapping, readRepo } from "./helpers.js";

const mapping = loadTransformMapping();

describe("literal-safe replacements", () => {
  it("does not rewrite sheet names or paths that match step names", () => {
    const input = readRepo("examples", "merge_customers.pq");
    const { output } = transform(input, mapping, { namingMode: "verbose" });

    assert.match(output, /WorkbookOrders\s*=/);
    assert.match(output, /WorkbookCustomers\s*=/);
    assert.ok(output.includes("Orders.xlsx"));
    assert.ok(output.includes("Customers.xlsx"));
    assert.ok(output.includes('Item="Orders"'));
    assert.ok(output.includes('Item="Customers"'));
    assert.ok(!output.includes("WorkbookOrders.xlsx"));
    assert.ok(!output.includes('Item="WorkbookOrders"'));
  });

  it("does not rewrite string literals that shadow an unquoted step name", () => {
    const input = `let
    Source = Excel.Workbook(File.Contents("C:\\Source\\data.xlsx"), null, true),
    #"Renamed Columns" = Table.RenameColumns(Source, {{"Source", "Origin"}})
in
    #"Renamed Columns"`;

    const { output } = transform(input, mapping, { namingMode: "numbered" });

    assert.match(output, /Workbook\s*=/);
    assert.ok(output.includes("C:\\Source\\data.xlsx"));
    assert.ok(output.includes('{"Source", "Origin"}'));
    assert.ok(!output.includes("C:\\Workbook\\data.xlsx"));
    assert.ok(!output.includes('{"Workbook", "Origin"}'));
  });

  it("does not rewrite identifiers inside comments", () => {
    const input = `let
    // Source is the workbook
    Source = Excel.Workbook(File.Contents("a.xlsx"), null, true),
    #"Changed Type" = Table.TransformColumnTypes(Source, {{"A", type text}})
in
    #"Changed Type"`;

    const { output } = transform(input, mapping, { namingMode: "numbered" });

    assert.ok(output.includes("// Source is the workbook"));
    assert.match(output, /Workbook\s*=/);
    assert.ok(output.includes("TransformColumnTypes(Workbook,"));
  });
});
