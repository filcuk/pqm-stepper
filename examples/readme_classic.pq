let
    Source = Excel.CurrentWorkbook(){[Name="Sheet1"]}[Content],
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Col", type text}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"Col", "Name"}}),
    #"Filtered Rows 1" = Table.SelectRows(#"Renamed Columns", each true),
    #"Filtered Rows 2" = Table.SelectRows(#"Filtered Rows 1", each true)
in
    #"Filtered Rows 2"
