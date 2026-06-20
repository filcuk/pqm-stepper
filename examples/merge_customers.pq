let
    Orders = Excel.Workbook(File.Contents("C:\Data\Orders.xlsx"), null, true){[Item="Orders",Kind="Sheet"]}[Data],
    Customers = Excel.Workbook(File.Contents("C:\Data\Customers.xlsx"), null, true){[Item="Customers",Kind="Sheet"]}[Data],
    #"Promoted Headers 1" = Table.PromoteHeaders(Orders, [PromoteAllScalars=true]),
    #"Promoted Headers 2" = Table.PromoteHeaders(Customers, [PromoteAllScalars=true]),
    #"Changed Type 1" = Table.TransformColumnTypes(#"Promoted Headers 1",{{"CustomerID", Int64.Type}}),
    #"Changed Type 2" = Table.TransformColumnTypes(#"Promoted Headers 2",{{"CustomerID", Int64.Type}}),
    #"Merged Queries" = Table.NestedJoin(#"Changed Type 1", {"CustomerID"}, #"Changed Type 2", {"CustomerID"}, "Customer", JoinKind.LeftOuter),
    #"Expanded Table Column" = Table.ExpandTableColumn(#"Merged Queries", "Customer", {"Name", "Country"}, {"Customer.Name", "Customer.Country"}),
    #"Reordered Columns" = Table.ReorderColumns(#"Expanded Table Column",{"CustomerID", "Customer.Name", "Customer.Country", "OrderDate", "Amount"}),
    #"Sorted Rows" = Table.Sort(#"Reordered Columns",{{"OrderDate", Order.Descending}})
in
    #"Sorted Rows"
