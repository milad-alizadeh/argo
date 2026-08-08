import Foundation

/// The `PATH` the user's own shell would give an agent, read by asking that shell.
///
/// An app launched from Finder inherits `launchd`'s minimal environment, not a terminal's — so a
/// spawn that trusted `ProcessInfo` would fail to find `claude` on the machine where `claude`
/// plainly works, and the agent that did start would find no `git` or `node` either. This is the
/// one place that difference is paid for, and it is paid once.
enum LoginShellPath {
    /// Interactive AND login (`-ilc`): `PATH` is set in `.zshrc` on about as many Macs as in
    /// `.zprofile`, and reading only one of the two is the same failure with a different cause.
    /// Whatever the rc files print comes first, so the answer is the LAST non-empty line — a
    /// `PATH` never contains one.
    static func read(_ run: ShellCommand = shellCommand) -> String? {
        guard let shell = ProcessInfo.processInfo.environment["SHELL"],
              let output = run([shell, "-ilc", "printf '%s\\n' \"$PATH\""])
        else { return nil }
        return output.split(whereSeparator: \.isNewline).last.map(String.init)
    }

    /// That `PATH`, or the one this process was given. The fallback is not a good answer, but it is
    /// the only other one there is, and a spawn that refused outright would fail on a Mac where the
    /// shell simply took too long to answer.
    static func resolved(_ run: ShellCommand = shellCommand) -> String {
        read(run) ?? ProcessInfo.processInfo.environment["PATH"] ?? "/usr/bin:/bin"
    }
}
