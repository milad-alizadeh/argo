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
        // The whole separation between one origin and the last one's rows. Asymmetric by a lot:
        // the header belongs to the rows UNDER it, and this gap is the only thing grouping them
        // now that the header draws no ground of its own.
        .padding(.top, ArgoSpacing.comfortable)
        .padding(.bottom, ArgoSpacing.tight)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}
