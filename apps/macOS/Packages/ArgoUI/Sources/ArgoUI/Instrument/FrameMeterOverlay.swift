import SwiftUI

/// The instrument, wired: a display link, the samples it produced, and the four numbers they come
/// to — or nothing at all, which is what a normal launch gets.
///
/// The flag is a parameter, not a read: the process is looked at once, in the modifier below, so
/// this view can be drawn on and off without a launch argument.
struct FrameMeterOverlay: View {
    let flag: FrameFlag

    @State private var recorder: FrameRecorder?

    /// The stack is not decoration. A modifier on an `EmptyView` is dropped, so with the task hung
    /// on the conditional itself, a launch that HAS asked for the meter never runs the task that
    /// would create it — the instrument is empty, so it stays empty.
    var body: some View {
        ZStack(alignment: .topTrailing) { instrument }
            .task {
                guard flag.isOn, recorder == nil else { return }
                recorder = FrameRecorder(flag: flag)
            }
    }

    @ViewBuilder private var instrument: some View {
        if let recorder {
            FrameHUD(reading: recorder.reading)
                .padding(ArgoSpacing.section)
                // Behind the numbers rather than beside them, because it has no size of its own:
                // the meter draws nothing and only needs to be in the tree to hold its link.
                .background { FrameMeter(recorder: recorder).frame(width: 1, height: 1) }
                .allowsHitTesting(false)
        }
    }
}

public extension View {
    /// The frame HUD over this window, when the launch asked for one.
    ///
    /// Flagged, never hot: `ARGO_FEED_FPS=1` from a terminal, or `--feed-fps-log <path>` through
    /// the render harness, which also keeps the raw intervals. See `FrameFlag`.
    func argoFrameMeter() -> some View {
        overlay(alignment: .topTrailing) { FrameMeterOverlay(flag: .current) }
    }
}

#Preview("Frame meter — a launch that asked for it") {
    FrameMeterOverlay(flag: FrameFlag(environment: ["ARGO_FEED_FPS": "1"], arguments: []))
        .frame(width: 480, height: 200)
        .argoDeckSurface()
        .argoAppearance()
}

// The ordinary launch, and the state worth looking at: the overlay has to come out EMPTY rather
// than as a HUD reading zero.
#Preview("Frame meter — an ordinary launch") {
    FrameMeterOverlay(flag: FrameFlag(environment: [:], arguments: []))
        .frame(width: 480, height: 200)
        .argoDeckSurface()
        .argoAppearance()
}
