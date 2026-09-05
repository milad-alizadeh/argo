import SwiftUI

/// The window's two prompts, mounted together (#1290, #1247): the one asked BEFORE an archive ends
/// a live agent, and the one that reports a backlog batch the provider took only part of.
///
/// Both belong on the shell rather than in the surface that raises them — an archive comes from
/// the menu bar as well as the roster row, and a batch report is raised from the backlog and shown
/// over the whole window. Grouped so the body reads as one line for "the prompts".
struct ShellPrompts: ViewModifier {
    @Binding var archiving: ArchiveConfirmation?
    @Binding var report: BacklogWriteReport?
    /// Archive the Sessions named, now that the reader has said so.
    let archive: @MainActor ([String]) -> Void

    func body(content: Content) -> some View {
        content
            .modifier(ArchiveConfirmationDialog(pending: $archiving, archive: archive))
            .modifier(BacklogWriteReportDialog(report: $report))
    }
}
