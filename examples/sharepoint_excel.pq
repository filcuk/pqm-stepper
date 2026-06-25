let
    Source = SharePoint.Contents("https://contoso.sharepoint.com/sites/Finance", [ApiVersion = 15]),
    #"Shared Documents" = Source{[Name="Shared Documents"]}[Content],
    #"Navigation 1" = #"Shared Documents"{[Name="Sales Reports"]}[Content],
    #"Navigation 2" = #"Navigation 1"{[Name="2024"]}[Content],
    #"Imported Excel Workbook" = Excel.Workbook(#"Navigation 2"{[Name="MonthlySummary.xlsx"]}[Content]),
    #"Navigation 3" = #"Imported Excel Workbook"{[Item="Revenue",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(#"Navigation 3", [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Month", type date}, {"Region", type text}, {"Amount", Currency.Type}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each [Amount] <> null and [Region] <> null)
in
    #"Filtered Rows"
