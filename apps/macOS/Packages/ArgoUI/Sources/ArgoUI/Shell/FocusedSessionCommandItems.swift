import SwiftUI

/// Observing focus here keeps menu updates from rebuilding the app's Scene and cockpit.
public struct FocusedSessionCommandItems: View {
    @FocusedValue(\.sessionCommands) private var commands

    public init() {}

    public var body: some View {
        SessionCommandItems(commands: commands)
    }
}
