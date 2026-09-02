import ArgoDesign
import SwiftUI

/// A feed with no row in it. It says so, because a blank zone is indistinguishable from one that
/// failed to draw.
///
/// WHICH of the four empties it is comes off `FeedVacancy`, from the environment: a window with
/// Sessions and none chosen is not a window with no Sessions, and the words are the only thing on
/// screen that can tell them apart.
///
/// `unread` is the one of them that is HELD BACK. Every Session switch passes through it — the
/// pass that paints a fresh selection takes no reading — so a word drawn the moment it arrives
/// would flash on every click, which is worse than no word at all. It waits
/// `ArgoMotion.unreadDelay`, and a deck that fills inside that says nothing, draws nothing and
/// animates nothing.
///
/// The clock times the BLANK and not the click. Two switches that never leave `unread` between
/// them share one, and that is the reading the reader has actually been given: they have been in
/// front of a deck with nothing on it for the whole of it.
package struct FeedSilence: View {
    @Environment(\.argo) private var argo
    @Environment(\.argoFeedVacancy) private var vacancy

    /// Seeded overdue by a specimen, and `nil` everywhere else so the surface runs its own clock.
    /// A specimen may not wait half a second for its subject to appear — a render that raced the
    /// delay would come out blank, and a blank render reads as a broken harness rather than as a
    /// state (`docs/agents/visual-verification.md`).
    package var overdue: Bool?

    /// Whether the wait has run past the delay.
    @State private var isOverdue = false

    package init(overdue: Bool? = nil) {
        self.overdue = overdue
    }

    package var body: some View {
        Text(vacancy.words(overdue: overdue ?? isOverdue))
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.disabled)
            // SYNCHRONOUS, and beside the task rather than inside it: a `.task` body runs after
            // the render that re-keyed it, so a reset written there lands a frame late — and one
            // frame with the word still up is exactly the flash the delay exists to prevent.
            .onChange(of: vacancy) { _, _ in isOverdue = false }
            .task(id: vacancy) { await wait() }
    }

    /// Cancelled by SwiftUI the moment the vacancy changes, so a deck that filled inside the delay
    /// never reaches the write.
    private func wait() async {
        guard vacancy == .unread else { return }
        try? await Task.sleep(for: .seconds(ArgoMotion.unreadDelay))
        guard !Task.isCancelled else { return }
        isOverdue = true
    }
}

#Preview("Feed silence — a Session that has said nothing") {
    FeedSilence()
        .padding(ArgoSpacing.region)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed silence — a roster with Sessions on it and none chosen") {
    FeedSilence()
        .padding(ArgoSpacing.region)
        .environment(\.argoFeedVacancy, .unselected)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed silence — no Sessions at all") {
    FeedSilence()
        .padding(ArgoSpacing.region)
        .environment(\.argoFeedVacancy, .noSessions)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed silence — a switch Argo has not drawn yet") {
    FeedSilence(overdue: true)
        .padding(ArgoSpacing.region)
        .environment(\.argoFeedVacancy, .unread)
        .argoDeckSurface()
        .argoAppearance()
}
