import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// One port: the Account it reads through, the ones it could read through instead, and the way to
/// add another identity when neither answer is right.
///
/// Picking an existing Account is one gesture and no OAuth round-trip (#414), and authorizing is
/// the second item on the same menu rather than a different screen.
package struct ConnectPortRow: View {
    @Environment(\.argo) private var argo

    let row: ConnectPanelProjection.PortRow
    let actions: ConnectPanelActions

    package var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            ConnectRow(row: row.row) { menu }
            if let note = row.note {
                ConnectNoteView(note: note)
            }
            if let picker = row.picker {
                ConnectScopePicker(picker: picker, actions: pickerActions(picker))
                    // Identity by Account: switching the picker to another one must start its
                    // choice from that Account's own scopes, not keep the last one's.
                    .id(picker.accountID)
            }
        }
    }

    private var menu: some View {
        HStack(spacing: ArgoSpacing.snug) {
            chooser
            // BESIDE the menu, never inside it: a `Menu` re-synthesises its label from icon and
            // title alone, so a chevron placed within one never draws at all (#875).
            ArgoDisclosure(.below)
        }
    }

    private var chooser: some View {
        Menu {
            // The Account already on the row is in this list: rebinding it at another scope is a
            // move the row has to allow.
            ForEach(row.choices) { choice in
                Button(choice.title) { actions.chooseAccount(row.id, choice.id) }
            }
            if !row.choices.isEmpty {
                Divider()
            }
            ForEach(row.offers) { offer in
                Button(offer.title) { actions.connectAccount(offer.id, row.id) }
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
        // `ProjectVessel` sets it there. Neutral, so the panel's one accent control stays its
        // call to action.
        .tint(argo.color.text.primary)
        .menuStyle(.borderlessButton)
        // The system's own indicator is drawn at its size, not the contract's chevron rung.
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel("Choose what \(row.row.title.lowercased()) reads through")
    }

    /// The panel's actions, narrowed to this port and the Account the picker is open on. Retrying
    /// IS choosing the same Account again — one path asks the provider, so a failed listing and a
    /// first one cannot answer differently.
    private func pickerActions(
        _ picker: ConnectPanelProjection.Picker,
    )
        -> ConnectScopePickerActions {
        ConnectScopePickerActions(
            bind: { scope in
                actions.bindPort(ProjectBinding(
                    port: row.id,
                    accountID: picker.accountID,
                    scope: scope,
                ))
            },
            retry: { actions.chooseAccount(row.id, picker.accountID) },
            reconnect: { actions.connectAccount(picker.provider, row.id) },
            cancel: actions.cancelChoice,
        )
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(row: ConnectPanelProjection.PortRow, actions: ConnectPanelActions) {
        self.row = row
        self.actions = actions
    }
}

// An identity held and no Binding yet: the row has to say the account is there, or the device-code
// card simply vanished and nothing happened (#821).

// The listing GitHub would not answer. The judgement is that it offers the read again and never a
// field to guess into.

// A Binding whose Account was removed: the row says what came undone and keeps the scope it was on.
