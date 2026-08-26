import AppKit
import SwiftUI

/// The row's right-click menu and the tooltip beside it — what the row OFFERS, split from what it
/// draws.
extension SessionRow {
    @ViewBuilder var copyActions: some View {
        // Rename and Reset are not copies: they name the gestures nothing else on screen does.
        Button(SessionRenameProjection.heading) { beginRenaming() }
        resetAction
        Divider()
        Button("Copy Session title") { copy(row.title) }
        if let location = row.location {
            Button("Copy full location") { copy(location) }
        }
        if let branch = row.branch {
            Button("Copy branch") { copy(branch) }
        }
    }

    /// The way back to the title the rename covered up (#502, story 20). Absent for a Session
    /// nobody renamed, and it names the title it restores — nothing else on screen shows it.
    @ViewBuilder private var resetAction: some View {
        if let derived = row.rename.derived {
            Button("\(SessionRenameProjection.reset) “\(derived)”") { rename(nil) }
        }
    }

    /// The full path, which the line above stands in for — absolute paths never appear in the
    /// default presentation (#377). The branch is not here: it is the header's.
    var inspectionText: String {
        [row.title, row.location].compactMap(\.self).joined(separator: "\n")
    }

    private func copy(_ value: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
    }
}
