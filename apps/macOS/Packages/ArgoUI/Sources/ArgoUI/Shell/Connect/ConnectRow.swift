import SwiftUI

/// One labelled line of the Connect panel: what it is, what it currently says, and the control
/// that changes it.
///
/// `LabeledContent` inside a `Form`, not a box of its own: the platform already draws the ground,
/// the inset, the label column and the alignment with every other settings row
/// (`ui-components.md`, "don't hand-roll what the platform provides").
///
/// The three rows are independent and completable in any order (#265), so they are peers in one
/// section rather than steps: no numbering, no chevrons.
struct ConnectRow<Trailing: View>: View {
    @Environment(\.argo) private var argo

    let row: ConnectPanelProjection.Row
    @ViewBuilder let trailing: Trailing

    var body: some View {
        LabeledContent {
            trailing
        } label: {
            Text(row.title)
                .argoText(ArgoTypography.rowTitle)
                .foregroundStyle(argo.color.text.primary)
            detail
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(row.spoken)
    }

    private var detail: some View {
        Text(row.detail)
            .argoText(row.isDetailMachine ? ArgoTypography.machineCaption : ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.text.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}

#Preview("Connect row — a fact and a verb") {
    Form {
        ConnectRow(row: ConnectPanelProjection.row(
            title: "Folder",
            detail: "~/Developer/argo",
            isMachine: true,
        )) {
            Button("Change folder…") {}
                .buttonStyle(.quiet)
        }
    }
    .formStyle(.grouped)
    .frame(width: ArgoConnectPanel.width)
    .argoAppearance()
}

// Nothing set on the row: the detail runs to a sentence and must still read as one row.
#Preview("Connect row — nothing set yet") {
    Form {
        ConnectRow(row: ConnectPanelProjection.row(
            title: "Pull requests and CI",
            detail: "Connect an account to see pull requests, reviews and checks.",
        )) {
            Button("Connect…") {}
                .buttonStyle(.quiet)
        }
    }
    .formStyle(.grouped)
    .frame(width: ArgoConnectPanel.width)
    .argoAppearance()
}
