import ArgoDesign
import SwiftUI

/// The ground every composer case is rendered on: the vessel held at the foot of the deck surface,
/// at the width the feed column gives it, with the window's opening focus parked off the field.
///
/// The park is the part that has to be shared rather than remembered. Left to itself the field is
/// the first key view, and macOS select-alls a focused field's text — so a case that forgets it
/// renders its draft as a selection, which is a state none of them is about.
struct ComposerStage<Vessel: View>: View {
    @FocusState private var parked: Bool

    @ViewBuilder let vessel: Vessel

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            Color.clear
                .frame(height: ArgoStroke.border)
                .focusable()
                .focused($parked)
                .focusEffectDisabled()
            vessel
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.bottom, ArgoSpacing.loose)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .argoDeckSurface()
        .defaultFocus($parked, true)
    }
}
