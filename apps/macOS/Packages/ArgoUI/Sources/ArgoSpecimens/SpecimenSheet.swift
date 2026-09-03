import ArgoDesign
import ArgoUI
import SwiftUI

/// What every contract sheet is made of: titled sections, a row's own name at one width, and the
/// note an undrawn role carries.
///
/// One protocol rather than a copy per sheet. There are two sheets now — the cockpit's contract and
/// the Atlas's (#1142) — and the second one having its own `section` would be the first place the
/// two could drift on what a section looks like.
/// `@MainActor` because a `View`'s `@Environment` read is: a sheet is drawn where SwiftUI draws it,
/// and a protocol that did not say so would put the conformance across an isolation boundary.
@MainActor
protocol SpecimenSheet {
    var argo: ArgoTheme { get }
}

extension SpecimenSheet {
    func section(
        _ title: String,
        @ViewBuilder content: () -> some View,
    )
        -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            Text(title)
                .argoText(ArgoTypography.sectionLabel)
                .foregroundStyle(argo.color.text.tertiary)
            content()
        }
    }

    /// A row's own name, at one width across every sheet, so two rows' swatches line up.
    func label(_ name: String) -> some View {
        Text(name)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.tertiary)
            .frame(width: 132, alignment: .leading)
    }

    /// What a role is waiting on, when nothing draws it yet — drawn in the attention ink so an
    /// unjudged value cannot be mistaken for a settled one at a glance.
    @ViewBuilder func unwired(_ note: String?) -> some View {
        if let note {
            Text("unwired · waits on \(note)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.state.attention)
        }
    }
}
