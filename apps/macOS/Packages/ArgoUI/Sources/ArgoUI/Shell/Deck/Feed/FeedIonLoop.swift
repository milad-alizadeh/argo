import ArgoDesign
import SwiftUI

/// The one loop, driven ONE PASS AT A TIME, and the rung the wait's age has cooled it to. Every
/// live surface runs off this: the thread across the measure, the wash over a call in flight, and
/// the roster dot's pulse (#1291), which is in the sidebar rather than the feed — the loop belongs
/// to `ArgoMotion.working`, not to the room that first drew it.
///
/// A pass at a time is what lets the period change without the pass on screen restarting: the rung
/// is re-read at each boundary, so a wait that turns ten seconds mid-pass finishes the pass it is
/// on and starts the next one slower.
///
/// The pass is also the clock, so nothing else ticks. It runs in a `.task`, which exists exactly
/// while the row is drawn — a feed of finished rows schedules nothing.
struct FeedIonLoop<Content: View>: View {
    @Environment(\.argoReduceMotion) private var reduceMotion
    @Environment(\.argoAgesWait) private var forcedAge
    @Environment(\.argoWaitStarted) private var waitStarted

    /// The pass, drawn where it has got to and at the strength its age has left it. `phase` runs 0
    /// at the start of a pass to 1 at its end, and is `nil` while movement is off — each surface
    /// then parks the way its own design parks.
    @ViewBuilder let content: (_ phase: Double?, _ aged: ArgoWaitAge) -> Content

    @State private var phase: Double = 0
    @State private var aged = ArgoWaitAge.freshest

    /// A forced age answers before the loop has run a tick, so a render is the rung it asked for on
    /// its FIRST frame rather than one frame of `freshest` and then the rung.
    ///
    /// Keyed on Reduce Motion: the setting can be turned off with a live row on screen, and the
    /// loop that returned when it went on has to start.
    var body: some View {
        content(reduceMotion ? nil : phase, forcedAge.map(ArgoWaitAge.rung(at:)) ?? aged)
            .task(id: reduceMotion) { await run() }
    }

    /// `@MainActor` because every line of it writes view state or opens a transaction, and `.task`
    /// alone does not keep an `async` method on the main actor.
    @MainActor private func run() async {
        let appeared = Date()
        while !Task.isCancelled {
            let rung = ArgoWaitAge.rung(at: age(since: appeared))
            guard let pass = rung.motion.resolvedPass(reduceMotion: reduceMotion) else { return }
            aged = rung
            withAnimation(pass) { phase = 1 }
            try? await Task.sleep(for: .seconds(rung.period))
            guard !Task.isCancelled else { return }
            // Back to the start with no animation, then a tick before the next pass: SwiftUI folds
            // every change in one tick into the last value, so a reset in the same tick as the
            // pass would leave nothing to animate. Both ends of the travel are off the surface,
            // so the tick is not seen.
            var reentry = Transaction()
            reentry.disablesAnimations = true
            withTransaction(reentry) { phase = 0 }
            try? await Task.sleep(for: .seconds(ArgoMotion.passReentry))
        }
    }

    /// The WAIT's age. `argoWaitStarted` outlives the cell this row is drawn in, so scrolling a
    /// live row off and back does not restart it.
    ///
    /// It measures from when ARGO first saw the wait, not from when the Turn began: a transcript
    /// carries no timestamp for a think. A window opened onto a Turn already six minutes in
    /// therefore reads at the first rung until the next wait.
    private func age(since appeared: Date) -> TimeInterval {
        forcedAge ?? Date().timeIntervalSince(waitStarted ?? appeared)
    }
}

extension EnvironmentValues {
    /// How old the wait is, forced for a RENDER — the cooled rungs are a minute and five minutes
    /// in. Read INSTEAD of the clock, and only where a render sets it.
    @Entry package var argoAgesWait: TimeInterval?

    /// When the wait the reading is showing began — `FeedView`'s answer, stamped when `FeedWait`
    /// changes. In the environment because the table hosts each row in its own `NSHostingView`, so
    /// this is the one thing a recycled cell can be handed that the recycling cannot reset.
    @Entry var argoWaitStarted: Date?
}
