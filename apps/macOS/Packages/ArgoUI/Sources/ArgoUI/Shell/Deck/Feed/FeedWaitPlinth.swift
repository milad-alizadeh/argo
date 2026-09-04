import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The wait Argo is holding, standing between the feed and the composer
/// (`cockpit-feed-waiting.md`).
///
/// **A wait is not a row while it runs.** It stands here, one at a time, and drops into the reading
/// as a settled row when it ends (`FeedWaitRow`). That split is the whole design: a row appended
/// mid-wait is a row that has to be EDITED when the wait ends, and the reading is written once.
///
/// The elapsed reading is what makes a stuck wait visible — #1245 from the other side — and it is
/// the one part of this surface that says "still going" with movement off, which is why Reduce
/// Motion keeps it and parks the ion rather than hiding the plinth.
struct FeedWaitPlinth: View {
    @Environment(\.argo) private var argo
    /// When this wait began — `FeedColumn`'s answer, stamped when the wait's IDENTITY changes. The
    /// elapsed reading counts from there rather than from the Session's start.
    @Environment(\.argoWaitStarted) private var waitStarted
    /// A forced age, for a render: a still cannot wait six minutes.
    @Environment(\.argoAgesWait) private var forcedAge

    let words: FeedWaitWords

    var body: some View {
        plinth
            // The FEED's own measure and the feed's own gutter, in that order: the plinth is the
            // reading's foot rather than the composer's head, so its edges stand on the same two
            // verticals the rows above it do.
            .padding(.horizontal, ArgoFeedRow.inset)
            .argoFeedMeasure()
            .padding(.bottom, Measures.stepToComposer)
    }

    /// The plinth itself: the words on their ground, with the ion along the edge.
    private var plinth: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            mark
            Text(words.running)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.secondary)
                .lineLimit(1)
                // The mark folds in here rather than speaking for itself: it is the same claim as
                // the words, drawn. TWO elements on this surface and not one, because the elapsed
                // reading beside it changes every second and a combined label is composed once.
                .accessibilityElement()
                .accessibilityLabel(words.spokenRunning)
            Spacer(minLength: ArgoSpacing.comfortable)
            elapsed
        }
        .padding(.vertical, Measures.insetY)
        .padding(.horizontal, Measures.insetX)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ground)
        // The ion runs along the edge the COMPOSER is on — the direction the work is going.
        .overlay(alignment: .bottom) { rail }
        .clipShape(shape)
        .overlay { border }
    }

    /// The act, in the accent. Drawn in the same inline box a call's mark takes, and absent
    /// entirely for a wait with no mark rather than replaced by a default.
    @ViewBuilder private var mark: some View {
        if let symbol = words.symbol {
            ArgoGlyph(symbol, .inline)
                .foregroundStyle(argo.color.interaction.accent)
        }
    }

    /// The quietest thing on the plinth: it is there to be CHECKED, not read. It ticks by the
    /// second, and the timeline wraps the text ALONE — ticking anything wider would restart the ion
    /// beside it mid-pass.
    private var elapsed: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let elapsed = seconds(at: context.date)
            Text(TurnClockPhrase.figure(seconds: elapsed))
                .argoText(ArgoTypography.machineCaption)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.disabled)
                .lineLimit(1)
                // Spoken in words, because `6m 41s` read out is a string of characters. It is the
                // one part of this surface that says "still going" with movement off, so a reader
                // who cannot see it must still be able to ask for it.
                .accessibilityLabel(TurnClockPhrase.spoken(seconds: elapsed))
                // It changes under its own steam, so it is not re-announced each tick.
                .accessibilityAddTraits(.updatesFrequently)
        }
    }

    /// How long the wait has run. A forced age answers instead of the clock, and only where a
    /// render sets one; with neither, the wait has just begun.
    private func seconds(at now: Date) -> Int {
        if let forcedAge {
            return Int(forcedAge)
        }
        guard let waitStarted else { return 0 }
        return TurnClockPhrase.seconds(sinceMs: waitStarted.epochMs, nowMs: now.epochMs)
    }

    private var ground: some View {
        shape.fill(argo.color.surface.raised)
    }

    private var border: some View {
        shape.stroke(argo.color.edge.hairline, lineWidth: ArgoStroke.border)
    }

    /// A chip's radius, not a popover's: this is not a surface that floats.
    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.control, style: .continuous)
    }

    /// The ion along the plinth's bottom edge, at the FILAMENT's own length — read off the column
    /// and never off this lane. Length is what makes one period one velocity: travel is stated in
    /// multiples of the filament's own length, so a filament cut to a share of a narrower lane
    /// would cover less ground per pass and read slower at the same period.
    private var rail: some View {
        FeedWaitIon()
            // Taller than the filament by the bloom's own radius, so the glow has somewhere to
            // spread: a lane cut to the filament's 2pt clips the halo away and leaves a hard band
            // where the design asks for light. The plinth's own clip takes the half below the edge.
            .frame(height: ArgoStroke.indicator + ArgoElevation.bloom.blur * 2)
    }

    /// The plinth's own measures. Beside the view rather than in `ArgoDesign` (`rules/swift.md`):
    /// these are one surface's arithmetic, and the design promotes no token for them.
    enum Measures {
        /// Above and below the words.
        static let insetY: CGFloat = ArgoSpacing.base
        /// At the leading and trailing edges.
        static let insetX: CGFloat = ArgoSpacing.comfortable
        /// Between the plinth and whatever floats under it.
        static let stepToComposer: CGFloat = ArgoSpacing.base
        /// What the plinth costs the reading's bottom edge: its own height plus the step below it.
        /// A MEASURE rather than a read-back height — the plinth is one line of body type between
        /// two fixed insets, so its height is arithmetic and the reading's gutter needs it before
        /// anything is laid out (see `FeedBottomEdge`).
        static let footprint: CGFloat = ArgoFeedRow.lineHeight + insetY * 2 + stepToComposer
    }
}

/// The ion along the plinth's edge: one filament at the COLUMN's own share, translating across the
/// rail and clipped to it.
///
/// Its own view rather than `FeedWorkingThread` reused, because the two differ in exactly one thing
/// — the thread runs the zone's full width and this runs a lane the plinth defines — and both take
/// their filament from the same number, which is the point the design makes about speed.
private struct FeedWaitIon: View {
    @Environment(\.argo) private var argo

    /// The filament, at the column's share, wherever this rail happens to be drawn.
    private var length: CGFloat {
        ArgoFeedRow.workingThreadLength
    }

    var body: some View {
        GeometryReader { proxy in
            FeedIonLoop { phase, aged in
                // Two different readings of one word. RUNNING: the filament is at full strength and
                // the AGE dims the halo around it, which is what cools a long wait. PARKED: the
                // whole ion drops to `workingThreadStillGlow`, because with no travel to read it by
                // a filament at full strength is a rule somebody drew rather than work in flight.
                // The still does not vary by age — a parked bar is no reading of how long it ran.
                capsule(glow: phase == nil ? 0 : aged.glow)
                    // On the plinth's own edge, whatever room the bloom was given above it.
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .offset(x: phase.map(travelled) ?? (proxy.size.width - length) / 2)
                    .opacity(phase == nil ? ArgoFeedRow.workingThreadStillGlow : 1)
            }
        }
        .clipped()
    }

    /// Where along the rail the pass sits, in the filament's OWN lengths — both ends clear of the
    /// lane, so the ion enters and leaves rather than appearing mid-air.
    private func travelled(to phase: Double) -> CGFloat {
        let travel = ArgoFeedRow.workingThreadTravel
        return (travel.lowerBound + (travel.upperBound - travel.lowerBound) * phase) * length
    }

    /// The filament and its glow as ONE piece, so both take the same transform: the glow is a
    /// second copy blurred once rather than a filter over a moving element.
    private func capsule(glow: Double) -> some View {
        filament
            .background {
                filament
                    .blur(radius: ArgoElevation.bloom.blur)
                    .opacity(glow)
            }
    }

    private var filament: some View {
        Capsule()
            .fill(argo.color.ion.pass)
            .frame(width: length, height: ArgoStroke.indicator)
    }
}

// The state a still cannot prove, here to be WATCHED: the ion has to cross the plinth's whole inner
// width and fade out past both edges, at the same speed the feed's own thread reads at.
#Preview("Wait plinth — a start in flight") {
    FeedWaitPlinth(words: .starting)
        .frame(width: ArgoFeedRow.column)
        .argoDeckSurface()
        .argoAppearance()
}

// The whole of Reduce Motion: the ion parked at the centre of its rail, and the words, the mark and
// the elapsed reading all kept — the reading is what carries the state with movement off.
#Preview("Wait plinth — with movement off") {
    FeedWaitPlinth(words: .starting)
        .environment(\.argoStillsMotion, true)
        .environment(\.argoAgesWait, 401)
        .frame(width: ArgoFeedRow.column)
        .argoDeckSurface()
        .argoAppearance()
}
