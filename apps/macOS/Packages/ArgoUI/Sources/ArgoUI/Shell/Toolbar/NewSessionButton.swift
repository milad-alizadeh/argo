import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The affordance for STARTING a Session: one icon at the leading edge of the bar, in a glass
/// container of its own, next to the system sidebar toggle.
///
/// The glass is spelled HERE and not left to the toolbar: this control must not merge with a
/// neighbour, so its item hides the shared background and carries its own.
package struct NewSessionButton: View {
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
    /// A parameter with a `@State` default rather than state alone, so a render harness can put the
    /// waiting state on screen — by hand it lasts a second or two on a window's first spawn only.
    @State var isStarting = false

    package var body: some View {
        // `ArgoControlBox.vessel` and not a box of its own: this control carries its OWN container
        // on a band whose other containers are the same arithmetic, so it stands exactly as tall as
        // the capsule of icon buttons beside it (#1243). The box is on the CONTAINER and not on
        // either mark, so the swap below cannot move the bar.
        ArgoIconButton(
            voice: ArgoControlVoice(
                isStarting ? Self.starting : NewSessionOffer.label, help: helpText,
            ),
            // The LIVE ink only: the atom spells the disabled state in `text.disabled` for every
            // icon button at once, and a plain button dims nothing of a label it did not draw.
            face: ArgoControlFace(
                box: ArgoControlBox.vessel,
                ink: argo.color.text.primary,
                ground: .glass,
            ),
            act: start,
            mark: { mark },
        )
        // Refused while one is in flight for the same reason it is refused with no Project: a
        // second press would start a second agent, and the first one has not answered yet.
        .disabled(!offer.isLaunchable || isStarting)
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
    /// A spinner, the one looping thing in this app: `ArgoMotion`'s rule against ambient animation
    /// is about a cockpit sitting open all day, and this runs only as long as a login shell takes
    /// to report a `PATH`.
    @ViewBuilder private var mark: some View {
        if isStarting {
            ProgressView()
                .controlSize(.small)
        } else {
            ArgoGlyph(ArgoSymbol.newSession, .control)
                // `square.and.pencil` draws its square in the LOWER-LEFT of its own glyph box and
                // spends the top-right on the pencil, so a box centred in the container leaves the
                // body of the mark 1.3pt down and left of centre. The correction centres the
                // SQUARE, and belongs to this symbol.
                .offset(x: Self.opticalCentring, y: -Self.opticalCentring)
        }
    }

    private var helpText: String {
        if isStarting {
            return Self.starting
        }
        return offer.blocked ?? "\(NewSessionOffer.label) — \(NewSessionOffer.shortcutDescription)"
    }

    /// Lowered after the await whichever way the spawn went: a refusal reports itself in an alert,
    /// and a button still spinning behind it would be claiming the agent is on its way.
    private func start() {
        isStarting = true
        Task {
            await spawn()
            isStarting = false
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        offer: NewSessionOffer,
        spawn: @escaping () async -> Void,
        isStarting: Bool = false,
    ) {
        self.offer = offer
        self.spawn = spawn
        _isStarting = State(wrappedValue: isStarting)
    }
}

// The first spawn of a window shells out to a login shell for the user's `PATH` before it can start
// anything, and that whole wait otherwise looks exactly like a press that did nothing (#361).
