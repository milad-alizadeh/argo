import Foundation

/// Whether this launch is being measured, and where the raw intervals go.
///
/// Read off the process here rather than threaded through `LaunchConfiguration`: that type carries
/// the external sources the cockpit RENDERS, and an instrument is not one of them — the engine has
/// no business knowing a frame meter exists.
///
/// Two spellings for one switch, and both are load-bearing. `open --args` is how `screenshot.sh`
/// launches the app, and Launch Services does not hand the process the shell's environment — so the
/// environment variable is what a run from a terminal or from Xcode uses, and the argument is what
/// survives the harness. Naming a log path turns the meter on by itself, so a run that asked for
/// samples cannot come back with none because a second switch was missed.
///
/// Exactly ONE argument, and it always carries a value. AppKit reads argv into the
/// `NSArgumentDomain` as `-key value` pairs, and this app's window never opens when two bare
/// `--flag`s sit next to each other on the command line — one is taken as the other's value and the
/// launch dies with no window, no output and no crash report. Every flag this app accepts takes a
/// value (`--project`, `--transcript`, `--specimen`); this one does too, and a HUD with nowhere to
/// write is asked for through the environment instead.
struct FrameFlag: Equatable {
    let isOn: Bool
    /// Where each interval is written, one per line. `nil` draws the HUD and keeps nothing.
    let logPath: String?

    init(environment: [String: String], arguments: [String]) {
        let path = environment["ARGO_FEED_FPS_LOG"] ?? arguments.value(after: "--feed-fps-log")
        isOn = environment["ARGO_FEED_FPS"] == "1" || path != nil
        logPath = isOn ? path : nil
    }

    /// What the running process asked for.
    static var current: FrameFlag {
        FrameFlag(
            environment: ProcessInfo.processInfo.environment,
            arguments: ProcessInfo.processInfo.arguments,
        )
    }
}

private extension [String] {
    /// The value of a `--flag value` pair, or `nil` where the flag is absent or trailing.
    func value(after flag: String) -> String? {
        guard let at = firstIndex(of: flag), at + 1 < count else { return nil }
        return self[at + 1]
    }
}
