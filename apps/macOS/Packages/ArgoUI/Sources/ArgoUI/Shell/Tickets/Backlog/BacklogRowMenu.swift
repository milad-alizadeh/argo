import SwiftUI

/// A backlog row's right-click menu (#1247): the states this provider can express, and the delete.
///
/// It acts on whatever the pointer's row STANDS FOR — the whole selection when the row is in it,
/// that row alone when it is not — and each title says how many, because a menu carries no rows to
/// point at (#800).
struct BacklogRowMenu: View {
    let targets: [Int]
    let acts: BacklogSelectionActs

    var body: some View {
        if !acts.states.isEmpty {
            Menu(BacklogSelectionProjection.markHeading(count: targets.count)) {
                ForEach(acts.states, id: \.self) { state in
                    Button(BacklogSelectionProjection.markTitle(state)) {
                        acts.mark(targets, state)
                    }
                }
            }
        }
        if acts.deletes {
            Divider()
            // `.destructive`, because a delete leaves nothing on the provider to put back — which
            // is what separates it from closing a ticket.
            Button(
                BacklogSelectionProjection.deleteTitle(count: targets.count),
                role: .destructive,
            ) {
                acts.delete(targets)
            }
        }
    }
}
