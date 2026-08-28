import SwiftUI

/// `Present as: Tree | Map` — the control that switches one parent between the node tree and the
/// Route (`cockpit-work-room.md`, frozen name; #334).
///
/// It sits on the TICKET rather than in the room's rail, which is the whole of what "map-scoped"
/// buys: a reader who maps one parent leaves every other ticket, and the rail itself, exactly as
/// they were.
struct RoomPresentation: View {
    @Binding var presentation: WorkPresentation

    var body: some View {
        Picker("Present as", selection: $presentation) {
            ForEach(WorkPresentation.allCases) { choice in
                Text(choice.name).tag(choice)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .fixedSize()
        .help("Present this ticket as a tree of its children, or as the Route across them")
    }
}

#Preview("Room presentation — both positions") {
    @Previewable @State var tree = WorkPresentation.tree
    @Previewable @State var map = WorkPresentation.map

    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        RoomPresentation(presentation: $tree)
        RoomPresentation(presentation: $map)
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
