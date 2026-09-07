/// Which of the CLI's own two titles a record carried (`CONTEXT.md` L2 · CLI title, #1623).
///
/// A Claude Session can hold two names Argo did not write: one its summariser derived from the
/// conversation, and one the reader typed at the prompt with `/rename`. Both land as records in the
/// transcript, both are drawn by Claude's mobile, desktop and web apps, and they are told apart
/// because the reader's outranks the summariser's whichever order they arrive in.
///
/// An enum and not a `Bool`: `codex` holds no title of its own today (#1494), and a third kind
/// arriving is a case every `switch` over this has to answer for rather than a flag flipped.
public enum CLITitleKind: Sendable, Equatable, Hashable {
    /// The CLI's own summariser wrote it — the `ai-title` record.
    case summarised
    /// The reader typed it at the prompt — the `custom-title` record `/rename` writes, and what
    /// Argo's own mirror leaves behind when it types there (#1494).
    case custom
}

extension CLITitleKind {
    /// Where this kind sits on the name ladder. Held here rather than at the `switch` that folds a
    /// record, so the two kinds' contest is stated once (`SessionTitle.Standing`).
    var standing: SessionTitle.Standing {
        switch self {
        case .summarised: .summarised
        case .custom: .custom
        }
    }
}
