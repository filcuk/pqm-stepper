export async function fetchExampleManifest() {
  const res = await fetch("examples/manifest.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const entries = await res.json();
  if (!Array.isArray(entries)) throw new Error("Invalid manifest");

  return entries
    .filter(
      (entry) =>
        entry &&
        typeof entry.file === "string" &&
        /\.pq$/i.test(entry.file) &&
        typeof entry.label === "string" &&
        entry.label.trim()
    )
    .map((entry) => ({
      file: entry.file,
      label: entry.label.trim(),
    }));
}

export async function fetchExample(filename) {
  const res = await fetch(`examples/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export function pickRandomExample(examples, lastFile) {
  if (!examples.length) return null;
  if (examples.length === 1) return examples[0];

  const pool = lastFile
    ? examples.filter((example) => example.file !== lastFile)
    : examples;

  const choices = pool.length ? pool : examples;
  return choices[Math.floor(Math.random() * choices.length)];
}
