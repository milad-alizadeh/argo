import ArgoEngine
import SwiftUI

/// The scope a port will read through, chosen from what the Account can actually see.
///
/// A menu and not a text field: Argo already holds the identity, so asking the user to spell
/// `owner/repository` is asking them to guess at something the provider was about to say. When the
/// provider cannot be read the picker says so and offers the read again — it does **not** fall back
/// to typing, because a scope typed past a failed listing is a guess with a button on it (#821).
struct ConnectScopePicker: View {
    @Environment(\.argo) private var argo
    /// Which scope is chosen, before it is bound. The one piece of state that is genuinely the
    /// view's: nothing outside this row can observe a choice nobody has pressed Connect on.
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
            Spacer(minLength: ArgoSpacing.flush)
            Button("Cancel", action: actions.cancel)
                .buttonStyle(.quiet)
        case let .listed(scopes, truncated):
            listed(scopes, truncated: truncated)
        case let .unreadable(why):
            caption(why)
            Spacer(minLength: ArgoSpacing.flush)
            Button("Cancel", action: actions.cancel)
                .buttonStyle(.quiet)
            Button("Try again", action: actions.retry)
                .buttonStyle(.quiet)
        }
    }

    @ViewBuilder private func listed(_ scopes: [String], truncated: Bool) -> some View {
        if scopes.isEmpty {
            caption("This account can see nothing Argo can read through this connection.")
            Spacer(minLength: ArgoSpacing.flush)
            Button("Cancel", action: actions.cancel)
                .buttonStyle(.quiet)
        } else {
            let choice = chosenBinding(scopes)
            // The noun labels the CONTROL, so it appears only where there is one. Beside a failure
            // it reads as part of the sentence — "Repository GitHub could not be reached".
            Text(picker.scopeNoun)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.secondary)
            menu(scopes, truncated: truncated, choice: choice)
            Button("Cancel", action: actions.cancel)
                .buttonStyle(.quiet)
            // The truncation line carries the empty tag, so Connect stays dead on it.
            Button("Connect") { actions.bind(choice.wrappedValue) }
                .buttonStyle(.quiet)
                .disabled(choice.wrappedValue.isEmpty)
        }
    }

    /// The list, with the truncation stated on it. A capped listing drawn as a whole one is a
    /// repository the user cannot find and no reason given.
    private func menu(
        _ scopes: [String],
        truncated: Bool,
        choice: Binding<String>,
    )
        -> some View {
        SwiftUI.Picker(picker.scopeNoun, selection: choice) {
            // The resting state carries the empty tag, and Connect is dead on it. Nothing is
            // pre-selected: a repository the user never picked, one press from being bound, is
            // the guess this picker exists to stop.
            Text("Choose…").tag("")
            Divider()
            ForEach(scopes, id: \.self) { scope in
                Text(scope).tag(scope)
            }
            if truncated {
                Divider()
                Text("Only the first \(scopes.count) are listed").tag("")
            }
        }
        .labelsHidden()
        .argoText(ArgoTypography.machineCaption)
        .tint(argo.color.text.primary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityLabel("Choose a \(picker.scopeNoun.lowercased())")
    }

    private func caption(_ text: String) -> some View {
        Text(text)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.text.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// Opens on what the port already reads through, when that is still on offer — a rebind starts
    /// from where it is, not from nothing.
    private func chosenBinding(_ scopes: [String]) -> Binding<String> {
        Binding(
            get: { chosen ?? picker.current.flatMap { scopes.contains($0) ? $0 : nil } ?? "" },
            set: { chosen = $0 },
        )
    }
}
