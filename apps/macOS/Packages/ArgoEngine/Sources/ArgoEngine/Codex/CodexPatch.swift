import Foundation

/// What a Codex patch does to one file, in the server's own three words.
///
/// It decides how the change's `diff` field is READ, which is the whole reason it is carried: only
/// `update` puts a unified diff there. `add` and `delete` put the file's plain content, so a delete
/// read as a patch would draw every removed line as an addition — the one misrender a Permission
/// prompt must not make. Observed on codex-cli 0.147.0, all three kinds.
enum CodexPatchKind: String {
    case add
    case delete
    case update
}

/// One file a Codex patch touches, as the server's own `FileUpdateChange` spells it.
///
/// Retained per `itemId` rather than read off the approval, because the approval request carries no
/// diff at all — its params are `itemId`, `threadId`, `turnId`, `reason` and `grantRoot`, and the
/// content travels on the item's notifications, which arrive first.
struct CodexFileChange: Equatable {
    let path: String
    let diff: String
    /// Nothing for a kind this does not know. The change is still carried: the user is deciding on
    /// it either way, and it degrades to verbatim text rather than to a diff drawn the wrong way
    /// round.
    let kind: CodexPatchKind?

    init?(_ raw: JSONValue) {
        guard let path = raw.stringField("path"), let diff = raw.stringField("diff") else {
            return nil
        }
        self.path = path
        self.diff = diff
        self.kind = raw["kind"]?.stringField("type").flatMap(CodexPatchKind.init)
    }

    /// What this change would write, or nothing where it cannot be read as an edit at all.
    var hunks: [[DiffLine]]? {
        switch kind {
        case .add: CodexPatch.whole(diff, side: .add)
        case .delete: CodexPatch.whole(diff, side: .del)
        case .update: CodexPatch.hunks(of: diff)
        case nil: nil
        }
    }
}

/// A Codex patch read into the vocabulary a Permission's target is drawn from.
enum CodexPatch {
    /// What a gated patch would write, or nothing where no diff has arrived for it.
    ///
    /// ONE file renders as the edit it is. Several stay verbatim, because `edit` names a single
    /// path and a multi-file patch shown under one of its file names is a target the user would be
    /// deciding on truncated.
    static func target(_ changes: [CodexFileChange]) -> PermissionRequest.Target? {
        guard let only = changes.first else { return nil }
        guard changes.count == 1, let hunks = only.hunks else {
            return .raw(changes.map(\.diff).joined(separator: "\n"))
        }
        return .edit(path: only.path, hunks: hunks)
    }

    /// A whole file's content as one hunk, every line the same side — how `add` and `delete` carry
    /// theirs. Nothing for an empty file, which has no lines to draw.
    static func whole(_ content: String, side: DiffLineSide) -> [[DiffLine]]? {
        var lines = content
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
        // A trailing newline splits into a final empty element that is not a line of the file.
        if lines.last?.isEmpty == true {
            lines.removeLast()
        }
        guard !lines.isEmpty else { return nil }
        return [lines.map { DiffLine(side: side, text: $0) }]
    }

    /// The hunks of one file's unified diff, in order, or nothing where it holds none.
    ///
    /// Everything before the first `@@` is the file header, which the path beside it already says.
    static func hunks(of diff: String) -> [[DiffLine]]? {
        var hunks: [[DiffLine]] = []
        for raw in diff.split(separator: "\n", omittingEmptySubsequences: false) {
            if raw.hasPrefix("@@") {
                hunks.append([])
                continue
            }
            guard !hunks.isEmpty, let line = line(String(raw)) else { continue }
            hunks[hunks.count - 1].append(line)
        }
        let read = hunks.filter { !$0.isEmpty }
        return read.isEmpty ? nil : read
    }

    /// One patch line with its marker taken OFF, since the side carries it. Anything else — the
    /// `\ No newline at end of file` note, above all — is not a line of the file.
    private static func line(_ text: String) -> DiffLine? {
        switch text.first {
        case "+": DiffLine(side: .add, text: String(text.dropFirst()))
        case "-": DiffLine(side: .del, text: String(text.dropFirst()))
        case " ": DiffLine(side: .context, text: String(text.dropFirst()))
        // An empty line inside a hunk is a context line whose single space the server trimmed.
        case nil: DiffLine(side: .context, text: "")
        default: nil
        }
    }
}
