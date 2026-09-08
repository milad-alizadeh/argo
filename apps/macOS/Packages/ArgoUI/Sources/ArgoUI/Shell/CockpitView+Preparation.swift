import SwiftUI

extension CockpitView {
    @ViewBuilder var newSessionComposer: some View {
        if let id = navigation.newSessionID {
            NewSessionComposer(
                actions: actions.sessions,
                menus: actions.composer,
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

extension View {
    func coveredByNewSession(_ covered: Bool) -> some View {
        accessibilityHidden(covered).allowsHitTesting(!covered)
    }
}
