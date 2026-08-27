import ArgoEngine
import SwiftUI

/// One port: the Account it reads through, the ones it could read through instead, and the way to
/// add another identity when neither answer is right.
///
/// Picking an existing Account is one gesture and no OAuth round-trip (#414), and authorizing is
/// the second item on the same menu rather than a different screen.
struct ConnectPortRow: View {
    /// A choice being filled in. It holds the Account and the scope together because a Binding is
    /// both.
    private struct Draft: Equatable {
        let choice: ConnectPanelProjection.AccountChoice
        var scope: String
    }

    @Environment(\.argo) private var argo
    @State private var draft: Draft?

    let row: ConnectPanelProjection.PortRow
    let actions: ConnectPanelActions

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            ConnectRow(row: row.row) { menu }
            if let note = row.note {
                ConnectNoteView(note: note)
            }
            if let draft {
                editor(draft)
            }
        }
    }

    private var menu: some View {
        HStack(spacing: ArgoSpacing.snug) {
            chooser
            // BESIDE the menu, for the reason `GitVessel` gives: a menu re-synthesises its
            // label, so a chevron inside it never draws at all.
            ArgoDisclosure(.below)
        }
    }

    private var chooser: some View {
        Menu {
            // The Account already on the row is in this list: rebinding it at another scope is a
            // move the row has to allow.
            ForEach(row.choices) { choice in
                Button(choice.title) { open(choice) }
            }
            if !row.choices.isEmpty {
                Divider()
            }
            ForEach(row.offers) { offer in
                Button(offer.title) { actions.connectAccount(offer.id) }
            }
            if row.isBound {
                Divider()
                Button("Disconnect") { actions.unbindPort(row.id) }
            }
        } label: {
            Text(row.isBound ? "Change…" : "Connect…")
                .argoText(ArgoTypography.control)
        }
        // Through the TINT, which a `foregroundStyle` on the label cannot reach — the same reason
        // `ProjectRowMenu` sets it there. Neutral, so the panel's one accent control stays its
        // call to action.
        .tint(argo.color.text.primary)
        .menuStyle(.borderlessButton)
        // The system's own indicator is drawn at its size, not the contract's chevron rung.
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel("Choose what \(row.row.title.lowercased()) reads through")
    }

    /// The scope, asked for in the provider's own word. It opens on whatever the port already
    /// reads through.
    private func editor(_ draft: Draft) -> some View {
        HStack(spacing: ArgoSpacing.base) {
            Text(draft.choice.scopeNoun)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.secondary)
            TextField(draft.choice.scopeHint, text: scope)
                .argoText(ArgoTypography.machineCaption)
                .textFieldStyle(.roundedBorder)
                .onSubmit { bind(draft) }
            Button("Cancel") { self.draft = nil }
                .buttonStyle(.quiet)
            Button("Connect") { bind(draft) }
                .buttonStyle(.quiet)
                .disabled(draft.scope.isEmpty)
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
        .accessibilityElement(children: .contain)
    }

    private var scope: Binding<String> {
        Binding(
            get: { draft?.scope ?? "" },
            set: { draft?.scope = $0 },
        )
    }

    private func open(_ choice: ConnectPanelProjection.AccountChoice) {
        draft = Draft(choice: choice, scope: row.scope ?? "")
    }

    private func bind(_ draft: Draft) {
        guard !draft.scope.isEmpty else { return }
        actions.bindPort(ProjectBinding(
            port: row.id,
            accountID: draft.choice.id,
            scope: draft.scope,
        ))
        self.draft = nil
    }
}

#Preview("Port row — bound, and re-bindable") {
    ConnectPortRow(
        row: ConnectPanelProjection.panel(from: ConnectFixture.wired).ports[0],
        actions: .inert,
    )
    .frame(width: ArgoConnectPanel.width)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Port row — nothing connected") {
    ConnectPortRow(
        row: ConnectPanelProjection.panel(from: ConnectFixture.fresh).ports[1],
        actions: .inert,
    )
    .frame(width: ArgoConnectPanel.width)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

// A Binding whose Account was removed: the row says what came undone and keeps the scope it was on.
#Preview("Port row — the account it used is gone") {
    ConnectPortRow(
        row: ConnectPanelProjection.panel(from: ConnectFixture.broken).ports[0],
        actions: .inert,
    )
    .frame(width: ArgoConnectPanel.width)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
