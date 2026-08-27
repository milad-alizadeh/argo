import SwiftUI

/// A sidebar or rail group's own label, on `sectionLabel` — the role whose documented job this is.
///
/// A `Section("…")` header takes the platform's sidebar style instead, which is title-case at the
/// body rung; the contract froze uppercase at 10 with tracking, and the two do not meet.
struct GroupLabel: View {
    @Environment(\.argo) private var argo

    private let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text.uppercased())
            .argoText(ArgoTypography.sectionLabel)
            .foregroundStyle(argo.color.text.tertiary)
    }
}

#Preview("Group label") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        GroupLabel("Backlog")
        GroupLabel("Charts")
    }
    .padding(ArgoSpacing.section)
    .argoAppearance()
}
