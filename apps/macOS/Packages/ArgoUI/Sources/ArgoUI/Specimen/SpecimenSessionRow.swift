import SwiftUI

/// A Session roster row, as the contract dresses it.
///
/// Specimen only — #377 owns the real row. It carries no selection or hover treatment of its
/// own: it lives in a native `List`, and the sidebar's selection, focus ring and keyboard
/// behaviour are the system's. The contract's part is the type, the tone and the state ink.
struct SpecimenSessionRow: View {
    @Environment(\.argo) private var argo

    let session: SpecimenFixtures.Session

    var body: some View {
        HStack(alignment: .center, spacing: ArgoSpacing.base) {
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: ArgoSpacing.snug) {
                    Text(session.title)
                        .argoText(ArgoTypography.rowTitle)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    if session.isExternal {
                        Image(systemName: "lock")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(argo.color.text.tertiary)
                            .accessibilityLabel("Read-only")
                    }
                }
                Text(session.meta)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(1)
            }
            Spacer(minLength: ArgoSpacing.base)
            HStack(spacing: ArgoSpacing.snug) {
                Text(session.word)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(session.state.tint(in: argo.color))
                SpecimenStateDot(state: session.state)
            }
        }
        .padding(.vertical, ArgoSpacing.tight)
        .accessibilityElement(children: .combine)
    }
}

#Preview("Session rows — every operational state") {
    List(
        SpecimenFixtures.roster,
        selection: .constant(SpecimenFixtures.roster.first?.id),
    ) { session in
        // The ZStack is Apple's own workaround for a known Xcode bug: a custom row directly
        // inside a List's ForEach kills the macOS preview in TableViewListCore_Mac2. Preview
        // only — it never crashes at runtime.
        ZStack { SpecimenSessionRow(session: session) }
    }
    .listStyle(.sidebar)
    .frame(width: 300, height: 260)
    .argoAppearance()
}
