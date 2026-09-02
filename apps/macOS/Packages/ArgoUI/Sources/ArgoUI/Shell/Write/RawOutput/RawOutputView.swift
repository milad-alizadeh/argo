import ArgoAtoms
import ArgoDesign
import SwiftUI

/// Everything a failed operation printed, at the affordance that invoked it (§5).
package struct RawOutputView: View {
    @Environment(\.argo) private var argo

    let output: RawOutput

    /// The channel's own name, spoken and drawn from one string.
    static let name = "Output"

    package var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            header
            // Scrolls both ways: git aligns its own output in columns, so wrapping it would be a
            // paraphrase by another route.
            ScrollView([.horizontal, .vertical]) {
                Text(output.text)
                    .argoMono(.body)
                    .foregroundStyle(argo.color.text.secondary)
                    .textSelection(.enabled)
            }
        }
        .padding(ArgoSpacing.comfortable)
        .frame(width: ArgoRawOutputPanel.width, alignment: .leading)
        .frame(maxHeight: ArgoRawOutputPanel.maxHeight, alignment: .topLeading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Self.name)
    }

    private var header: some View {
        HStack(spacing: ArgoSpacing.base) {
            GroupLabel(Self.name)
                .accessibilityHidden(true)
            Spacer(minLength: ArgoSpacing.flush)
            ArgoCopyButton(text: output.text, name: "Copy the output")
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(output: RawOutput) {
        self.output = output
    }
}
