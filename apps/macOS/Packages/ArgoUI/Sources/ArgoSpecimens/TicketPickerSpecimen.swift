import ArgoDesign
import ArgoUI
import SwiftUI

/// The searchable ticket picker in the three states it has to be judged in (#1231): the whole
/// open backlog with nothing typed, one query that narrowed it to a row, and one that kept
/// nothing.
///
/// The three side by side, because the judgement is comparative and it is about SIZE: ten open
/// Tickets and one and none all have to come out the same width, and the first has to stop at the
/// list's ceiling.
///
/// Drawn inline rather than out of the link it hangs off: a popover is its own window and never
/// lands in a screenshot of this one.
struct TicketPickerSpecimen: View {
    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.loose) {
            picker(over: "")
            picker(over: "1217")
            picker(over: "zzz")
        }
        .padding(ArgoSpacing.region)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .argoDeckSurface()
    }

    /// Each on its own popover ground, which is the surface the picker stands on in the app — the
    /// deck behind it is what a popover would be hanging over.
    private func picker(over query: String) -> some View {
        SessionTicketPicker(linking: SessionHeaderFixture.crowdedOffering, query: query)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: ArgoRadius.popover))
            .argoShadow(.popover)
    }
}
