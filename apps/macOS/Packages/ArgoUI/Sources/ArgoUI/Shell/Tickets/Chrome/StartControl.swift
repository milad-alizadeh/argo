import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The open ticket's verbs, at the leading edge of the ticket pane's own header — **ONE pill with
/// two segments** (`cockpit-work-room.md`, #1242).
///
/// **The pill is the control; the word and the command are its halves.** Pressing `Start` starts
/// the resolved command; pressing the command opens the picker, because the thing you read should
/// be the thing you press to change. There is no rule between them: a rule parts two acts that
/// happen to share a vessel, and these are one act said in two halves — `vesselGap` is the whole
/// seam a segmented control needs.
///
/// **Neither segment draws a ground of its own.** The capsule IS the ground, and a fill inside it
/// would be an edge within an edge — the thing `ArgoElevation.vessel` already refuses on the
/// outside. Each answers the pointer on `surface.control` instead.
///
/// **`Start` starts — there is still no rung to choose** (#872). The picker below chooses the
/// COMMAND, which is a different fact: it has more than one honest answer, the default is a guess
/// off a label rather than a value the reader set, and nothing downstream can change it once the
/// Session has opened. A Mode has one honest answer here and a control over a live Session that
/// owns it, which is why that chevron stays deleted.
///
/// The two link verbs it used to carry are gone with the row: the ticket's number is the link
/// (`TicketHead`).
package struct StartControl: View {
    let verbs: TicketsChromeIntents.Verbs

    package var body: some View {
        ArgoIconButtonGroup {
            start
            StartSkillMenu(command: verbs.command, pick: verbs.startOn)
        }
    }

    /// The one control in this room that spends a word. It is the verb the room exists for, and a
    /// glyph on its own would be the unlabelled mark the study cut.
    ///
    /// Not an `ArgoIconButton`: it draws a WORD, so it takes the box's height and whatever width
    /// the verb needs — the one thing on this band that is not square.
    private var start: some View {
        Button(action: verbs.start) {
            StartVerb(command: verbs.command, says: .word)
                .argoSegmentFace()
        }
        .buttonStyle(.plain)
        .help(StartVerb.spoken(verbs.command))
        .accessibilityLabel(StartVerb.spoken(verbs.command))
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(verbs: TicketsChromeIntents.Verbs) {
        self.verbs = verbs
    }
}

extension View {
    /// One segment of a pill: the box's height, its own horizontal room, and the pointer answered
    /// on the neutral control ground rather than in a fill of its own.
    ///
    /// Here rather than in the contract: it is the shape of THIS pill's halves, and a second
    /// surface wanting it is the point at which it earns a home in `ArgoAtoms`.
    func argoSegmentFace() -> some View {
        modifier(ArgoPillSegment())
    }
}

private struct ArgoPillSegment: ViewModifier {
    @Environment(\.argo) private var argo
    @State private var isPointedAt = false

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, ArgoSpacing.base)
            .frame(height: ArgoControlBox.icon)
            // `.color` on the token and `Color.clear` beside it: the ternary's two arms have
            // to be one type, and `ArgoColor` has no clear — a transparent ROLE would be a
            // token for the absence of one.
            .background(isPointedAt ? argo.color.surface.control.color : Color.clear, in: .capsule)
            .contentShape(.capsule)
            .onHover { isPointedAt = $0 }
    }
}

#Preview("Start control — one pill, two segments") {
    StartControl(verbs: TicketsChromeIntents.Verbs(command: .implement))
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Start control — a ticket that asks for no command") {
    StartControl(verbs: TicketsChromeIntents.Verbs())
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
