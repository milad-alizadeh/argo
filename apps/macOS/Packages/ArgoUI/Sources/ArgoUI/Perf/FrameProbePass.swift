import Foundation

/// One evaluation of the window's root body: how often it happens, and what it costs.
///
/// Every per-pass cost the cockpit pays is multiplied by how often this happens, and nothing
/// measured that. A roster fold priced at a few hundred microseconds is invisible at one pass a
/// second and is the whole frame budget at sixty, so the same profile reads as "a cheap fold" or
/// "an invalidation storm" depending on a number nobody had. Both halves are taken here for that
/// reason: a rate alone cannot say whether to make the pass cheaper or to make it rarer.
///
/// It rides in the frame probe's summary rather than on an instrument of its own because the two
/// only mean anything joined — passes per second is the multiplier ON the frame band, over the
/// same window and the same clock.
///
/// Inert unless `ARGO_FRAME_PROBE=1`, and two array appends under it.
public enum FrameProbePass {
    /// Wraps the derivation the pass exists to do, rather than being called beside it: what is
    /// timed is then exactly what a pass costs, and a pass cannot be counted without it.
    ///
    /// Called from the root `Scene` body, not from a view's. A `View` is rebuilt for reasons of
    /// its own and there are hundreds of them; the Scene body is the one place a pass means "the
    /// whole window was re-derived".
    @MainActor
    public static func counting<Value>(_ derive: () -> Value) -> Value {
        guard FrameProbe.isEnabled else { return derive() }
        let opened = Date().timeIntervalSince1970
        let value = derive()
        FrameProbe.shared.countPass(opened: opened, until: Date().timeIntervalSince1970)
        return value
    }
}
