import ArgoEngine

/// How much of a call's output the record kept, counted — what a row can say about a stream
/// without opening it, the way churn is what it says about a patch.
///
/// Counting only: no signature and no diagnostic is derived here (#381).
struct EvidenceLength: Equatable, Sendable {
    /// Lines of the KEPT output — what the panel can show. Not always what the command printed: a
    /// CLI that truncated before writing the record leaves nothing behind saying so.
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

    /// What the row and the panel both draw. `nil` at one line, the least a stream can be, which
    /// the chevron beside it already says.
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
    /// What this row's command printed, in lines. A read's output is the file, drawn under the
    /// file's own line numbers, and a search's is matches, so neither is counted in printed lines.
    var printed: EvidenceLength? {
        guard kind == .execute else { return nil }
        return evidence
            .reduce(EvidenceLength?.none) { EvidenceLength.total($0, EvidenceLength($1)) }
    }
}

extension FeedEvidence.Step {
    /// What this ONE result printed. Read off the ADDRESS, like the step's mark: a step carries no
    /// kind.
    var printed: EvidenceLength? {
        guard case .typed = address else { return nil }
        return EvidenceLength(result)
    }
}
