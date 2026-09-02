import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// The hero's three grounds side by side (#898): at rest with its chevron, under the pointer, and
/// pressed. Hover and press are live input, so `nextUpStillsPointer` is what puts them on a
/// screenshot at all.
///
/// Since #899 each card also carries its Start, which has to be legible as a separate target in
/// every one of the three grounds. Cards four and five hold the card still and move the STARTER's
/// pointer instead, which is what shows the two answer separately. The last is the ticket that asks
/// for NO command — no fixture reaches that state on its own, and a state with no render is a state
/// nobody has looked at.
struct NextUpPointerSpecimen: View {
    /// The room's own pick, so the gallery is the card readers actually meet.
    private static let nextUp = TicketsFixture.room.nextUp ?? .backlogClear

    /// A pick whose ticket resolves to a command, which is what Start says before it is pressed.
    private static let asking = NextUpIntents(
        starting: StartIntent(command: { _ in .implement }),
    )

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            ForEach(NextUpCardStyle.Pointer.allCases, id: \.self) { pointer in
                NextUpCard(nextUp: Self.nextUp, intents: Self.asking)
                    .environment(\.nextUpStillsPointer, pointer)
            }
            // The card at rest under a starter answering the pointer on its OWN account. Two
            // controls, two pointer states, one card — which is the only evidence a still render
            // can give that the starter is a target of its own and not part of the card.
            ForEach([NextUpCardStyle.Pointer.over, .down], id: \.self) { pointer in
                NextUpCard(nextUp: Self.nextUp, intents: Self.asking)
                    .environment(\.nextUpStillsStarter, pointer)
            }
            NextUpCard(nextUp: Self.nextUp)
        }
        .frame(width: ArgoLayout.sidebarMinimumWidth)
    }
}

#Preview("Next-up hero — at rest, under the pointer, pressed, and asking nothing") {
    NextUpPointerSpecimen()
        .argoAppearance()
}
