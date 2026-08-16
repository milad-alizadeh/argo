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

    /// Nothing at all, for a view with no catalog behind it. `unavailable` and never `read`, by
    /// the degrade-down rule (`CONTEXT.md` L2 · Honesty tier): `read` over an empty list is the
    /// claim that the CLI has no built-in commands, which is never true of one Argo can reach.
    public static let empty = CommandCatalog(commands: [], builtins: .unavailable)

    /// The Project's skills, the user's, each plugin's, then the CLI's own — with any built-in a
    /// nearer origin already answers to left out, because the CLI runs the nearer one and a row
    /// for the copy it would ignore is a lie (decision 7).
    ///
    /// A plugin's commands cannot collide at all: they carry their plugin's name.
    static func joined(skills: [Command], builtins: [Command]) -> [Command] {
        let taken = Set(skills.map(\.command))
        return skills + builtins.filter { !taken.contains($0.command) }
    }
}
