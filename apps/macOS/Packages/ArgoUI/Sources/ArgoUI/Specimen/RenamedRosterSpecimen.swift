import ArgoDesign
import SwiftUI

/// The roster with one row carrying a name somebody typed. The claim is story 19's, drawn: the
/// renamed row reads as the Session's name rather than as a label pinned over a title, and the
/// rows either side of it still show the ones their transcripts derived.
///
/// The SHIPPING row over the sidebar list it ships inside, projected from the same rows the shell
/// is handed — a specimen drawing a second row is evidence about a row nobody sees.
struct RenamedRosterSpecimen: View {
    var body: some View {
        List {
            ForEach(RenameFixture.rows) { row in
                SessionRow(row: row).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }
}

#Preview("Renamed roster — one name somebody typed, two derived") {
    RenamedRosterSpecimen()
        .frame(height: 240)
        .argoAppearance()
}
