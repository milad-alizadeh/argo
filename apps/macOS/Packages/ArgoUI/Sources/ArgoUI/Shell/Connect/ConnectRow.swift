import SwiftUI

/// One labelled line of the Connect panel: what it is, what it currently says, and the control
/// that changes it.
///
/// The three rows are independent and completable in any order (#265), so they are drawn as peers
/// rather than as steps: no numbering, no chevrons, nothing that says one waits on another. The
/// only thing separating them is the ground each one stands on.
struct ConnectRow<Trailing: View>: View {
    @Environment(\.argo) private var argo

    let row: ConnectPanelProjection.Row
    /// A path, a scope and an identity are machine facts and read as them; a sentence about what
    /// a row buys you is prose. One row type either way, because they differ in nothing else.
    let isDetailMachine: Bool
    @ViewBuilder let trailing: Trailing

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.comfortable) {
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                Text(row.title)
                    .argoText(ArgoTypography.rowTitle)
                    .foregroundStyle(argo.color.text.primary)
                detail
            }
            Spacer(minLength: ArgoSpacing.base)
            trailing
        }
        .padding(ArgoSpacing.comfortable)
        .background {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .fill(argo.color.surface.raised)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(row.spoken)
    }

    private var detail: some View {
        Text(row.detail)
            .argoText(isDetailMachine ? ArgoTypography.machineCaption : ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.text.secondary)
            .lineLimit(2)
            .truncationMode(.middle)
            .fixedSize(horizontal: false, vertical: true)
    }
}

#Preview("Connect row — a fact and a verb") {
    ConnectRow(
        row: ConnectPanelProjection.row(title: "Folder", detail: "~/Developer/argo"),
        isDetailMachine: true,
    ) {
        Button("Change folder…") {}
    }
    .frame(width: ArgoLayout.connectPanelWidth)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

// The other half of the pair: a row explaining what it would buy you, with nothing set on it. The
// detail runs to a sentence, and the row still has to read as one row.
#Preview("Connect row — nothing set yet") {
    ConnectRow(
        row: ConnectPanelProjection.row(
            title: "Pull requests and CI",
            detail: "Connect an account to see pull requests, reviews and checks.",
        ),
        isDetailMachine: false,
    ) {
        Button("Connect…") {}
    }
    .frame(width: ArgoLayout.connectPanelWidth)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
