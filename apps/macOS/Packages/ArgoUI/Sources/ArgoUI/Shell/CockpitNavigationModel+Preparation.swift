import Foundation

package extension CockpitNavigationModel {
    func prepareNewSession(beside sessionID: String? = nil) {
        newSessionBeside = sessionID
        newSessionID = UUID()
        room = .sessions
    }
}
