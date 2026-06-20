let
    Source = Excel.CurrentWorkbook(){[Name="Contacts"]}[Content],
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Trimmed Text" = Table.TransformColumns(#"Promoted Headers",{{"Email", Text.Trim}, {"Phone", Text.Trim}}),
    #"Lowercased Text" = Table.TransformColumns(#"Trimmed Text",{{"Email", Text.Lower}}),
    #"Split Column by Delimiter" = Table.SplitColumn(#"Lowercased Text", "FullName", Splitter.SplitTextByDelimiter(" ", QuoteStyle.Csv), {"First", "Last"}),
    #"Combined Columns" = Table.CombineColumns(#"Split Column by Delimiter",{"First", "Last"},Combiner.CombineTextByDelimiter(" ", QuoteStyle.None),"DisplayName"),
    #"Replaced Value" = Table.ReplaceValue(#"Combined Columns","n/a","",Replacer.ReplaceText,{"Phone"}),
    #"Added Custom" = Table.AddColumn(#"Replaced Value", "Has Email", each [Email] <> null and [Email] <> "")
in
    #"Added Custom"
