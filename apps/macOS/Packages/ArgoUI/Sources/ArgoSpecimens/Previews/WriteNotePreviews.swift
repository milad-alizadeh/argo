import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Write notes — a provider's own words, and a token that died") {
    VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
        WriteNote(
            control: .refused(.refused(WriteControlSpecimen.validationRefusal)), reconnect: {},
        )
        WriteNote(control: .refused(.unreachable(.rateLimited)), reconnect: {})
        WriteNote(control: .blocked(ConnectFixture.personal), reconnect: {})
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
