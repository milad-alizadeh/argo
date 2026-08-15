import Foundation

/// What version of a CLI is installed on this Mac, in its own words (#686). A key rather than a
/// number: nothing compares two of them.
struct AgentVersion {
    let launcher: AgentLauncher
    let run: ShellCommand

    /// The version string, or `nil` where the CLI is not installed or would not say.
    ///
    /// Run against the executable the launcher RESOLVED: `claude` is very often on a `PATH` only
    /// the user's login shell knows about, so `/usr/bin/env` would find nothing on exactly the
    /// machines this has to work on.
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
