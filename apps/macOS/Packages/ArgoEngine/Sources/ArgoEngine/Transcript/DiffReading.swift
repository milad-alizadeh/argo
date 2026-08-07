// A mutating call's result → the Diff it produced, read off `toolUseResult`. DIRECT, and never
// re-read from disk, which is what makes a feed diff point-in-time.

private let sideByMarker: [Character: DiffLineSide] = ["+": .add, "-": .del, " ": .context]

/// One patch line with its marker taken OFF, since the side carries it. A line with no marker keeps
/// every character: it is context, and slicing it would eat a real one.
private func diffLine(_ raw: JSONValue) -> DiffLine? {
    guard let text = raw.string else { return nil }
    guard let marker = text.first, let side = sideByMarker[marker] else {
        return DiffLine(side: .context, text: text)
    }
    return DiffLine(side: side, text: String(text.dropFirst()))
}

private func hunk(_ raw: JSONValue) -> DiffHunk? {
    let lines = raw["lines"]?.array.compactMap(diffLine) ?? []
    guard !lines.isEmpty else { return nil }
    return DiffHunk(
        oldStart: raw["oldStart"]?.int ?? 0,
        newStart: raw["newStart"]?.int ?? 0,
        lines: lines,
    )
}

/// The whole content of a file as one all-added hunk. A `Write` that creates reports an EMPTY patch
/// with the content beside it, and rendering nothing would hide a whole new file.
private func wholeFileHunk(_ content: String) -> DiffHunk? {
    var lines = content.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    // A trailing newline splits into a final empty element that is not a line of the file.
    if lines.last?.isEmpty == true {
        lines.removeLast()
    }
    guard !lines.isEmpty else { return nil }
    return DiffHunk(
        oldStart: 0,
        newStart: 1,
        lines: lines.map { DiffLine(side: .add, text: $0) },
    )
}

private func count(_ hunks: [DiffHunk], _ side: DiffLineSide) -> Int {
    hunks.reduce(0) { $0 + $1.lines.count { $0.side == side } }
}

/// What the change did to the file, where the host declared nothing.
///
/// A deletion is claimed only from a patch that removes lines and keeps none: no CLI Argo reads has
/// a delete tool, so that shape is the only evidence one leaves. `modify` is the fallback — neither
/// creation nor deletion is worth claiming from an absence of evidence.
private func fileChange(_ hunks: [DiffHunk], before: String, after: String?) -> FileChange {
    if before.isEmpty, count(hunks, .add) > 0 {
        return .create
    }
    if !before.isEmpty, after?.isEmpty == true {
        return .delete
    }
    let removesOnly = !hunks.isEmpty && count(hunks, .add) + count(hunks, .context) == 0
    return removesOnly ? .delete : .modify
}

/// The host's OWN word for what it did, where it writes one. Preferred over the patch: a verbatim
/// read beats an inference from the same record.
private func declaredChange(_ raw: JSONValue?) -> FileChange? {
    switch raw?.string {
    case "create": .create
    case "update": .modify
    default: nil
    }
}

/// The Diff a call produced, read off its `toolUseResult`, or `nil` where it produced none.
///
/// The patch is read only for the calls whose kind SAYS they mutate: a record can carry one beside
/// any call, and reading it onto a `read` would put a diff under a row that changed nothing.
///
/// A result that IS a mutation but whose patch cannot be read — a binary file, a shape this cannot
/// parse — comes back with zero hunks and zero churn rather than as `nil`: the mutation happened,
/// and a row that says "no diff available" is honest where a missing row is not.
func diffEvidence(of call: ResolvedCall) -> DiffEvidence? {
    guard call.kind == .edit, let raw = call.toolUseResult, let fields = raw.object,
          fields.keys.contains("structuredPatch")
    else {
        return nil
    }
    let patch = raw["structuredPatch"]?.array.compactMap(hunk) ?? []
    let after = raw.stringField("content")
    let created = patch.isEmpty ? after.flatMap(wholeFileHunk) : nil
    let hunks = created.map { [$0] } ?? patch
    return DiffEvidence(
        tier: .direct,
        change: declaredChange(raw["type"])
            ?? fileChange(hunks, before: raw.stringField("originalFile") ?? "", after: after),
        added: count(hunks, .add),
        removed: count(hunks, .del),
        hunks: hunks,
    )
}
