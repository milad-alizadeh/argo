import SwiftUI

/// Every way of ordering the list — an **ellipsis menu**, which is where Mail keeps sort and group
/// (#836).
///
/// It replaces a button with a banded-rows glyph. That mark was invented for an act the platform
/// already has a home for, and a mark a reader has to learn costs more than the row it saves. An
/// ellipsis is not the unlabelled overflow the design rules out either: it is a named control with
/// named rows behind it, where the overflow the study cut was the system's own last resort holding
/// controls nobody could see.
struct BacklogMenu: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Menu {
            // A ROW and not a `Button`: with one grouping there is no choice to offer, and a button
            // that highlights, accepts the press and does nothing is the fault #900 deleted the
            // funnel over. It becomes buttons when a port reads a second thing to group by (#388).
            Text("Group by priority")
        } label: {
            // `argoIcon` and not `ArgoGlyph`: a rung constrains a mark's HEIGHT, and an ellipsis is
            // three dots whose ink is a fraction of its box — matched by height it drew three discs
            // as tall as a full glyph. Sized by font, it takes the proportions the system draws it
            // at, which is what every other ellipsis on the platform is.
            Image(systemName: ArgoSymbol.backlogMenu)
                .argoIcon(ArgoTicketsChrome.iconSize)
                .foregroundStyle(argo.color.text.tertiary)
                .frame(
                    width: ArgoTicketsChrome.iconButtonWidth,
                    height: ArgoTicketsChrome.iconButtonHeight,
                )
                .contentShape(.capsule)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .help("How the backlog is ordered")
        .accessibilityLabel("How the backlog is ordered")
    }
}

#Preview("Backlog menu") {
    ToolbarVessel {
        BacklogMenu()
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
