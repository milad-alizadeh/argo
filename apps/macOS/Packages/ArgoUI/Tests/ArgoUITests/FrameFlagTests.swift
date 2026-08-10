@testable import ArgoUI
import Testing

/// Whether a launch is being measured.
///
/// The case that earns this suite is the one that has no visible symptom: `open --args` does not
/// carry a shell's environment, so a harness that exports the variable and an app that only reads
/// the variable produce a run that looks complete and measured nothing.
@Suite("Frame flag")
struct FrameFlagTests {
    @Test
    func `an ordinary launch carries no instrument`() {
        let flag = FrameFlag(environment: [:], arguments: ["Argo"])

        #expect(!flag.isOn)
        #expect(flag.logPath == nil)
    }

    @Test
    func `the environment turns it on`() {
        #expect(FrameFlag(environment: ["ARGO_FEED_FPS": "1"], arguments: []).isOn)
    }

    /// Asking for the samples IS asking for the instrument, and it is the ONLY argument there is:
    /// Launch Services drops the environment, and two bare `--flag`s side by side stop this app's
    /// window from opening at all (see `FrameFlag`). One flag, always carrying a value.
    @Test
    func `naming a log is the whole argument, and turns it on`() {
        let flag = FrameFlag(environment: [:], arguments: ["--feed-fps-log", "/tmp/frames"])

        #expect(flag.isOn)
        #expect(flag.logPath == "/tmp/frames")
    }

    @Test
    func `a trailing log flag names nothing rather than reading past the end`() {
        #expect(FrameFlag(environment: [:], arguments: ["--feed-fps-log"]).logPath == nil)
    }

    /// The HUD without the file is a real way to run this — a person watching the numbers while
    /// they drag, keeping nothing.
    @Test
    func `the meter can be on with nowhere to write`() {
        let flag = FrameFlag(environment: ["ARGO_FEED_FPS": "1"], arguments: [])

        #expect(flag.isOn)
        #expect(flag.logPath == nil)
    }
}
