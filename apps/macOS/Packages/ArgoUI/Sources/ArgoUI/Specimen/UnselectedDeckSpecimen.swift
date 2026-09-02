import SwiftUI

/// The whole window with Sessions on the roster and NONE of them chosen — what a ⌘-click on the
/// selected row leaves behind (#404 AC1).
///
/// The selection is cleared AFTER the shell's own reconciliation has landed, because a fresh window
/// points itself at the first row (`CockpitNavigationModel.reconcile`): this state only exists once
/// a reader has taken the selection away, so seeding `nil` would simply be reconciled back onto
/// row one. Nothing re-points it after that — reconciliation watches the roster's MEMBERSHIP, which
/// a click never changes.
///
/// The whole `CockpitView` and not the deck alone: what has to be judged is the deck's word read
/// against the rail beside it, which is the pair that made the state ambiguous in the first place.
struct UnselectedDeckSpecimen: View {
    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: .preview, actions: .inert)
            .environment(navigation)
            .task { navigation.session = nil }
    }
}
