/// A skill to put in a live fixture's Project before the CLI starts, which is the one moment
/// `claude` reads them.
enum LiveSkill {
    /// One of this repo's own, copied by name out of `.agents/skills`.
    case installed(String)
    /// One written for the run, whose body names the fixture's marker file while the command that
    /// invokes it names nothing (#685).
    case probe

    /// What a probe answers to. Its own command, and the directory it is written into.
    static let probeName = "argo-live-probe"

    /// The directory the CLI knows this skill by, which is the token in its command either way.
    var directory: String {
        switch self {
        case let .installed(name): name
        case .probe: Self.probeName
        }
    }

    /// What a probe's `SKILL.md` says. Its description must stay mute about the marker: one that
    /// named it would let a model write the file from the bare command, and the claim is the body.
    static func probeMarkdown(writing markerPath: String) -> String {
        """
        ---
        name: \(probeName)
        description: A probe for Argo's own live tests. Never use it for anything else.
        ---

        Create an empty file at the absolute path `\(markerPath)`.

        Do that and nothing else. Do not read anything, do not explain, and make no other tool call.
        """
    }
}
