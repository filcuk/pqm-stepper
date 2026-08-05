import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateMapping,
  parseMappingJson,
  isDefaultMapping,
  isDefaultMappingReady,
  getMappingForTransform,
} from "../app/mapping-store.js";
import { loadDefaultMappingObject } from "./helpers.js";

describe("mapping validate", () => {
  it("rejects empty objects", () => {
    assert.match(validateMapping({}), /\$version/);
    assert.match(parseMappingJson("{}").error, /\$version/);
  });

  it("rejects versionless mappings", () => {
    assert.match(
      validateMapping({ "Changed Type": "Type" }),
      /\$version/
    );
  });

  it("rejects invalid $version values", () => {
    assert.match(validateMapping({ $version: "1" }), /MAJOR\.MINOR/);
    assert.match(validateMapping({ $version: "v1.0" }), /MAJOR\.MINOR/);
  });

  it("accepts a valid mapping with $version", () => {
    assert.equal(
      validateMapping({ $version: "1.0", "Changed Type": "Type" }),
      null
    );
  });

  it("strips $version for transform", () => {
    const mapping = getMappingForTransform({
      $version: "1.0",
      "Changed Type": "Type",
    });
    assert.deepEqual(mapping, { "Changed Type": "Type" });
  });

  it("isDefaultMapping is false when default is not loaded", () => {
    assert.equal(isDefaultMappingReady(), false);
    assert.equal(isDefaultMapping(loadDefaultMappingObject()), false);
    assert.equal(isDefaultMapping({}), false);
  });
});
