# PQM Stepper

A simple static tool that renames Power Query M steps using a standardised schema to improve code readability — avoiding `#"Step Name"` quoted identifiers.

**Live site:** [https://filcuk.github.io/pqm-stepper/](https://filcuk.github.io/pqm-stepper/)

## What it does

Paste Power Query M code from the Advanced Editor and get back the same code with auto-generated step names replaced by short, readable identifiers.

**Before:**

```powerquery
let
    Source = Excel.CurrentWorkbook(){[Name="Sheet1"]}[Content],
    #"Changed Type" = Table.TransformColumnTypes(Source,{{"Col", type text}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"Col", "Name"}}),
    #"Filtered Rows 1" = Table.SelectRows(#"Renamed Columns", each true),
    #"Filtered Rows 2" = Table.SelectRows(#"Filtered Rows 1", each true)
in
    #"Filtered Rows 2"
```

**After:**

```powerquery
let
    Source = Excel.CurrentWorkbook(){[Name="Sheet1"]}[Content],
    Type = Table.TransformColumnTypes(Source,{{"Col", type text}}),
    Rename = Table.RenameColumns(Type,{{"Col", "Name"}}),
    Filter1 = Table.SelectRows(Rename, each true),
    Filter2 = Table.SelectRows(Filter1, each true)
in
    Filter2
```

## Numbering rules

When multiple steps map to the same short name:

| Occurrences | Result |
|-------------|--------|
| 1 | `Filter` |
| 2+ | `Filter1`, `Filter2`, … |

Numbering follows step order in the `let` block, not Power Query's original suffix.

## Configuring mappings

Edit [`app/mapping.json`](app/mapping.json). Keys are the inner quoted step name (without `#"..."`); values are the target identifier:

```json
{
  "Changed Type": "Type",
  "Renamed Columns": "Rename",
  "Filtered Rows": "Filter"
}
```

Power Query uses past-tense names (`Renamed Columns`, `Filtered Rows`). Commit and push to update the live site.

**Rename rules for quoted steps defined in the query:**

| Situation | Result |
|-----------|--------|
| Key in `mapping.json` | Mapped name (e.g. `Filter`) |
| Navigation pattern detected | `Workbook`, `Sheet`, `Navigate`, or `Table` |
| No mapping, defined in query | Auto-sanitized PascalCase (e.g. `My Custom Step` → `MyCustomStep`) |
| External reference (not defined here) | Left as `#"..."` unchanged |

### Dynamic mappings (`*` wildcard)

Some step types include an object name in the target identifier. Use `*` as a placeholder in the mapping value:

```json
{
  "Added Custom": "Add*",
  "Added Conditional Column": "Add*",
  "Invoked Custom Function": "Invoke*"
}
```

The object name is parsed from the step's M expression:

| Step type | Extracted from | Example output |
|-----------|----------------|----------------|
| Added Custom / Added Conditional Column | Column name in `Table.AddColumn` | `AddUserName` |
| Duplicated Column | Source column in `Table.DuplicateColumn` | `AddUserName` |
| Invoked Custom Function | Function name on the RHS | `InvokeGetID` |

If the object name cannot be parsed, the `*` is dropped (e.g. `Add*` → `Add`) and a warning is shown.

Duplicate resolved names still get numbered (`AddUserName1`, `AddUserName2`).

### Navigation steps

Some steps are detected automatically from their M expression (no mapping entry needed):

| Pattern | Step name | Example |
|---------|-----------|---------|
| `Excel.Workbook(...)` | `Workbook` | Opening an Excel file |
| `{[..., Kind="Sheet"]}[Data]` | `Sheet` | Selecting a worksheet |
| `{[..., Schema=..., Item=...]}[Data]` | `Navigate` | Selecting a lakehouse / SQL schema table |
| `{[..., entity=...]}[Data]` | `Table` | Selecting a dataflow / entity table |

**Dataflow example:**

```powerquery
Source = PayrollAgency_DF,
#"Agency Payroll - Neuven_" = Source{[entity="Agency Payroll - Neuven",version=""]}[Data],
```

→ `Table = Source{[entity="Agency Payroll - Neuven",version=""]}[Data],`

**Excel example:**

```powerquery
Source = Excel.Workbook(File.Contents("file.xlsx"), null, true),
Sheet1_Sheet = Source{[Item="Sheet1",Kind="Sheet"]}[Data],
```

→ `Workbook = Excel.Workbook(...)`, `Sheet = Source{...}[Data],`

Duplicate navigation steps use the same numbering rules (`Sheet1`, `Sheet2`).

## Local preview

ES modules require a local server (opening `index.html` directly will block `fetch` of `mapping.json`):

```bash
npx serve .
```

Then open `http://localhost:3000`.

## GitHub Pages deployment

The site entry point is [`index.html`](index.html) at the repo root; app code lives in [`app/`](app/). GitHub Pages serves `index.html` as the homepage — if you see this README instead, Pages is misconfigured.

**GitHub Actions (recommended):**

1. Push to `main` (includes [`.github/workflows/pages.yml`](.github/workflows/pages.yml)).
2. In repo **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. After the workflow runs, the site is at `https://<username>.github.io/pqm-stepper/`.

**Deploy from branch (alternative):**

1. In **Settings → Pages**, set **Source** to **Deploy from a branch**.
2. Choose branch `main` and folder **`/ (root)`** — `index.html` at the repo root is served instead of this README.

The workflow stages `index.html` plus the `app/` folder into a clean artifact (README and other repo files are not published).

## Project structure

```
index.html        # Site entry point (GitHub Pages homepage)
.nojekyll         # Skip Jekyll processing
app/
  main.js         # UI wiring and event handlers
  m-utils.js      # Shared M regex helpers
  styles.css      # Layout and theme
  transform.js    # Rename logic (pure, no DOM)
  highlight.js    # Prism M syntax + step highlighting
  editor.js       # Contenteditable caret helpers
  example.js      # Sample query for "Load example"
  mapping.json    # Step name schema
  vendor/prism/   # Prism.js + Power Query grammar (vendored)
```

## License

MIT — see [LICENSE](LICENSE).
