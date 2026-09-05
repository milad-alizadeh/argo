import ArgoUI
import SwiftUI

#Preview("Sessions navigation") {
    @Previewable @State var selection = RowSelection(
        one: CockpitPresentation.preview.sessions.first?.id,
    )

    SessionNavigator(
        rows: SessionRosterProjection.previewRows,
        held: .init(selection: $selection),
    )
    .frame(width: 280, height: 480)
    .argoAppearance()
}

#Preview("Sessions navigation — no selection") {
    SessionNavigator(
        rows: SessionRosterProjection.previewRows,
        held: .init(selection: .constant(RowSelection())),
    )
    .frame(width: 320, height: 480)
    .argoAppearance()
}

#Preview("Sessions navigation — with an archive at the foot") {
    SessionNavigator(
        rows: ArchivedRosterSpecimen.rows,
        archived: ArchivedRosterSpecimen.archived,
        held: .init(selection: .constant(RowSelection())),
    )
    .frame(width: 320, height: 480)
    .argoAppearance()
}
