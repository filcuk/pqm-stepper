let
    WorkbookOrders = Excel.Workbook(File.Contents("C:\Data\Orders.xlsx"), null, true){[Item="Orders",Kind="Sheet"]}[Data],
    WorkbookCustomers = Excel.Workbook(File.Contents("C:\Data\Customers.xlsx"), null, true){[Item="Customers",Kind="Sheet"]}[Data],
    Headers1 = Table.PromoteHeaders(WorkbookOrders, [PromoteAllScalars=true]),
    Headers2 = Table.PromoteHeaders(WorkbookCustomers, [PromoteAllScalars=true]),
    TypeCustomerID1 = Table.TransformColumnTypes(Headers1,{{"CustomerID", Int64.Type}}),
    TypeCustomerID2 = Table.TransformColumnTypes(Headers2,{{"CustomerID", Int64.Type}}),
    MergeCustomer = Table.NestedJoin(TypeCustomerID1, {"CustomerID"}, TypeCustomerID2, {"CustomerID"}, "Customer", JoinKind.LeftOuter),
    ExpandCustomer = Table.ExpandTableColumn(MergeCustomer, "Customer", {"Name", "Country"}, {"Customer.Name", "Customer.Country"}),
    Reorder = Table.ReorderColumns(ExpandCustomer,{"CustomerID", "Customer.Name", "Customer.Country", "OrderDate", "Amount"}),
    SortOrderDate = Table.Sort(Reorder,{{"OrderDate", Order.Descending}})
in
    SortOrderDate
