import SwiftUI

extension CockpitView {
    @ViewBuilder var newSessionComposer: some View {
        if let id = navigation.newSessionID {
            NewSessionComposer(
                actions: actions.sessions,
                beside: navigation.newSessionBeside,
                started: {
                    guard navigation.newSessionID == id else { return }
                    navigation.pointAtStarting($0)
                },
            )
            .id(id)
            .room(isActive: navigation.room == .sessions)
        }
    }
}
