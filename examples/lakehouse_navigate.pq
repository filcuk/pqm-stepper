let
    Source = Sql.Database("warehouse.database.windows.net", "Analytics"),
    #"Navigation 1" = Source{[Schema="dbo",Item="FactSales"]}[Data],
    #"Changed Type" = Table.TransformColumnTypes(#"Navigation 1",{{"SaleDate", type date}, {"Quantity", Int64.Type}}),
    #"Filtered Rows 1" = Table.SelectRows(#"Changed Type", each [Quantity] > 0),
    #"Filtered Rows 2" = Table.SelectRows(#"Filtered Rows 1", each Date.Year([SaleDate]) >= 2024),
    #"Removed Other Columns" = Table.SelectColumns(#"Filtered Rows 2",{"SaleDate", "ProductKey", "Quantity", "Amount"})
in
    #"Removed Other Columns"
