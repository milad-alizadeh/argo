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
    @Environment(\.argoIonPass) private var shared

    /// Whether there is a Turn to report. A loop is instantiated whether or not one is running, so
    /// that a Session going quiet does not change the shape of the tree above it (`SharedIonPass`);
    /// `false` publishes a still pass and schedules nothing.
    var isLive = true

    /// The pass, drawn where it has got to and at the strength its age has left it. `phase` runs 0
    /// at the start of a pass to 1 at its end, and is `nil` while movement is off — each surface
    /// then parks the way its own design parks.
    @ViewBuilder let content: (_ phase: Double?, _ aged: ArgoWaitAge) -> Content

    @State private var phase: Double = 0
    @State private var aged = ArgoWaitAge.freshest

    /// A forced age answers before the loop has run a tick, so a render is the rung it asked for on
    /// its FIRST frame rather than one frame of `freshest` and then the rung.
    ///
    /// Keyed on whether it should be moving: Reduce Motion can be turned off, or a Turn can start,
    /// with the row already on screen, and the loop that returned then has to start.
    ///
    /// A pass already running ABOVE this one wins. Two surfaces reporting one Turn have to rise and
    /// fall together, and two loops started at two moments do not (#1403) — so a loop under a
    /// `SharedIonPass` draws that pass and starts none of its own.
    var body: some View {
        if let shared {
            content(shared.phase, shared.aged)
        } else {
            content(isMoving ? phase : nil, forcedAge.map(ArgoWaitAge.rung(at:)) ?? aged)
                .task(id: isMoving) { await run() }
        }
    }

    /// Whether this loop should be travelling at all: a Turn to report, and movement left on.
    private var isMoving: Bool {
        isLive && !reduceMotion
    }

    /// `@MainActor` because every line of it writes view state or opens a transaction, and `.task`
    /// alone does not keep an `async` method on the main actor.
    @MainActor private func run() async {
        guard isLive else { return }
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

/// One pass of the loop as a VALUE, so more than one surface can be drawn from the same one. The
/// roster row's state dot and its `PlanBar` both report the live Turn, and they are only one
/// reading if they breathe off one clock (#1403).
struct FeedIonPass: Equatable {
    /// Where the pass has got to, 0 to 1, or `nil` while nothing is moving.
    let phase: Double?
    /// The rung the wait's age has cooled the pass to.
    let aged: ArgoWaitAge
}

/// Runs one `FeedIonPass` and publishes it, so every `FeedIonLoop` under it adopts that pass
/// rather than opening a second one of its own.
///
/// It is drawn whether or not the thing it reports is live, and answers that with `isLive` rather
/// than with a branch at the call site: a wrapper that came and went would give the content it
/// holds a new identity every time a Session went quiet, and a row rebuilt mid-rename loses the
/// field the reader is typing into.
struct SharedIonPass<Content: View>: View {
    /// Whether there is a Turn to report.
    let isLive: Bool
    /// When that Turn began, which is what the pass ages off.
    let waitStarted: Date?
    @ViewBuilder let content: () -> Content

    var body: some View {
        FeedIonLoop(isLive: isLive) { phase, aged in
            content()
                .environment(\.argoIonPass, FeedIonPass(phase: phase, aged: aged))
        }
        .environment(\.argoWaitStarted, waitStarted)
    }
}

extension EnvironmentValues {
    /// The pass a `SharedIonPass` above is already running. Every `FeedIonLoop` under one draws
    /// this
    /// instead of its own, which is what keeps two readings of one Turn in step.
    @Entry var argoIonPass: FeedIonPass?

    /// How old the wait is, forced for a RENDER — the cooled rungs are a minute and five minutes
    /// in. Read INSTEAD of the clock, and only where a render sets it.
    @Entry package var argoAgesWait: TimeInterval?

    /// When the wait the reading is showing began — `FeedView`'s answer, stamped when `FeedWait`
    /// changes. In the environment because the table hosts each row in its own `NSHostingView`, so
    /// this is the one thing a recycled cell can be handed that the recycling cannot reset.
    @Entry var argoWaitStarted: Date?
}
