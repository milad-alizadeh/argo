import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("New ticket button — pending, refused, and no usable token") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        ForEach(WriteControlSpecimen.states, id: \.name) { state in
            NewTicketButton(
                creation: TicketsChromeIntents.Creation(control: state.control, reconnect: {}),
            )
        }
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
