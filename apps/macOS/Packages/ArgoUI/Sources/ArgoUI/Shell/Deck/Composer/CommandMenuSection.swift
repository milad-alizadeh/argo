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
    /// Whether there is a group above this one for the gap to separate it FROM. The first header in
    /// the list has nothing above it, so the gap there would just be the surface's inset twice.
    let separates: Bool

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
        // The separation between one origin and the last one's rows, and the only thing grouping
        // them now that the header draws no ground of its own.
        //
        // The first header takes `snug` instead, which is what a row already holds its own text off
        // its edges by — so the list's first line and its last stand off the surface by the same
        // amount. Zero here would make the top gap the container's inset alone and the bottom the
        // inset plus that `snug`.
        .padding(.top, separates ? ArgoSpacing.comfortable : ArgoSpacing.snug)
        .padding(.bottom, ArgoSpacing.tight)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}
