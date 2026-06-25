const STORAGE_KEY = "pqm-mapping";
export const VERSION_KEY = "$version";
const VERSION_PATTERN = /^\d+\.\d+$/;

let defaultMapping = null;

export function parseVersion(version) {
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) return null;
  const [major, minor] = version.split(".").map(Number);
  return { major, minor, raw: version };
}

export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;

  if (left.major !== right.major) return left.major - right.major;
  return left.minor - right.minor;
}

export function isVersionOlder(storedVersion, currentVersion) {
  const comparison = compareVersions(storedVersion, currentVersion);
  if (comparison === null) return true;
  return comparison < 0;
}

export function isVersionNewer(storedVersion, currentVersion) {
  const comparison = compareVersions(storedVersion, currentVersion);
  if (comparison === null) return false;
  return comparison > 0;
}

export function getMappingVersion(obj) {
  if (!obj || typeof obj !== "object") return null;
  return parseVersion(obj[VERSION_KEY])?.raw ?? null;
}

export function validateMapping(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return "Mapping must be a JSON object.";
  }

  for (const [key, value] of Object.entries(obj)) {
    if (key === VERSION_KEY) {
      if (parseVersion(value) === null) {
        return "Mapping $version must be a MAJOR.MINOR string (e.g. 1.0).";
      }
      continue;
    }

    if (typeof key !== "string" || typeof value !== "string") {
      return "All keys and values must be strings.";
    }
  }

  return null;
}

export function getMappingForTransform(obj) {
  if (!obj || typeof obj !== "object") return {};

  const mapping = { ...obj };
  delete mapping[VERSION_KEY];
  return mapping;
}

export async function loadDefaultMapping() {
  const res = await fetch("app/mapping.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const validationError = validateMapping(data);
  if (validationError) throw new Error(validationError);
  if (!getMappingVersion(data)) {
    throw new Error("mapping.json is missing a valid $version.");
  }

  defaultMapping = data;
  return defaultMapping;
}

export function getDefaultMapping() {
  return defaultMapping;
}

export function getDefaultVersion() {
  return getMappingVersion(defaultMapping) ?? "1.0";
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

export function hasCustomMapping() {
  return hasStoredMapping();
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

export function resolveMappingState() {
  const currentVersion = getDefaultVersion();
  const stored = getStoredMapping();

  if (stored) {
    const storedVersion = getMappingVersion(stored);
    return {
      mapping: stored,
      isCustom: true,
      isOutdated: !storedVersion || isVersionOlder(storedVersion, currentVersion),
      isFuture: Boolean(storedVersion && isVersionNewer(storedVersion, currentVersion)),
      currentVersion,
      storedVersion,
    };
  }

  return {
    mapping: defaultMapping ?? {},
    isCustom: false,
    isOutdated: false,
    isFuture: false,
    currentVersion,
    storedVersion: null,
  };
}

export function resetToDefaultMapping() {
  clearStoredMapping();
  return defaultMapping ? { ...defaultMapping } : {};
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
