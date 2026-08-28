import SwiftUI

/// `Present as: Tree | Map` — the control that switches one parent between the node tree and the
/// Route (`cockpit-work-room.md`, frozen name; #334).
///
/// Map-scoped: it sits on the ticket, so a reader who maps one parent leaves the rail and every
/// other ticket as they were.
struct RoomPresentation: View {
    @Binding var presentation: WorkPresentation
    /// Whether `Map` has a Route behind it. The segment stays visible when it does not — the
    /// control is the parent's, not the canvas's — and refuses the switch rather than drawing an
    /// empty axis.
    var hasRoute = true

    var body: some View {
        Picker("Present as", selection: $presentation) {
            ForEach(WorkPresentation.allCases) { choice in
                Text(choice.name)
                    .argoText(ArgoTypography.control)
                    .tag(choice)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .fixedSize()
        .disabled(!hasRoute)
        .help(helpText)
    }

    private var helpText: String {
        guard hasRoute else {
            return "Nothing has been read under this ticket yet, so it has no Route to present"
        }
        return "Present this ticket as a tree of its children, or as the Route across them"
    }
}

#Preview("Room presentation — both positions, and with no Route behind Map") {
    @Previewable @State var tree = WorkPresentation.tree
    @Previewable @State var map = WorkPresentation.map
    @Previewable @State var unreadable = WorkPresentation.tree

    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        RoomPresentation(presentation: $tree)
        RoomPresentation(presentation: $map)
        RoomPresentation(presentation: $unreadable, hasRoute: false)
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
