import AppKit
import SwiftUI

/// A zero-sized view whose only job is to be IN the cockpit window, so the probe has something to
/// take a display link off. `NSScreen.displayLink` would sample a screen; this samples the window,
/// which is what moves when the reader drags it to another display.
struct FrameProbeAnchor: NSViewRepresentable {
    func makeNSView(context _: Context) -> NSView {
        Anchor()
    }

    func updateNSView(_: NSView, context _: Context) {}

    final class Anchor: NSView {
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            FrameProbe.shared.attach(to: self)
        }
    }
}

public extension View {
    /// Attaches the frame probe. Inert unless `ARGO_FRAME_PROBE=1`, including the anchor itself.
    func frameProbe() -> some View {
        background {
            if FrameProbe.isEnabled {
                FrameProbeAnchor().frame(width: 0, height: 0).allowsHitTesting(false)
            }
        }
    }
}
