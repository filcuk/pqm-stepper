import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getMappingForTransform } from "../app/mapping-store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function repoPath(...parts) {
  return join(root, ...parts);
}

export function readRepo(...parts) {
  return readFileSync(repoPath(...parts), "utf8");
}

export function loadDefaultMappingObject() {
  return JSON.parse(readRepo("app/mapping.json"));
}

export function loadTransformMapping() {
  return getMappingForTransform(loadDefaultMappingObject());
}
