import ArgoUI
import SwiftUI

/// The whole window with Sessions on the roster and NONE of them chosen (#404 AC1).
///
/// A fresh window points itself at the first row (`CockpitNavigationModel.reconcile`), so this
/// state is only reached once a reader has taken the selection away. The clear is written on every
/// change rather than once on appear: `FeedView`'s own note about seeding a still a frame late
/// applies here, and reconciliation repoints on any roster membership change, so a single write
/// could be undone after the frame that was captured.
///
/// The whole `CockpitView` and not the deck alone: what has to be judged is the deck's word read
/// against the rail beside it, which is the pair that made the state ambiguous.
struct UnselectedDeckSpecimen: View {
    @State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: .preview, actions: .inert)
            .environment(navigation)
            .onChange(of: navigation.session, initial: true) { _, session in
                if session != nil {
                    navigation.session = nil
                }
            }
    }
}
