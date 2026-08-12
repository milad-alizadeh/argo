import Foundation

/// One file a Codex patch touches, as the server's own `FileUpdateChange` spells it: a path, and
/// the unified diff for that path alone.
///
/// Retained per `itemId` rather than read off the approval, because the approval request carries no
/// diff at all — its params are `itemId`, `threadId`, `turnId`, `reason` and `grantRoot`, and the
/// content travels on the notifications for the same item (`codex app-server
/// generate-json-schema`, codex-cli 0.147.0).
struct CodexFileChange: Equatable {
    let path: String
    let diff: String

    init?(_ raw: JSONValue) {
        guard let path = raw.stringField("path"), let diff = raw.stringField("diff") else {
            return nil
        }
        self.path = path
        self.diff = diff
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
        guard changes.count == 1 else {
            return .raw(changes.map(\.diff).joined(separator: "\n"))
        }
        return .edit(path: only.path, hunks: hunks(of: only.diff))
    }

    /// The hunks of one file's unified diff, in order.
    ///
    /// Everything before the first `@@` is the file header, which the path beside it already says.
    /// A hunk that read as nothing is dropped rather than drawn empty.
    static func hunks(of diff: String) -> [[DiffLine]] {
        var hunks: [[DiffLine]] = []
        for raw in diff.split(separator: "\n", omittingEmptySubsequences: false) {
            if raw.hasPrefix("@@") {
                hunks.append([])
                continue
            }
            guard !hunks.isEmpty, let line = line(String(raw)) else { continue }
            hunks[hunks.count - 1].append(line)
        }
        return hunks.filter { !$0.isEmpty }
    }

    /// One patch line with its marker taken OFF, since the side carries it. Anything else — the
    /// `\ No newline at end of file` note, above all — is not a line of the file and is dropped.
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
