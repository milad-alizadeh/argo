import AppKit
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The provider mark beside a harness name, rendered as a monochrome template.
struct AgentMark: View {
    let harness: AgentCLI

    var body: some View {
        image
            .resizable()
            .renderingMode(.template)
            .scaledToFit()
            .frame(width: ArgoIconSize.control.rawValue, height: ArgoIconSize.control.rawValue)
            .accessibilityHidden(true)
    }

    private var assetName: String {
        switch harness {
        case .claude: "ClaudeTemplate"
        case .codex: "ChatGPTTemplate"
        }
    }

    private var image: Image {
        guard let url = Bundle.module.url(forResource: assetName, withExtension: "svg"),
              let mark = NSImage(contentsOf: url)
        else { return Image(systemName: "questionmark") }
        mark.isTemplate = true
        return Image(nsImage: mark)
    }
}
