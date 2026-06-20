let
    Source = Excel.CurrentWorkbook(){[Name="MonthlyBudget"]}[Content],
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Unpivoted Columns" = Table.UnpivotOtherColumns(#"Promoted Headers", {"Category"}, "Month", "Amount"),
    #"Changed Type" = Table.TransformColumnTypes(#"Unpivoted Columns",{{"Amount", Currency.Type}}),
    #"Grouped Rows" = Table.Group(#"Changed Type", {"Category"}, {{"Average", each List.Average([Amount]), type nullable number}}),
    #"Pivoted Column" = Table.Pivot(#"Grouped Rows", List.Distinct(#"Grouped Rows"[Category]), "Category", "Average"),
    #"Filled Down" = Table.FillDown(#"Pivoted Column",{"Operations", "Marketing", "Payroll"})
in
    #"Filled Down"
