import Foundation

/// Which plugins `claude` currently has switched ON, read from the settings files it reads.
///
/// A separate fact from being installed, and the catalog needs both: a plugin can sit live in the
/// install record with its skills unpacked and still be switched off, at which point no command
/// reaches them. Two of the five plugins installed on this machine are off.
struct EnabledPlugins {
    private let switches: [String: Bool]

    /// The user's settings, then the Project's shared file, then its local one. Each overrides the
    /// last per key, which is the order `claude` layers them in.
    init(homeURL: URL, projectURL: URL) {
        self.switches = [
            homeURL.appending(path: ".claude/settings.json"),
            projectURL.appending(path: ".claude/settings.json"),
            projectURL.appending(path: ".claude/settings.local.json"),
        ]
        .reduce(into: [:]) { merged, url in
            merged.merge(Self.read(url)) { _, later in later }
        }
    }

    /// Only an explicit `true` counts. A plugin named in no settings file is off: `posthog` is
    /// installed and absent here, and its skills are absent from the CLI's own list.
    func isEnabled(_ key: String) -> Bool {
        switches[key] == true
    }

    private static func read(_ url: URL) -> [String: Bool] {
        guard let data = try? Data(contentsOf: url),
              let settings = try? JSONDecoder().decode(Settings.self, from: data)
        else { return [:] }
        return settings.enabledPlugins ?? [:]
    }

    /// The one key of the settings file this reads. Everything else there belongs to the CLI.
    private struct Settings: Decodable {
        let enabledPlugins: [String: Bool]?
    }
}
