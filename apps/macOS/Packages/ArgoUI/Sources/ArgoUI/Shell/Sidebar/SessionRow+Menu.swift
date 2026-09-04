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

    /// The title alone, which is the one thing on the row that truncates (#1199). The location is
    /// NOT here: an absolute path is the widest thing a hover could hand a reader and says least
    /// about which run to open next — **Copy full location** above keeps it one action away.
    var inspectionText: String {
        row.title
    }
}
