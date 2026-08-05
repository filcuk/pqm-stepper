let
    Workbook = Excel.Workbook(File.Contents("C:\Data\Employees.xlsx"), null, true),
    SheetEmployees = Workbook{[Item="Employees",Kind="Sheet"]}[Data],
    Headers = Table.PromoteHeaders(SheetEmployees, [PromoteAllScalars=true]),
    Type = Table.TransformColumnTypes(Headers,{{"EmployeeID", Int64.Type}, {"HireDate", type date}, {"Salary", Currency.Type}}),
    Rename = Table.RenameColumns(Type,{{"EmployeeID", "ID"}, {"Full Name", "FullName"}}),
    FilterID = Table.SelectRows(Rename, each [ID] <> null),
    FilterDepartment = Table.SelectRows(FilterID, each [Department] = "Sales"),
    ReplaceDepartment = Table.ReplaceValue(FilterDepartment,"TBC","To Be Confirmed",Replacer.ReplaceText,{"Department"}),
    AddDisplayName = Table.AddColumn(ReplaceDepartment, "Display Name", each [FullName] & " (" & Text.From([ID]) & ")"),
    AddTenureBand = Table.AddColumn(AddDisplayName, "Tenure Band", each if [HireDate] < #date(2020, 1, 1) then "Legacy" else "Recent"),
    SortHireDate = Table.Sort(AddTenureBand,{{"HireDate", Order.Descending}}),
    DistinctID = Table.Distinct(SortHireDate, {"ID"}),
    InvokeNormalizeEmployeeID = NormalizeEmployeeID(DistinctID),
    Buffer = Table.Buffer(InvokeNormalizeEmployeeID)
in
    Buffer
