import AppKit
import SwiftUI

/// The device flow while it waits: the code to type, where to type it, and a way to stop.
///
/// The panel waits rather than spinning. A device flow the user cannot read is one they cannot
/// finish, which is why `GitHubDeviceFlow` hands the challenge back before it starts polling and
/// why this card exists at all.
struct DeviceCodeCard: View {
    @Environment(\.argo) private var argo
    /// Whether the code has just been put on the pasteboard. Local, and it never becomes a fact
    /// about the flow: copying is something the user did to their clipboard, not a step of the
    /// grant.
    @State private var hasCopied = false

    let challenge: ConnectChallenge
    let stopWaiting: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            Text("Type this code at \(challenge.provider.readableName)")
                .argoText(ArgoTypography.rowTitle)
                .foregroundStyle(argo.color.text.primary)
            code
            HStack(spacing: ArgoSpacing.base) {
                Link(destination: challenge.verificationURL) {
                    Text(challenge.verificationURL.absoluteString)
                        .argoText(ArgoTypography.machineCaption)
                }
                Spacer(minLength: ArgoSpacing.base)
                Button("Stop waiting", action: stopWaiting)
                    .buttonStyle(.quiet)
            }
            Text("Argo is waiting for you to finish in the browser.")
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
        }
        .padding(ArgoSpacing.comfortable)
        .background {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .fill(argo.color.surface.raised)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(spoken)
    }

    /// The code in the provider's own formatting, never re-spaced: what is shown has to match what
    /// is typed. Copying is offered beside it because a hyphenated code is the easiest thing in
    /// this flow to get wrong by hand.
    private var code: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            Text(challenge.userCode)
                .argoText(ArgoTypography.machineDisplay)
                .foregroundStyle(argo.color.text.primary)
                .textSelection(.enabled)
                .frame(width: ArgoLayout.deviceCodeWidth, alignment: .leading)
            Button(hasCopied ? "Copied" : "Copy code", action: copy)
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
    DeviceCodeCard(
        challenge: ConnectChallenge(
            provider: .github,
            userCode: "WDJB-MJHT",
            verificationURL: URL(string: "https://github.com/login/device")
                ?? URL(fileURLWithPath: "/"),
        ),
        stopWaiting: {},
    )
    .frame(width: ArgoLayout.connectPanelWidth)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
