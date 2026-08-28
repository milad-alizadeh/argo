import SwiftUI

/// Every way of ordering the list that is not the filter beside it — an **ellipsis menu**, which is
/// where Mail keeps sort and group next to its own funnel (#836).
///
/// It replaces a button with a banded-rows glyph. That mark was invented for an act the platform
/// already has a home for, and a mark a reader has to learn costs more than the row it saves. An
/// ellipsis is not the unlabelled overflow the design rules out either: it is a named control with
/// named rows behind it, where the overflow the study cut was the system's own last resort holding
/// controls nobody could see.
struct BacklogMenu: View {
    @Environment(\.argo) private var argo

    var grouping: () -> Void = {}

    var body: some View {
        Menu {
            // One grouping today, so the menu states the one in force rather than offering a choice
            // nothing can answer yet: `TicketsChromeProjection.grouping` is a constant until a port
            // reads something else to group by (#388).
            Button("Group by priority", action: grouping)
        } label: {
            // `argoIcon` and not `ArgoGlyph`: a rung constrains a mark's HEIGHT, and an ellipsis is
            // three dots whose ink is a fraction of its box — matched by height it drew three discs
            // the size of the funnel beside it. Sized by font, it takes the proportions the system
            // draws it at, which is what every other ellipsis on the platform is.
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
