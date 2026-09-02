import SwiftUI

/// What a roster row offers on a right-click, and what it says on hover — split off
/// `SessionRow.swift` so the row's own body stays that file's one subject.
///
/// Every member here is internal rather than private for that split alone: an extension in
/// another file cannot see the view's private members, and nothing outside this pair of files
/// names any of them.
extension SessionRow {
    @ViewBuilder var copyActions: some View {
        // Rename and Reset are not copies: they name the gestures nothing else on screen does.
        // Absent on a fold, which stands for many Sessions and so has no name of its own.
        if row.rename != nil {
            Button(SessionRenameProjection.heading) { beginRenaming() }
        }
        resetAction
        Divider()
        if row.fold == nil {
            Button("Copy Session title") { ArgoPasteboard.put(row.title) }
        }
        if let location = row.location {
            Button("Copy full location") { ArgoPasteboard.put(location) }
        }
        if let branch = row.branch {
            Button("Copy branch") { ArgoPasteboard.put(branch) }
        }
    }

    /// The way back to the title the rename covered up (#502, story 20). Absent for a Session
    /// nobody renamed, and it names the title it restores — nothing else on screen shows it.
    @ViewBuilder private var resetAction: some View {
        if let derived = row.rename?.derived {
            Button("\(SessionRenameProjection.reset) “\(derived)”") { rename(nil) }
        }
    }

    /// The full path, which the line above stands in for — absolute paths never appear in the
    /// default presentation (#377). The branch is not here: it is the header's. On a fold it is
    /// the folder its runs share, which is the one thing the row is not saying in full.
    var inspectionText: String {
        [row.title, row.location].compactMap(\.self).joined(separator: "\n")
    }
}
