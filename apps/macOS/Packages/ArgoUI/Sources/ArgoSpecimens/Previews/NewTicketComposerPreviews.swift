import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("New ticket composer — the token died while it was open") {
    @Previewable @State var composition = TicketComposition(
        title: "The Tickets room's row draws four verbs and performs none",
        body: "Every control in the row takes a click and returns.",
    )

    NewTicketComposer(composition: $composition, control: .blocked(ConnectFixture.personal))
        .argoAppearance()
}
