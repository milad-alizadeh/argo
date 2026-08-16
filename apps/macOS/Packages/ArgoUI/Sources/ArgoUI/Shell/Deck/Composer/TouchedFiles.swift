import ArgoEngine

/// Which files this Session's agent has already been in, newest first (#687) — the order the `@`
/// picker puts at the top of its list.
///
/// Read off the transcript the feed already draws, so it cannot disagree with what the reader can
/// see happened. DERIVED: it is an observation of the record, never a fact Argo owns.
enum TouchedFiles {
    /// The paths a `read` or an `edit` named, deduplicated, newest first, and stated relative to
    /// the Workspace so they compare against what the tree listed.
    ///
    /// Only those two kinds. A `search` names a pattern and an `execute` names a command, and
    /// neither is a file the reader could then mention.
    static func touched(in events: [TranscriptEvent], within root: String?) -> [String] {
        var seen = Set<String>()
        return events.reversed().compactMap { event -> String? in
            guard case let .toolCall(call) = event, Self.kinds.contains(call.kind),
                  let path = call.target.map({ relative($0, to: root) }),
                  seen.insert(path).inserted else { return nil }
            return path
        }
    }

    private static let kinds: Set<ToolCallKind> = [.read, .edit]

    /// An absolute path inside the Workspace, said the way the tree says it. A path outside stands
    /// as it is and simply never matches a listed file, which is what keeps it out of the picker.
    private static func relative(_ path: String, to root: String?) -> String {
        guard let root, !root.isEmpty else { return path }
        let prefix = root.hasSuffix("/") ? root : root + "/"
        return path.hasPrefix(prefix) ? String(path.dropFirst(prefix.count)) : path
    }
}
