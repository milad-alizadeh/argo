import Foundation

/// The record `claude` keeps of which plugins are installed, where their files were unpacked, and
/// which Project each install belongs to.
///
/// Read rather than globbed: the cache keeps every version ever installed, and three plugins no
/// longer installed at all sit under this machine's. Only this record names what is live.
///
/// Live is not the same as reachable — see `EnabledPlugins` for the other half.
struct InstalledPlugins: Decodable {
    /// Keyed `plugin@marketplace`, with more than one install per key: the same plugin can be
    /// installed user-wide and again for a Project.
    let plugins: [String: [Install]]

    struct Install: Decodable {
        let scope: Scope
        /// Present on a `project` install, naming the Project it was installed for.
        let projectPath: String?
        /// Where this install's files were unpacked. Its `skills/` directory is what a catalog
        /// reads.
        let installPath: String

        /// Whether the named Project reaches this install.
        func serves(_ project: String) -> Bool {
            switch scope {
            case .user: true
            case .project: projectPath.map(InstalledPlugins.normalizedPath) == project
            case .unrecognised: false
            }
        }
    }

    /// How widely one install reaches. Decoded rather than kept as a string so a scope the CLI adds
    /// later arrives as `unrecognised` and reaches nothing, rather than being read as another.
    enum Scope: Decodable {
        case user
        case project
        case unrecognised

        init(from decoder: any Decoder) throws {
            switch try decoder.singleValueContainer().decode(String.self) {
            case "user": self = .user
            case "project": self = .project
            default: self = .unrecognised
            }
        }
    }

    /// Every live install one Project reaches, in key order. A record that cannot be read answers
    /// nothing, which shows up as a picker carrying no plugin skills at all.
    static func installs(under homeURL: URL, for projectURL: URL) -> [PluginInstall] {
        let recordURL = homeURL.appending(path: ".claude/plugins/installed_plugins.json")
        guard let data = try? Data(contentsOf: recordURL),
              let record = try? JSONDecoder().decode(InstalledPlugins.self, from: data)
        else { return [] }
        let project = normalizedPath(projectURL.path(percentEncoded: false))
        return record.plugins
            .sorted { $0.key < $1.key }
            .flatMap { key, installs in
                installs
                    .filter { $0.serves(project) }
                    .map { install in
                        PluginInstall(
                            key: key,
                            plugin: Self.name(of: key),
                            skillsURL: Self.skills(at: install.installPath),
                        )
                    }
            }
    }

    private static func name(of key: String) -> String {
        String(key.split(separator: "@").first ?? "")
    }

    private static func skills(at installPath: String) -> URL {
        URL(filePath: installPath).appending(path: "skills", directoryHint: .isDirectory)
    }

    /// Whether a file URL carries a trailing slash depends on whether the folder existed when it
    /// was built, so two URLs naming one folder are not reliably equal. Their paths are.
    static func normalizedPath(_ path: String) -> String {
        let standardized = URL(filePath: path).standardizedFileURL.path(percentEncoded: false)
        guard standardized.count > 1, standardized.hasSuffix("/") else { return standardized }
        return String(standardized.dropLast())
    }
}
