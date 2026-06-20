let
    Source = Csv.Document(File.Contents("C:\Reports\Sales.csv"),[Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"OrderDate", type date}, {"Amount", Currency.Type}, {"Region", type text}}),
    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each [Amount] > 0),
    #"Removed Columns" = Table.RemoveColumns(#"Filtered Rows",{"Notes"}),
    #"Grouped Rows" = Table.Group(#"Removed Columns", {"Region"}, {{"Total", each List.Sum([Amount]), type nullable number}}),
    #"Sorted Rows" = Table.Sort(#"Grouped Rows",{{"Total", Order.Descending}})
in
    #"Sorted Rows"
