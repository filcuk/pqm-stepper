let
    Source = #"Payroll Agency Dataflow",
    #"Agency Payroll - Neuven_" = Source{[entity="Agency Payroll - Neuven",version=""]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"Agency Payroll - Neuven_", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"PayDate", type date}, {"GrossPay", Currency.Type}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each [GrossPay] <> null),
    #"Removed Duplicates" = Table.Distinct(#"Filtered Rows", {"EmployeeRef", "PayDate"})
in
    #"Removed Duplicates"
