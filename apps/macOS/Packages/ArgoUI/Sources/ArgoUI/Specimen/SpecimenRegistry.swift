import SwiftUI

/// The named states the render harness can put on screen, one per launch.
///
/// `#Preview` is the story (`swift-style.md`), but only Xcode can draw one. This registry addresses
/// the same states by a name the command line can pass, so a state can be rendered to a PNG without
/// a human driving the app into it — impossible for most of them, since the app launched against an
/// ordinary checkout shows no Sessions.
///
/// Add an entry to one of the subject files and it is renderable, and it is renderable ONLY there:
/// `scripts/specimens.sh` asks the app for the list rather than parsing this source.
@MainActor
public enum SpecimenRegistry {
    /// One array per subject, in the order a reader meets the app: the window's furniture, the
    /// roster, the deck it opens, the reading inside it, and the two vessels over it.
    static let all: [SpecimenEntry] = roster
        + deck
        + header
        + feed
        + live
        + vessel
        + commands
        + mentions
        + connect
        + tickets

    /// What `--list-specimens` answers with.
    public static var names: [String] {
        all.map(\.name)
    }

    /// An unknown name resolves to nothing rather than to somebody else's state: the harness names
    /// the state, and a typo there should not look like a launch worth screenshotting.
    public static func entry(named name: String) -> SpecimenEntry? {
        all.first { $0.name == name }
    }

    /// What to say about a name nothing answers to, so the caller can refuse the launch. `nil`
    /// while there is nothing to refuse — no name given, or one the registry has.
    public static func refusal(for name: String?) -> String? {
        guard let name, entry(named: name) == nil else { return nil }
        return "No specimen named \(name).\n"
    }
}
