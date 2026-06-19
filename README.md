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
    #"Filter Rows 1" = Table.SelectRows(#"Renamed Columns", each true),
    #"Filter Rows 2" = Table.SelectRows(#"Filter Rows 1", each true)
in
    #"Filter Rows 2"
```

**After:**

```powerquery
let
    Source = Excel.CurrentWorkbook(){[Name="Sheet1"]}[Content],
    ChangedType = Table.TransformColumnTypes(Source,{{"Col", type text}}),
    Rename = Table.RenameColumns(ChangedType,{{"Col", "Name"}}),
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

Edit [`docs/mapping.json`](docs/mapping.json). Keys are the inner quoted step name (without `#"..."`); values are the target identifier:

```json
{
  "Renamed Columns": "Rename",
  "Filter Rows": "Filter",
  "Filtered Rows": "Filter"
}
```

Power Query uses past-tense names (`Renamed Columns`, `Filtered Rows`) — include both variants if your queries use either. Commit and push to update the live site.

Steps not in the mapping are left unchanged.

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
npx serve docs
```

Then open `http://localhost:3000`.

## GitHub Pages deployment

1. Push the `docs/` folder to the `main` branch.
2. In repo **Settings → Pages**, set source to **Deploy from branch `main`, folder `/docs`**.
3. Site will be available at `https://<username>.github.io/pqm-stepper/`.

No build step required.

## Project structure

```
docs/
  index.html      # UI
  styles.css      # Layout and theme
  transform.js    # Rename logic (pure, no DOM)
  mapping.json    # Step name schema
  .nojekyll       # Skip Jekyll processing on GitHub Pages
```

## License

MIT — see [LICENSE](LICENSE).
