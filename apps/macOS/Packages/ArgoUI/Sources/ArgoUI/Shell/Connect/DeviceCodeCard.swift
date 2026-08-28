import AppKit
import SwiftUI

/// A grant while it waits: where to finish it, the code to type where there is one, and a way to
/// stop.
///
/// Both flows hand their challenge back before they start waiting, which is what this card draws.
/// GitHub's carries a code; Linear's is a redirect and carries none, so the code row is simply
/// absent rather than filled with something to look at.
struct DeviceCodeCard: View {
    @Environment(\.argo) private var argo
    /// Whether the code has just been put on the pasteboard. Local, and never a fact about the
    /// flow: copying is not a step of the grant.
    @State private var hasCopied = false

    let challenge: ConnectChallenge
    let stopWaiting: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            Text(DeviceCodeCopy.heading(for: challenge))
                .argoText(ArgoTypography.rowTitle)
                .foregroundStyle(argo.color.text.primary)
            if case let .typed(userCode) = challenge.kind {
                code(userCode)
            }
            HStack(spacing: ArgoSpacing.base) {
                Link(destination: challenge.verificationURL) {
                    Text(DeviceCodeCopy.address(of: challenge))
                        .argoText(ArgoTypography.machineCaption)
                }
                Spacer(minLength: ArgoSpacing.base)
                Button(DeviceCodeCopy.stop, action: stopWaiting)
                    .buttonStyle(.quiet)
            }
            Text(DeviceCodeCopy.waiting)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
        }
        // No ground of its own: it stands in a `Form` section, and the section IS the card.
        .accessibilityElement(children: .contain)
        .accessibilityLabel(DeviceCodeCopy.spoken(challenge))
    }

    /// The code in the provider's own formatting, never re-spaced: what is shown has to match what
    /// is typed.
    private func code(_ userCode: String) -> some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            Text(userCode)
                .argoText(ArgoTypography.machineDisplay)
                .foregroundStyle(argo.color.text.primary)
                .textSelection(.enabled)
                .frame(width: ArgoConnectPanel.deviceCodeWidth, alignment: .leading)
            Button(hasCopied ? DeviceCodeCopy.copied : DeviceCodeCopy.copy) {
                ArgoPasteboard.put(userCode)
                hasCopied = true
            }
            .buttonStyle(.quiet)
        }
    }
}

#Preview("Device code — waiting on the browser") {
    Form {
        Section {
            DeviceCodeCard(challenge: ConnectFixture.challenge, stopWaiting: {})
        }
    }
    .formStyle(.grouped)
    .frame(width: ArgoConnectPanel.width)
    .argoAppearance()
}

// Linear's grant is a redirect: the browser is already open on it, so there is no code to type and
// the card says where the tab is rather than what to put in it.
#Preview("Redirect — waiting on the browser") {
    Form {
        Section {
            DeviceCodeCard(challenge: ConnectFixture.redirect, stopWaiting: {})
        }
    }
    .formStyle(.grouped)
    .frame(width: ArgoConnectPanel.width)
    .argoAppearance()
}
