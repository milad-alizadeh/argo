import Foundation

/// One plugin installed on the machine, as `installed_plugins.json` records it.
struct FixturePlugin {
    var name: String
    var marketplace = "a-marketplace"
    /// The Project it is installed for. `nil` is a user-wide install, which every Project sees.
    var forProject: URL?
    /// Whether the settings switch it on. Installed and switched off is a real state on this
    /// machine, and the reachable one has to be asked for.
    var isEnabled = true
    var skills: [FixtureSkill] = []

    var key: String {
        "\(name)@\(marketplace)"
    }
}
