import AppKit
import QuartzCore
import SwiftUI

/// A view that draws nothing and exists to own a display link.
///
/// `NSView.displayLink(target:selector:)` delivers on the MAIN run loop, which is what makes it the
/// right instrument here rather than a timer: the callback is queued behind whatever SwiftUI is
/// doing, so a body re-evaluation or a layout pass that overruns a refresh shows up as a long
/// interval. A timer on another thread would report a display that never missed a beat while the
/// window in front of it stuttered.
struct FrameMeter: NSViewRepresentable {
    let recorder: FrameRecorder

    func makeNSView(context: Context) -> FrameMeterHost {
        FrameMeterHost(recorder: recorder)
    }

    func updateNSView(_ view: FrameMeterHost, context: Context) {}
}

final class FrameMeterHost: NSView {
    private let recorder: FrameRecorder
    private var link: CADisplayLink?
    private var last: CFTimeInterval?

    init(recorder: FrameRecorder) {
        self.recorder = recorder
        super.init(frame: .zero)
    }

    /// Never loaded from a nib — this view is only ever made in code, by the line above.
    @available(*, unavailable)
    required init?(coder: NSCoder) { nil }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        link?.invalidate()
        last = nil
        guard window != nil else {
            link = nil
            recorder.settle()
            return
        }
        let started = displayLink(target: self, selector: #selector(tick))
        // The display's top rate, asked for explicitly. A ProMotion panel drops to a low refresh
        // when nothing is moving, and an idle 41ms interval is not a dropped frame — without this,
        // the quietest part of a run reads as the worst of it.
        started.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        started.add(to: .main, forMode: .common)
        link = started
    }

    /// The FIRST interval after arriving is discarded, not recorded: there is no previous timestamp
    /// to subtract, and the gap across a window change is a launch rather than a frame.
    @objc private func tick(_ link: CADisplayLink) {
        defer { last = link.timestamp }
        guard let last else { return }
        recorder.record((link.timestamp - last) * 1000)
    }
}
