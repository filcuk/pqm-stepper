const STORAGE_KEY = "pqm-mapping";

let defaultMapping = null;

export function validateMapping(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return "Mapping must be a JSON object.";
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof key !== "string" || typeof value !== "string") {
      return "All keys and values must be strings.";
    }
  }

  return null;
}

export async function loadDefaultMapping() {
  const res = await fetch("app/mapping.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const validationError = validateMapping(data);
  if (validationError) throw new Error(validationError);

  defaultMapping = data;
  return defaultMapping;
}

export function getDefaultMapping() {
  return defaultMapping;
}

export function getStoredMapping() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    if (validateMapping(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasStoredMapping() {
  return getStoredMapping() !== null;
}

export function saveMapping(obj) {
  const validationError = validateMapping(obj);
  if (validationError) throw new Error(validationError);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

export function clearStoredMapping() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getEffectiveMapping() {
  return getStoredMapping() ?? defaultMapping ?? {};
}

export function parseMappingJson(text) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { error: `Invalid JSON: ${err.message}` };
  }

  const validationError = validateMapping(parsed);
  if (validationError) return { error: validationError };

  return { mapping: parsed };
}

export function wasStoredMappingInvalid() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  return getStoredMapping() === null;
}

export function formatMappingJson(obj) {
  return JSON.stringify(obj, null, 2);
}
