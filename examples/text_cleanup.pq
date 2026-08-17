let
    Source = Table.FromRecords({
        [FullName = "  Jane Doe  ", Email = " JANE@EXAMPLE.COM ", Phone = "n/a"],
        [FullName = "John Smith", Email = "john@example.com", Phone = "555-0100"]
    }),
    #"Trimmed Text" = Table.TransformColumns(Source, {{"Email", Text.Trim, type text}, {"Phone", Text.Trim, type text}}),
    #"Lowercased Text" = Table.TransformColumns(#"Trimmed Text", {{"Email", Text.Lower, type text}}),
    #"Split Column by Delimiter" = Table.SplitColumn(#"Lowercased Text", "FullName", Splitter.SplitTextByDelimiter(" ", QuoteStyle.Csv), {"First", "Last"}),
    #"Merged Columns" = Table.CombineColumns(#"Split Column by Delimiter", {"First", "Last"}, Combiner.CombineTextByDelimiter(" ", QuoteStyle.None), "DisplayName"),
    #"Replaced Value" = Table.ReplaceValue(#"Merged Columns", "n/a", "", Replacer.ReplaceText, {"Phone"}),
    #"Added Custom" = Table.AddColumn(#"Replaced Value", "Has Email", each [Email] <> null and [Email] <> "")
in
    #"Added Custom"
