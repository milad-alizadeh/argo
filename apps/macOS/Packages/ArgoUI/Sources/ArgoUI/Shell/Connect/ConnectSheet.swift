import SwiftUI

/// The two screens as one surface: Welcome, then Connect.
///
/// Welcome is shown once, on a machine that has never set a Project up, and the step between them
/// is local state — pressing `Get started` is not a fact about anything, and a round trip to the
/// app to record it would make the first thing a new user does feel like a commitment.
///
/// It is a panel and not a funnel: reached again from Project Settings, it opens straight on the
/// Connect half.
public struct ConnectSheet: View {
    private let reading: ConnectReading
    private let actions: ConnectPanelActions
    @State private var isWelcoming: Bool

    public init(
        reading: ConnectReading,
        actions: ConnectPanelActions,
        startsAtWelcome: Bool = false,
    ) {
        self.reading = reading
        self.actions = actions
        _isWelcoming = State(initialValue: startsAtWelcome)
    }

    public var body: some View {
        Group {
            if isWelcoming {
                WelcomeScreen { isWelcoming = false }
            } else {
                ConnectPanel(reading: reading, actions: actions)
            }
        }
        .argoAppearance()
    }
}

#Preview("Connect sheet — a first launch") {
    ConnectSheet(reading: ConnectFixture.fresh, actions: .inert, startsAtWelcome: true)
}
