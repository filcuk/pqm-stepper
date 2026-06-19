export const DEFAULT_EXAMPLE = `let
    Source = Excel.Workbook(File.Contents("C:\\Data\\Employees.xlsx"), null, true),
    Employees_Sheet = Source{[Item="Employees",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Employees_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"EmployeeID", Int64.Type}, {"HireDate", type date}, {"Salary", Currency.Type}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"EmployeeID", "ID"}, {"Full Name", "FullName"}}),
    #"Filtered Rows 1" = Table.SelectRows(#"Renamed Columns", each [ID] <> null),
    #"Filtered Rows 2" = Table.SelectRows(#"Filtered Rows 1", each [Department] = "Sales"),
    #"Replaced Value" = Table.ReplaceValue(#"Filtered Rows 2","TBC","To Be Confirmed",Replacer.ReplaceText,{"Department"}),
    #"Added Custom" = Table.AddColumn(#"Replaced Value", "Display Name", each [FullName] & " (" & Text.From([ID]) & ")"),
    #"Added Conditional Column" = Table.AddColumn(#"Added Custom", "Tenure Band", each if [HireDate] < #date(2020, 1, 1) then "Legacy" else "Recent"),
    #"Sorted Rows" = Table.Sort(#"Added Conditional Column",{{"HireDate", Order.Descending}}),
    #"Removed Duplicates" = Table.Distinct(#"Sorted Rows", {"ID"}),
    #"Invoked Custom Function" = NormalizeEmployeeID(#"Removed Duplicates"),
    Buffer = Table.Buffer(#"Invoked Custom Function")
in
    Buffer`;
