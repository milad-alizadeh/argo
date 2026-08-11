import SwiftUI

/// The one loop, driven ONE PASS AT A TIME, and the rung the wait's age has cooled it to. Both live
/// surfaces run off this: the thread across the measure, and the wash over a call in flight.
///
/// A pass at a time rather than `repeatForever`, because that is what lets the period change
/// without the pass on screen restarting. A wait that turns ten seconds mid-pass finishes its pass
/// and starts the next one slower, so crossing a threshold retargets the loop and the ion never
/// jumps back to the left edge.
///
/// **The pass is the clock.** The age is read at each boundary, where the next period has to be
/// decided anyway, so nothing else ticks. The loop lives in a `.task`, which exists exactly while
/// the row is drawn and is cancelled the moment it is not — a feed of finished rows schedules
/// nothing, and a long transcript scrolling past a Turn in flight costs what it costs at rest.
struct FeedIonLoop<Content: View>: View {
    @Environment(\.argoReduceMotion) private var reduceMotion
    @Environment(\.argoAgesWait) private var forcedAge
    @Environment(\.argoWaitStarted) private var waitStarted

    /// The pass, drawn where it has got to and at the strength its age has left it.
    ///
    /// `phase` runs 0 at the start of a pass to 1 at its end, and is `nil` while movement is off:
    /// nothing is travelling then, and each surface parks the way its own design parks.
    @ViewBuilder let content: (_ phase: Double?, _ aged: ArgoWaitAge) -> Content

    @State private var phase: Double = 0
    @State private var aged = ArgoWaitAge.all[0]

    var body: some View {
        content(reduceMotion ? nil : phase, aged)
            .task { await run() }
    }

    private func run() async {
        let appeared = Date()
        while !Task.isCancelled {
            let rung = ArgoWaitAge.rung(at: age(since: appeared))
            guard let pass = rung.motion.resolvedPass(reduceMotion: reduceMotion) else { return }
            aged = rung
            withAnimation(pass) { phase = 1 }
            try? await Task.sleep(for: .seconds(rung.period))
            guard !Task.isCancelled else { return }
            var reentry = Transaction()
            reentry.disablesAnimations = true
            withTransaction(reentry) { phase = 0 }
            try? await Task.sleep(for: .seconds(ArgoMotion.passReentry))
        }
    }

    /// The WAIT's age, not this view's. `FeedWait` is what the reading counts from, and it outlives
    /// the cell: the table recycles rows, so a clock kept here alone would restart every time the
    /// reader scrolled a live row off and back.
    ///
    /// `appeared` stands in where nothing set it — a bare preview of the surface, or the frame
    /// before the feed has stamped its own answer, which is the same moment either way.
    private func age(since appeared: Date) -> TimeInterval {
        forcedAge ?? Date().timeIntervalSince(waitStarted ?? appeared)
    }
}

extension EnvironmentValues {
    /// How old the wait is, forced for a RENDER. The cooled rungs are a minute and five minutes in,
    /// and a state nobody can sit through is a state nobody ever looks at.
    ///
    /// Read INSTEAD of the clock, and only where a render sets it: the live surfaces measure their
    /// own wait, which is the one reading that is true of the Turn actually in flight.
    @Entry var argoAgesWait: TimeInterval?

    /// When the wait the reading is showing began — `FeedView`'s answer, stamped when `FeedWait`
    /// changes. In the environment because the table hosts each row in its own `NSHostingView`, so
    /// this is the one thing a recycled cell can be handed that the recycling cannot reset.
    @Entry var argoWaitStarted: Date?
}
