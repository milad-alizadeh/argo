import SwiftUI

/// The hero's three grounds side by side (#898): at rest with its chevron, under the pointer, and
/// pressed. One gallery rather than three cases — the pointer is a discrete union, and this is the
/// only way any of it reaches a screenshot (`nextUpStillsPointer`).
struct NextUpPointerSpecimen: View {
    /// The room's own pick, so the gallery is the card readers actually meet. The fallback is
    /// unreachable over this fixture and draws a tier, which is the state it would deserve.
    private static let nextUp = TicketsFixture.room.nextUp ?? .backlogClear

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            ForEach(NextUpCardStyle.Pointer.allCases, id: \.self) { pointer in
                NextUpCard(nextUp: Self.nextUp)
                    .environment(\.nextUpStillsPointer, pointer)
            }
        }
        .frame(width: ArgoLayout.sidebarMinimumWidth)
    }
}

#Preview("Next-up hero — at rest, under the pointer, pressed") {
    NextUpPointerSpecimen()
        .argoAppearance()
}
