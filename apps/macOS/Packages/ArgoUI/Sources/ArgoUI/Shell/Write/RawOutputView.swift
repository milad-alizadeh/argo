import SwiftUI

/// Everything a failed operation printed, at the affordance that invoked it (§5).
///
/// Monospaced and unwrapped-by-Argo: git aligns its own output in columns, and re-flowing it into
/// prose is a paraphrase by another route. Selectable, with a copy beside the name, because the
/// next thing a reader does with a `hint:` is run it.
struct RawOutputView: View {
    @Environment(\.argo) private var argo

    let output: RawOutput

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            header
            ScrollView([.horizontal, .vertical]) {
                Text(output.text)
                    .argoMono(.body)
                    .foregroundStyle(argo.color.text.secondary)
                    .textSelection(.enabled)
                    .frame(alignment: .topLeading)
            }
        }
        .padding(ArgoSpacing.comfortable)
        .frame(width: ArgoRawOutputPanel.width, alignment: .leading)
        .frame(maxHeight: ArgoRawOutputPanel.maxHeight, alignment: .topLeading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Self.name)
    }

    /// The channel's own name, spoken and drawn from one string.
    static let name = "Output"

    private var header: some View {
        HStack(spacing: ArgoSpacing.base) {
            GroupLabel(Self.name)
                .accessibilityHidden(true)
            Spacer(minLength: ArgoSpacing.flush)
            ArgoCopyButton(text: output.text, name: "Copy the output")
        }
    }
}

#Preview("Raw output — everything a refused write printed") {
    if let output = RawOutput(WriteControlSpecimen.validationRefusal) {
        RawOutputView(output: output)
            .argoAppearance()
    }
}
