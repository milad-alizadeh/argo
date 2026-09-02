import ArgoUI
import SwiftUI

#Preview("Sessions navigation") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id

    SessionNavigator(rows: SessionRosterProjection.previewRows, selection: $selection)
        .frame(width: 280, height: 480)
        .argoAppearance()
}

#Preview("Sessions navigation — no selection") {
    SessionNavigator(rows: SessionRosterProjection.previewRows, selection: .constant(nil))
        .frame(width: 320, height: 480)
        .argoAppearance()
}

#Preview("Sessions navigation — with an archive at the foot") {
    SessionNavigator(
        rows: ArchivedRosterSpecimen.rows,
        archived: ArchivedRosterSpecimen.archived,
        selection: .constant(nil),
    )
    .frame(width: 320, height: 480)
    .argoAppearance()
}
