import SwiftUI

/// The header over one group of the `/` menu: what the group is, and beside it where its rows came
/// from and how many there are.
///
/// Origin lives HERE rather than on every row, because a badge repeated down a list of seventy-odd
/// things is noise the reader has already read. It goes back onto the rows only when the sections
/// stop grouping by origin — see `CommandMenuRow.origin`.
struct CommandMenuSection: View {
    @Environment(\.argo) private var argo

    let label: String
    /// The path and the count, or the characters and the count. Never upper-cased: it is a fact
    /// rather than a label, and a path in caps is a path nobody can check.
    let detail: String?

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            Text(label)
                .textCase(.uppercase)
                .foregroundStyle(argo.color.text.tertiary)
            if let detail {
                Text(detail)
                    .foregroundStyle(argo.color.text.disabled)
                    .lineLimit(1)
            }
        }
        // ONE role across the whole line. The path is a machine fact and the mono face would
        // usually carry it, but SF Mono beside SF Pro at the same rung reads as two sizes on one
        // line — and a header is a label to be scanned, not a string to be copied.
        .argoText(ArgoTypography.sectionLabel)
        .padding(.horizontal, ArgoSpacing.base)
        // Spelled as the two insets rather than as the derived height, so the box the text sits in
        // is the box the arithmetic describes. Asymmetric on purpose: the header belongs to the
        // rows UNDER it, so it stands further off the group above than off its own first row.
        .padding(.top, ArgoSpacing.snug)
        .padding(.bottom, ArgoSpacing.tight)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}
