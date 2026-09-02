import ArgoUI
import SwiftUI

#Preview("Continuous sidebar") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id
    @Previewable @State var room = CockpitRoom.sessions

    ShellSidebar(presentation: .preview, selection: $selection, room: $room)
        .frame(width: 340, height: 600)
        .argoAppearance()
}

#Preview("Continuous sidebar — no Sessions") {
    @Previewable @State var room = CockpitRoom.sessions

    ShellSidebar(presentation: .emptyPreview, selection: .constant(nil), room: $room)
        .frame(width: 340, height: 600)
        .argoAppearance()
}
