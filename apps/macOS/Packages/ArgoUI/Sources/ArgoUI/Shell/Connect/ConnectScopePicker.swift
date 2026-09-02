import ArgoDesign
import ArgoEngine
import SwiftUI

/// The scope a port will read through, chosen from what the Account can actually see.
///
/// A menu and not a text field: Argo holds the identity, so a field to spell `owner/repository`
/// into asks the user to guess at what the provider was about to say. A failed read offers the read
/// again and never a field (#821).
struct ConnectScopePicker: View {
    @Environment(\.argo) private var argo
    /// Which scope is chosen, before it is bound. Genuinely the view's: nothing outside this row
    /// can observe a choice nobody has pressed Connect on.
    @State private var chosen: String?

    let picker: ConnectPanelProjection.Picker
    let actions: ConnectScopePickerActions

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            state
        }
        .padding(.horizontal, ArgoSpacing.comfortable)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var state: some View {
        switch picker.state {
        case .loading:
            ProgressView()
                .controlSize(.small)
            caption("Reading what this account can see…")
            cancel
        case let .listed(scopes, truncated):
            listed(scopes, truncated: truncated)
        case let .unreadable(why):
            caption(why)
            cancel
            Button("Try again", action: actions.retry)
                .buttonStyle(.quiet)
        case .unauthorized:
            caption(
                "This account's authorization was refused, so Argo cannot read what it can see.",
            )
            cancel
            // Never `Try again`: a retry reuses the token that was just refused.
            Button("Connect again", action: actions.reconnect)
                .buttonStyle(.quiet)
        }
    }

    @ViewBuilder private func listed(_ scopes: [String], truncated: Bool) -> some View {
        if scopes.isEmpty {
            caption("This account can see nothing Argo can read through this connection.")
            cancel
        } else {
            // The noun labels the CONTROL, so it appears only where there is one. Beside a failure
            // it reads as part of the sentence — "Repository GitHub could not be reached".
            Text(picker.scopeNoun)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.secondary)
            menu(scopes)
            // No count: the ceiling is on what was FETCHED, and this list is what survived the
            // port's own filter, so any number here would name the wrong thing.
            if truncated {
                caption("Not every \(picker.scopeNoun.lowercased()) is listed.")
            }
            cancel
            Button("Connect") { chosen.map(actions.bind) }
                .buttonStyle(.quiet)
                .disabled(chosen == nil)
        }
    }

    /// Selection is `String?`, so "nothing chosen" is absence rather than an empty string standing
    /// in for it — and the truncation notice stays out of the menu, where a second row carrying the
    /// same tag would collapse onto the placeholder.
    private func menu(_ scopes: [String]) -> some View {
        SwiftUI.Picker(picker.scopeNoun, selection: $chosen) {
            // Nothing is pre-selected: a repository the user never picked, one press from being
            // bound, is the guess this picker exists to stop.
            Text("Choose…").tag(String?.none)
            Divider()
            ForEach(scopes, id: \.self) { scope in
                Text(scope).tag(String?.some(scope))
            }
        }
        .labelsHidden()
        .argoText(ArgoTypography.machineCaption)
        .tint(argo.color.text.primary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityLabel("Choose a \(picker.scopeNoun.lowercased())")
        // A rebind starts from where the port already is, when that is still on offer.
        .onAppear { chosen = picker.current.flatMap { scopes.contains($0) ? $0 : nil } }
    }

    private var cancel: some View {
        Button("Cancel", action: actions.cancel)
            .buttonStyle(.quiet)
    }

    /// Takes the width the controls do not, which is what puts Cancel and its neighbour on the
    /// right edge without a `Spacer` in every branch.
    private func caption(_ text: String) -> some View {
        Text(text)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.text.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
