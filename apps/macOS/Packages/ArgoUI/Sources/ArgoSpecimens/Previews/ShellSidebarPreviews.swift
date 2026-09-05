import ArgoUI
import SwiftUI

#Preview("Continuous sidebar") {
    @Previewable @State var selection = RowSelection(
        one: CockpitPresentation.preview.sessions.first?.id,
    )
    @Previewable @State var room = CockpitRoom.sessions

    ShellSidebar(presentation: .preview, held: .init(selection: $selection), room: $room)
        .frame(width: 340, height: 600)
        .argoAppearance()
}

#Preview("Continuous sidebar — no Sessions") {
    @Previewable @State var room = CockpitRoom.sessions

    ShellSidebar(
        presentation: .emptyPreview,
        held: .init(selection: .constant(RowSelection())),
        room: $room,
    )
    .frame(width: 340, height: 600)
    .argoAppearance()
}
