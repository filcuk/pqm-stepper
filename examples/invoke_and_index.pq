let
    Source = Table.FromRecords({
        [SKU = "A100", Qty = 12],
        [SKU = "B200", Qty = 3],
        [SKU = "C300", Qty = null]
    }),
    #"Changed Type" = Table.TransformColumnTypes(Source,{{"SKU", type text}, {"Qty", Int64.Type}}),
    #"Added Index" = Table.AddIndexColumn(#"Changed Type", "RowNum", 1, 1, Int64.Type),
    #"Added Conditional Column" = Table.AddColumn(#"Added Index", "Stock Status", each if [Qty] = null then "Unknown" else if [Qty] < 5 then "Low" else "OK"),
    #"Invoked Custom Function" = ParseSKU(#"Added Conditional Column"),
    #"Removed Errors" = Table.RemoveRowsWithErrors(#"Invoked Custom Function", {"CategoryCode"})
in
    #"Removed Errors"
