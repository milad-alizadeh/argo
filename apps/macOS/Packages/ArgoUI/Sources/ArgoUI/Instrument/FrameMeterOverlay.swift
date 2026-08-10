import SwiftUI

/// The instrument, wired: a display link, the samples it produced, and the four numbers they come
/// to — or nothing at all, which is what a normal launch gets.
///
/// The flag is read ONCE, when this view is made, and the whole instrument is behind it. A launch
/// that did not ask for it holds no recorder, adds no display link and draws no view, so the cost
/// of shipping this is a branch on an environment variable at window time.
struct FrameMeterOverlay: View {
    @State private var recorder: FrameRecorder?

    /// The stack is not decoration. A modifier on an `EmptyView` is dropped, so with the flag read
    /// from a `.task` hung on the conditional itself, a launch that HAS asked for the meter never
    /// runs the task that would create it — the instrument is empty, so it stays empty. The task
    /// belongs on a view that exists either way.
    var body: some View {
        ZStack(alignment: .topTrailing) { instrument }
            .task {
                let flag = FrameFlag.current
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
    /// Flagged, never hot: `ARGO_FEED_FPS=1` from a terminal, `--feed-fps` through the render
    /// harness, or either `…_LOG` spelling to keep the raw intervals. See `FrameFlag`.
    func argoFrameMeter() -> some View {
        overlay(alignment: .topTrailing) { FrameMeterOverlay() }
    }
}
