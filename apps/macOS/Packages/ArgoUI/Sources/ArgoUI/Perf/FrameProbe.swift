import AppKit
import Foundation
import QuartzCore

/// Samples the cockpit window's real presentation cadence, and is inert unless
/// `ARGO_FRAME_PROBE=1`.
///
/// Inert by two different mechanisms, which is worth stating because they are not the same one.
/// The frame half enforces it here: `attach` reads `isEnabled` and takes no display link without
/// it, so nothing calls `frame`. The pass half enforces it at the CALL SITE, in
/// `FrameProbePass.counting` — `countPass` asks no enablement question of its own, so a caller
/// that reaches it records, and every caller in the app goes through that one guard.
///
/// A `CADisplayLink` attached to a view in the window fires once per vsync on the main run loop, so
/// a late callback IS a main-thread hitch — which is why the intervals below are taken at callback
/// entry rather than off the link's own `timestamp`, which reports the vsync the frame was aimed at
/// and hides the delivery delay this exists to measure.
///
/// Nothing here runs in a shipped session: `isEnabled` is read once, and the only work under it is
/// one append per frame and two per body pass, into arrays reserved as soon as `attach` knows the
/// display's ceiling. The launch passes land before that and grow their arrays the usual way;
/// there are a few dozen of them and they are the ones a reader discards anyway.
@MainActor final class FrameProbe: NSObject {
    static let shared = FrameProbe()

    static var isEnabled: Bool {
        ProcessInfo.processInfo.environment["ARGO_FRAME_PROBE"] == "1"
    }

    /// What this process was launched as, for `FrameProbeSummary.Source` to name the build.
    /// Absent rather than substituted where there is no argv at all: nothing else here is a path.
    static var executablePath: String? {
        ProcessInfo.processInfo.arguments.first
    }

    private var stamps: [Double] = []
    /// Wall clock of every root body evaluation inside the window, on the same clock as `stamps`,
    /// and what each one cost in milliseconds. See `FrameProbePass` for why they ride here rather
    /// than on an instrument of their own.
    private var passes: [Double] = []
    private var passCosts: [Double] = []
    private var link: CADisplayLink?
    private var interrupts: DispatchSourceSignal?
    private var displayMaxFPS = 60
    private var running = false
    private var closed = false

    /// Attaches to the window `view` sits in, and RE-attaches whenever the anchor moves into a new
    /// one. A link is tied to the view it was taken off: when SwiftUI rebuilds the subtree the
    /// anchor sits in, the old link stops firing and says nothing, which reads as a display that
    /// went quiet rather than as a probe that died. The stamps carry across.
    func attach(to view: NSView) {
        guard Self.isEnabled, !closed, let screen = view.window?.screen else { return }
        link?.invalidate()
        displayMaxFPS = screen.maximumFramesPerSecond
        stamps.reserveCapacity(displayMaxFPS * 600)
        // Reserved off the frame ceiling too, because a pass is what a frame is drawn from and a
        // window cannot hold many more of them than frames without the frames going first.
        passes.reserveCapacity(displayMaxFPS * 600)
        passCosts.reserveCapacity(displayMaxFPS * 600)
        let link = view.displayLink(target: self, selector: #selector(frame(_:)))
        link.add(to: .main, forMode: .common)
        self.link = link
        guard !running else { return }
        running = true
        armStop()
    }

    @objc private func frame(_: CADisplayLink) {
        stamps.append(Date().timeIntervalSince1970)
    }

    /// Counted BEFORE the anchor is in a window, unlike frames: the first passes are what build the
    /// view the link is taken off, and a launch that cost thirty of them would otherwise report
    /// none. `close` is what ends the window, the same as for frames — which is the `closed` the
    /// guard below reads, not the parameter.
    ///
    /// It asks no enablement question of its own. `FrameProbePass.counting` is the single guard,
    /// which is what lets a suite drive the arrays without setting `ARGO_FRAME_PROBE` for the whole
    /// test process — and a second guard here would make the off path indistinguishable from a
    /// counter that never recorded anything.
    func countPass(opened: Double, until ended: Double) {
        guard !closed else { return }
        passes.append(opened)
        passCosts.append((ended - opened) * 1000)
    }

    /// The counters as they stand mid-window. Read by the suite that proves an off probe appends
    /// nothing; a run itself reads them through `close`.
    var countedPasses: [Double] {
        passes
    }

    var countedPassCosts: [Double] {
        passCosts
    }

    /// The three ways a measurement window closes: a stated duration, a SIGINT from the harness,
    /// and the app going away under it.
    private func armStop() {
        if let seconds = Self.duration {
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(seconds))
                self.close(exiting: true)
            }
        }
        signal(SIGINT, SIG_IGN)
        let source = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
        source.setEventHandler { MainActor.assumeIsolated { self.close(exiting: true) } }
        source.resume()
        interrupts = source
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(terminating),
            name: NSApplication.willTerminateNotification,
            object: nil,
        )
    }

    private static var duration: Double? {
        ProcessInfo.processInfo.environment["ARGO_FRAME_PROBE_SECONDS"]
            .flatMap(Double.init)
            .flatMap { $0 > 0 ? $0 : nil }
    }

    @objc private func terminating() {
        close(exiting: false)
    }

    /// Writes the summary and stops sampling. `exit(0)` rather than a graceful quit on the two
    /// paths a harness owns: the run is over, and anything the app does after this is unmeasured
    /// work that would only delay the harness reading the file.
    func close(exiting: Bool) {
        guard running, !closed else { return }
        closed = true
        link?.invalidate()
        link = nil
        FrameProbeReport.write(
            FrameProbeSummary(
                stamps: stamps,
                passes: passes,
                passCosts: passCosts,
                source: FrameProbeSummary.Source(
                    executablePath: Self.executablePath,
                    displayMaxFPS: displayMaxFPS,
                ),
            ),
        )
        if exiting {
            exit(0)
        }
    }
}
