/// Everything the composer's `/` picker can list, and how the half it had to ask the CLI for is
/// doing (#685, #686).
///
/// The two halves have two clocks: skills are a filesystem walk that answers now, built-ins are a
/// hidden session that answers in seconds and sometimes not at all. So the picker takes them as one
/// list plus one status, which is what lets it draw every skill it has while saying the rest is
/// still coming (`cockpit-composer-picker.md` decision 9).
public struct CommandCatalog: Equatable, Sendable {
    /// In drawing order — nearest origin first, which is the order the sections come in.
    public let commands: [Command]
    public let builtins: BuiltinStatus

    public init(commands: [Command], builtins: BuiltinStatus) {
        self.commands = commands
        self.builtins = builtins
    }

    /// The Project's skills, the user's, each plugin's, then the CLI's own — with any built-in a
    /// nearer origin already answers to left out.
    ///
    /// Left out rather than listed second, for decision 7's reason: the CLI runs the nearer one, so
    /// a row for the copy it would ignore is a lie. A plugin's commands cannot collide at all,
    /// because they carry their plugin's name.
    static func joined(skills: [Command], builtins: [Command]) -> [Command] {
        let taken = Set(skills.map(\.command))
        return skills + builtins.filter { !taken.contains($0.command) }
    }
}

/// How the read of the CLI's own built-ins went — the state of the SLOWER half, pinned above the
/// picker's list rather than drawn where its section would be (decision 9).
public enum BuiltinStatus: Equatable, Sendable {
    /// Read and curated. Whatever survived is in the catalog beside the skills.
    case read
    /// The hidden session is still being asked. The skills are all there; this half is not yet.
    case reading
    /// Argo could not read this CLI's built-ins. The skills stand and this half is honestly empty
    /// — never half a list presented as whole (decision 10).
    case unavailable
}
