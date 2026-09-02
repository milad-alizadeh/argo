import AppKit
import ArgoUI
import SwiftUI

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
