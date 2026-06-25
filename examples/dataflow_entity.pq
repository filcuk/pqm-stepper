let
    Source = #"Payroll Agency Dataflow",
    #"Agency Payroll" = Source{[entity="Agency Payroll",version=""]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"Agency Payroll", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"PayDate", type date}, {"GrossPay", Currency.Type}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each [GrossPay] <> null),
    #"Removed Duplicates" = Table.Distinct(#"Filtered Rows", {"EmployeeRef", "PayDate"})
in
    #"Removed Duplicates"
