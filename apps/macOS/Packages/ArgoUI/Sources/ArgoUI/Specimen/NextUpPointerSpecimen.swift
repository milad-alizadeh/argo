import SwiftUI

/// The hero's three grounds side by side (#898): at rest with its chevron, under the pointer, and
/// pressed. Hover and press are live input, so `nextUpStillsPointer` is what puts them on a
/// screenshot at all.
struct NextUpPointerSpecimen: View {
    /// The room's own pick, so the gallery is the card readers actually meet.
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
