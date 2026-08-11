import AppKit
import SwiftUI

/// The device flow while it waits: the code to type, where to type it, and a way to stop.
///
/// `GitHubDeviceFlow` hands the challenge back before it starts polling, which is what this card
/// draws.
struct DeviceCodeCard: View {
    @Environment(\.argo) private var argo
    /// Whether the code has just been put on the pasteboard. Local, and never a fact about the
    /// flow: copying is not a step of the grant.
    @State private var hasCopied = false

    let challenge: ConnectChallenge
    let stopWaiting: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            Text(DeviceCodeCopy.heading(for: challenge.provider))
                .argoText(ArgoTypography.rowTitle)
                .foregroundStyle(argo.color.text.primary)
            code
            HStack(spacing: ArgoSpacing.base) {
                Link(destination: challenge.verificationURL) {
                    Text(challenge.verificationURL.absoluteString)
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
        .accessibilityLabel(spoken)
    }

    /// The code in the provider's own formatting, never re-spaced: what is shown has to match what
    /// is typed.
    private var code: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            Text(challenge.userCode)
                .argoText(ArgoTypography.machineDisplay)
                .foregroundStyle(argo.color.text.primary)
                .textSelection(.enabled)
                .frame(width: ArgoLayout.deviceCodeWidth, alignment: .leading)
            Button(hasCopied ? DeviceCodeCopy.copied : DeviceCodeCopy.copy, action: copy)
                .buttonStyle(.quiet)
        }
    }

    private func copy() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(challenge.userCode, forType: .string)
        hasCopied = true
    }

    /// Spoken as one instruction, because the code is useless without the address and the address
    /// is useless without the code.
    private var spoken: String {
        """
        Type the code \(challenge.userCode) at \
        \(challenge.verificationURL.absoluteString). Argo is waiting.
        """
    }
}

#Preview("Device code — waiting on the browser") {
    Form {
        Section {
            DeviceCodeCard(challenge: ConnectFixture.challenge, stopWaiting: {})
        }
    }
    .formStyle(.grouped)
    .frame(width: ArgoLayout.connectPanelWidth)
    .argoAppearance()
}
