let
    Source = #table(
        {"Column1", "Column2", "Column3", "Column4"},
        {
            {"Category", "Jan", "Feb", "Mar"},
            {"Operations", 100, 110, 105},
            {"Marketing", 50, 55, 60},
            {"Payroll", 200, null, 210}
        }
    ),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Unpivoted Columns" = Table.UnpivotOtherColumns(#"Promoted Headers", {"Category"}, "Month", "Amount"),
    #"Changed Type" = Table.TransformColumnTypes(#"Unpivoted Columns",{{"Amount", Currency.Type}}),
    #"Grouped Rows" = Table.Group(#"Changed Type", {"Month"}, {{"Total", each List.Sum([Amount]), type nullable number}}),
    #"Pivoted Column" = Table.Pivot(#"Grouped Rows", List.Distinct(#"Grouped Rows"[Month]), "Month", "Total"),
    #"Filled Down" = Table.FillDown(#"Pivoted Column", {"Jan", "Feb", "Mar"})
in
    #"Filled Down"
