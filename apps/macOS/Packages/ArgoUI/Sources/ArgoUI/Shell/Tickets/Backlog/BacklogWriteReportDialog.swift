import SwiftUI

/// The prompt raised when a write over a whole backlog selection went only partly through (#1247).
///
/// A modifier rather than a block in `CockpitView`'s body, as `ArchiveConfirmationDialog` is: the
/// shell mounts it beside its sheets, and the words and the dismissal rule are one thing that
/// belongs where they can be read at once.
struct BacklogWriteReportDialog: ViewModifier {
    /// The report waiting to be read, or nothing. Cleared by the button and by any dismissal —
    /// there is nothing to decide here, only something to be told.
    @Binding var report: BacklogWriteReport?

    func body(content: Content) -> some View {
        content.alert(
            report?.title ?? "",
            isPresented: isPresented,
            presenting: report,
        ) { _ in
            Button("OK", role: .cancel) {}
        } message: { report in
            Text(report.message)
        }
    }

    private var isPresented: Binding<Bool> {
        Binding(
            get: { report != nil },
            set: { isUp in
                guard !isUp else { return }
                report = nil
            },
        )
    }
}

// The prompt as it is raised, over a stand-in for the surface it covers. ONE render: it is up, or
// there is nothing to draw. The platform owns the chrome, so what this is for is the WORDS — that
// the numbers and the provider's own sentences read as a list, and that the line saying the rest
// DID change is not lost among them.
#Preview("Backlog batch report — two the provider refused") {
    @Previewable @State var report: BacklogWriteReport? = BacklogWriteReport(
        verb: "The change to In Progress",
        refusals: [
            .init(number: 1247, reason: "This provider has no status for in review"),
            .init(number: 1248, reason: "Must have admin access to the repository"),
        ],
    )

    Color.clear
        .frame(width: 420, height: 260)
        .modifier(BacklogWriteReportDialog(report: $report))
}
