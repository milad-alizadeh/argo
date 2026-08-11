import SwiftUI

// The reading's bottom edge under the composer.

extension FeedView {
    /// The bottom edge under a composer: rows run beneath the vessel and fade before they reach
    /// it, never clipped by it. Fully opaque when nothing floats there — the mask stays applied
    /// either way, because a modifier that comes and goes takes the scroll state with it.
    var fade: some View {
        VStack(spacing: ArgoSpacing.flush) {
            Color.black
            if isUnderComposer {
                LinearGradient(
                    colors: [.black, .clear],
                    startPoint: .top,
                    endPoint: .bottom,
                )
                .frame(height: ArgoComposerVessel.feedFadeHeight)
                Color.clear.frame(height: ArgoComposerVessel.feedClearHeight)
            }
        }
    }

    /// The user's own words coming back as a row — the echo that is the send's acceptance, marked
    /// with the accent wash. Only a prompt among the ARRIVING rows takes it.
    func washArrived(between was: Int, and now: Int) {
        guard now > was else { return }
        guard let echoed = rows[was ..< now].last(where: \.isPrompt) else { return }
        washed = echoed.id
    }

    /// The wash's whole lifetime: it stands for the hold and leaves.
    ///
    /// A cancelled sleep RESUMES here rather than stopping, so the clear is gated on it: a
    /// second send re-keys this task, and the superseded one clearing anyway would wipe the
    /// fresh row's wash milliseconds into its hold.
    func washExpired() async {
        guard washed != nil else { return }
        try? await Task.sleep(for: .seconds(ArgoComposerVessel.washHold))
        guard !Task.isCancelled else { return }
        washed = nil
    }
}
