import SwiftUI

/// One ion pass across a call that is still running, masked to that call's own type.
///
/// **The whole row is one painting surface.** The gradient is masked to everything the row says as
/// a SINGLE piece — mark, verb, subject and all — never to each span. Painting per span fires every
/// span at once and restarts the sweep at each word boundary; it looks right in a screenshot and
/// wrong in motion, which is why a still cannot catch it and why this modifier takes the whole
/// sentence rather than being applied inside it.
///
/// The kind's glyph shares the one mask for free, because a mask is taken from what is drawn.
struct FeedCallLineIon: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Whether this call is the one in flight.
    let isRunning: Bool

    func body(content: Content) -> some View {
        content.overlay {
            if isRunning, !reduceMotion {
                IonWash().mask { content.environment(\.isIonMask, true) }
            }
        }
    }
}

extension EnvironmentValues {
    /// True while a row is drawing itself AS its own ion mask. A mask is taken from what is drawn,
    /// so a ground under a run of type masks as solid and lights the whole chip rather than the
    /// letters on it — the one thing in the row that must not answer the mask.
    ///
    /// The mask is the row itself and not a second copy of it, because a copy is a layout that can
    /// drift from the one it is masking.
    @Entry var isIonMask: Bool = false
}

extension View {
    /// Lights this run of type with the ion while a call is in flight. Applied to the part of the
    /// row the ion crosses, so what is left outside — the chevron — stays out of the mask.
    func feedCallLineIon(isRunning: Bool) -> some View {
        modifier(FeedCallLineIon(isRunning: isRunning))
    }
}

/// The pass itself: the ramp at the full length of the line, translating across it.
///
/// Only the TRANSFORM animates. A translating element is compositor-owned; moving a gradient's own
/// stops is not, and repaints every frame of a loop that never ends.
///
/// It exists only while the call is running, so its loop starts on appear and is torn down with the
/// view — a failure arriving mid-pass takes the wash off the row with it rather than being
/// swallowed by a mask that outlived the state it drew.
private struct IonWash: View {
    @Environment(\.argo) private var argo

    /// Where the pass sits, as a multiple of the line's own width. It starts and ends entirely off
    /// the line, so the ion enters and leaves rather than appearing mid-word.
    @State private var phase: CGFloat = -1

    var body: some View {
        GeometryReader { proxy in
            LinearGradient(
                gradient: argo.color.ion.gradient,
                startPoint: .leading,
                endPoint: .trailing,
            )
            .frame(width: proxy.size.width)
            .offset(x: phase * proxy.size.width)
            .onAppear {
                withAnimation(ArgoMotion.working.animation) { phase = 1 }
            }
        }
    }
}
