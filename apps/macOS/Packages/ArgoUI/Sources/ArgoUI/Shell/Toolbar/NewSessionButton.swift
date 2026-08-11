import SwiftUI

/// The affordance for STARTING a Session: one icon at the leading edge of the bar, in a glass
/// container of its own, next to the system sidebar toggle.
///
/// The glass is spelled HERE and not left to the toolbar, which is the opposite of what the two
/// vessels do — and for their own reason. A vessel takes the toolbar's glass so its halves MERGE
/// into one capsule; this control must not merge with anything, so its item hides the shared
/// background and carries its own. Between them: one capsule per reading, and a verb is its own
/// reading, not a fourth fact inside "this Project, on this checkout".
struct NewSessionButton: View {
    /// How far the mark moves right and up to sit centred in its container. One number for both
    /// axes because the symbol's own imbalance is diagonal.
    ///
    /// Measured off a 2x render rather than chosen: uncorrected, the square sat 1.28pt left and
    /// 1.31pt below the container's centre; corrected, it is within 0.22pt and 0.31pt, which is
    /// less than one device pixel. Not worth tuning further — at 2x this lands on whole pixels
    /// either way, so a smaller number rounds to nothing and a larger one overshoots.
    private static let opticalCentring: CGFloat = 1.25

    @Environment(\.argo) private var argo

    let offer: NewSessionOffer
    let spawn: () async -> Void
    /// Whether a spawn is in flight. A parameter with a `@State` default rather than state alone,
    /// so a render harness can put the waiting state on screen — the wait is a second or two on the
    /// first spawn of a window and unreachable by hand, which is the definition of a state nobody
    /// ever looks at unless it is addressable.
    @State var isStarting = false

    var body: some View {
        Button(action: start) {
            mark
                // A SQUARE of the bar's own container height, and not `toolbarSegment()`: that
                // modifier measures a segment INSIDE a vessel, so it sized this container to one
                // glyph plus padding — shorter than every other container on the bar, and with
                // the mark sitting off its centre. A square frame is what centres a lone mark,
                // and at this height its circle is the shape the platform gives a lone verb.
                //
                // On the CONTAINER and not on either mark, so the swap below cannot move the bar.
                .frame(
                    width: ArgoLayout.toolbarVesselHeight,
                    height: ArgoLayout.toolbarVesselHeight,
                )
                .contentShape(.circle)
                .glassEffect(in: .circle)
        }
        .buttonStyle(.plain)
        // Refused while one is in flight for the same reason it is refused with no Project: a
        // second press would start a second agent, and the first one has not answered yet.
        .disabled(!offer.isLaunchable || isStarting)
        .help(helpText)
        .accessibilityLabel(isStarting ? Self.starting : NewSessionOffer.label)
        // The hint moves with the label. Left on `detail` it would offer to start a Session under
        // a label saying one is already starting — two claims about the same press.
        .accessibilityHint(isStarting ? Self.waiting : offer.blocked ?? NewSessionOffer.detail)
        .argoAnimation(.stateChange, value: isStarting)
    }

    /// The wait, said in one word wherever it is said.
    private static let starting = "Starting a Session…"
    /// What is being waited ON, for the reader who cannot see the spinner.
    private static let waiting = "Waiting for the agent to start"

    /// The verb, or the wait in its place.
    ///
    /// A spinner, which is the one looping thing in this app: `ArgoMotion`'s rule against ambient
    /// animation is about a cockpit sitting open all day, and this runs for as long as a login
    /// shell takes to report a `PATH` — not one frame longer. The alternative was a dimmed glyph,
    /// and a dimmed glyph is what this button already looks like when it is refusing to act.
    @ViewBuilder private var mark: some View {
        if isStarting {
            ProgressView()
                .controlSize(.small)
        } else {
            ArgoGlyph(ArgoSymbol.newSession, .control)
                .foregroundStyle(ink)
                // `square.and.pencil` draws its square in the LOWER-LEFT of its own glyph box and
                // spends the top-right on the pencil, so a box centred in the container leaves the
                // body of the mark 1.3pt down and left of centre — measured off the render, not
                // guessed. The correction centres the SQUARE, which is what the eye tracks; it
                // belongs to this symbol and moves with it.
                .offset(x: Self.opticalCentring, y: -Self.opticalCentring)
        }
    }

    private var helpText: String {
        if isStarting {
            return Self.starting
        }
        return offer.blocked ?? "\(NewSessionOffer.label) — \(NewSessionOffer.shortcutDescription)"
    }

    /// The flag is raised before the await and lowered after it, whichever way the spawn went: a
    /// refusal reports itself in an alert the app puts up, and a button still spinning behind that
    /// alert would be claiming the agent is on its way.
    private func start() {
        isStarting = true
        Task {
            await spawn()
            isStarting = false
        }
    }

    /// A disabled plain button dims nothing of a label it did not draw, so the state is spelled in
    /// the ink as well as in the sentence on it.
    private var ink: ArgoColor {
        offer.isLaunchable ? argo.color.text.primary : argo.color.text.tertiary
    }
}

#Preview("New Session button") {
    NewSessionButton(offer: NewSessionOffer(presentation: .preview), spawn: {})
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("New Session button — nothing registered") {
    NewSessionButton(offer: NewSessionOffer(presentation: .unregisteredPreview), spawn: {})
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

// The first spawn of a window shells out to a login shell to find the user's `PATH` before it can
// start anything, and until this state existed that whole wait looked exactly like a press that
// did nothing (#361's argument, one layer earlier).
#Preview("New Session button — a spawn in flight") {
    NewSessionButton(
        offer: NewSessionOffer(presentation: .preview),
        spawn: {},
        isStarting: true,
    )
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
