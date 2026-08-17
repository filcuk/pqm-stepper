let
    Source = Csv.Document(File.Contents("C:\Reports\Sales.csv"),[Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    Headers = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    Type = Table.TransformColumnTypes(Headers,{{"OrderDate", type date}, {"Amount", Currency.Type}, {"Region", type text}}),
    FilterAmount = Table.SelectRows(Type, each [Amount] > 0),
    RemoveColumnsNotes = Table.RemoveColumns(FilterAmount,{"Notes"}),
    Group = Table.Group(RemoveColumnsNotes, {"Region"}, {{"Total", each List.Sum([Amount]), type nullable number}}),
    SortTotal = Table.Sort(Group,{{"Total", Order.Descending}})
in
    SortTotal
