import Foundation

/// What version of a CLI is installed on this Mac, in its own words (#686).
///
/// Kept verbatim rather than parsed into numbers, because nothing here compares two of them: it is
/// a key, and the only question asked of it is whether it is still the same string.
///
/// Run against the executable the launcher RESOLVED, not the bare name: `claude` is very often on a
/// `PATH` only the user's login shell knows about, and asking `/usr/bin/env` would find nothing on
/// exactly the machines the app has to work on.
struct AgentVersion {
    let launcher: AgentLauncher
    let run: ShellCommand

    /// The version string, or `nil` where the CLI is not installed or would not say.
    func reported(by cli: AgentCLI, inProjectAt projectURL: URL) async -> String? {
        guard let launch = try? await launcher.launch(
            cli: cli,
            cwd: projectURL.path,
            companion: nil,
        ),
            let said = run([launch.executablePath, "--version"])
        else { return nil }
        let trimmed = said.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
