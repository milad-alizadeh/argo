import ArgoEngine

/// How much a call printed, counted off the record — what a row can say about a stream without
/// opening it, the way churn is what it can say about a patch.
///
/// The counting is the whole of it. Nothing here reads the characters for MEANING: no signature,
/// no diagnostic, no account of what the output said. Those are derived elsewhere, or not at all,
/// and a count that depended on them would stop being a fact the record supports.
struct EvidenceLength: Equatable, Sendable {
    /// Lines the call printed. A last line the command left unterminated is one of them — it was
    /// printed — and a blank line between two others is too.
    let lines: Int

    /// `nil` for everything a count would be a claim about rather than a reading of: a patch, whose
    /// lines churn counts already, media, which has none, and an output with nothing in it.
    init?(_ result: ToolResult) {
        guard case let .output(output) = result else { return nil }
        let lines = Self.lines(in: output.text)
        guard lines > 0 else { return nil }
        self.lines = lines
    }

    private init(lines: Int) {
        self.lines = lines
    }

    /// What a run of calls printed, added up. Absent where nothing in the run printed anything.
    static func total(_ first: EvidenceLength?, _ second: EvidenceLength?) -> EvidenceLength? {
        guard let first else { return second }
        guard let second else { return first }
        return EvidenceLength(lines: first.lines + second.lines)
    }

    /// What the row and the panel both draw, or `nil` where the count would say nothing the chevron
    /// beside it does not.
    ///
    /// One line is the least a stream can be, so `1 line` warns a reader about nothing while
    /// spending the same ink as the count that matters — and a token printed on every row is one a
    /// reader stops seeing. The unit is said in words because there is no mark for it: `+` and `−`
    /// say added and removed, and nothing says printed.
    var drawn: String? {
        lines > 1 ? "\(lines) lines" : nil
    }

    /// The terminator is what ends a line, so a text that ends in one has as many lines as it has
    /// terminators, and a text that does not has one more. `\r\n` is one Character in Swift and so
    /// is counted once.
    private static func lines(in text: String) -> Int {
        guard !text.isEmpty else { return 0 }
        let terminators = text.count(where: \.isNewline)
        return text.last?.isNewline == true ? terminators : terminators + 1
    }
}

extension FeedCall {
    /// What this row's command printed, in lines.
    ///
    /// Only a COMMAND is counted. A read's output is the file, which the panel draws under the
    /// file's own line numbers, and a search's is matches — counting either in printed lines would
    /// name it as something it is not.
    var printed: EvidenceLength? {
        guard kind == .execute else { return nil }
        return evidence
            .reduce(EvidenceLength?.none) { EvidenceLength.total($0, EvidenceLength($1)) }
    }
}

extension FeedEvidence.Step {
    /// What this ONE result printed. Read off the ADDRESS rather than a kind, for the reason the
    /// step's mark is: inside a folded run, the address is all that says which call this came from.
    var printed: EvidenceLength? {
        guard case .typed = address else { return nil }
        return EvidenceLength(result)
    }
}
