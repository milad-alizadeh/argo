import AppKit
import Foundation
import QuartzCore

/// Samples the cockpit window's real presentation cadence, and is inert unless
/// `ARGO_FRAME_PROBE=1`.
///
/// A `CADisplayLink` attached to a view in the window fires once per vsync on the main run loop, so
/// a late callback IS a main-thread hitch — which is why the intervals below are taken at callback
/// entry rather than off the link's own `timestamp`, which reports the vsync the frame was aimed at
/// and hides the delivery delay this exists to measure.
///
/// Nothing here runs in a shipped session: `isEnabled` is read once, and the only per-frame work
/// under it is one append into a reserved array.
@MainActor final class FrameProbe: NSObject {
    static let shared = FrameProbe()

    static var isEnabled: Bool {
        ProcessInfo.processInfo.environment["ARGO_FRAME_PROBE"] == "1"
    }

    private var stamps: [Double] = []
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
        FrameProbeReport.write(FrameProbeSummary(stamps: stamps, displayMaxFPS: displayMaxFPS))
        if exiting {
            exit(0)
        }
    }
}
