let
    #"Name List" = {"North", "South", "East"},
    RangeStart = #date(2024, 1, 1),
    Source = #table(
        {"Column1", "Column2"},
        {
            {"Col", "Date"},
            {"North", #date(2024, 6, 15)},
            {"West", #date(2023, 12, 1)},
            {"South", #date(2025, 1, 1)}
        }
    ),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Col", type text}, {"Date", type date}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"Col", "Name"}}),
    #"Filtered Rows 1" = Table.SelectRows(#"Renamed Columns", each List.Contains(#"Name List", [Name])),
    #"Filtered Rows 2" = Table.SelectRows(#"Filtered Rows 1", each [Date] >= RangeStart)
in
    #"Filtered Rows 2"
