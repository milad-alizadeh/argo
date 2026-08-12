import Foundation

/// The record `claude` keeps of which plugins are installed, where their files were unpacked, and
/// which Project each install belongs to.
///
/// Read rather than globbed: the cache keeps every version ever installed — four of one plugin
/// sit under this machine's cache — and only this record names the live one.
struct InstalledPlugins: Decodable {
    /// Keyed `plugin@marketplace`, with more than one install per key: the same plugin can be
    /// installed user-wide and again for a Project.
    let plugins: [String: [Install]]

    struct Install: Decodable {
        let scope: String
        /// Present on a `project` install, naming the Project it was installed for.
        let projectPath: String?
        /// Where this install's files were unpacked. Its `skills/` directory is what a catalog
        /// reads.
        let installPath: String

        /// Whether the named Project sees this install. A scope Argo does not know serves nothing,
        /// rather than showing a Project skills it cannot invoke.
        func serves(_ projectPath: String) -> Bool {
            switch scope {
            case "user": true
            case "project": self.projectPath.map { standardized(URL(filePath: $0)) } == projectPath
            default: false
            }
        }
    }

    /// Every live install's plugin name and skills directory, for one Project. A record that cannot
    /// be read answers nothing, which shows up as a picker carrying no plugin skills.
    static func skillDirectories(
        under homeURL: URL,
        for projectURL: URL,
    )
        -> [(plugin: String, url: URL)] {
        let recordURL = homeURL.appending(path: ".claude/plugins/installed_plugins.json")
        guard let data = try? Data(contentsOf: recordURL),
              let record = try? JSONDecoder().decode(InstalledPlugins.self, from: data)
        else { return [] }
        let project = standardized(projectURL)
        return record.plugins
            .sorted { $0.key < $1.key }
            .flatMap { key, installs in
                installs
                    .filter { $0.serves(project) }
                    .map { (plugin: Self.name(of: key), url: Self.skills(at: $0.installPath)) }
            }
    }

    /// The part of the key before its marketplace, which is what the CLI answers to.
    private static func name(of key: String) -> String {
        String(key.split(separator: "@").first ?? "")
    }

    private static func skills(at installPath: String) -> URL {
        URL(filePath: installPath).appending(path: "skills", directoryHint: .isDirectory)
    }

    /// Whether a file URL carries a trailing slash depends on whether the folder existed when it
    /// was built, so two URLs naming one folder are not reliably equal. Their paths are.
    fileprivate static func standardized(_ url: URL) -> String {
        let path = url.standardizedFileURL.path(percentEncoded: false)
        return path.count > 1 && path.hasSuffix("/") ? String(path.dropLast()) : path
    }
}
