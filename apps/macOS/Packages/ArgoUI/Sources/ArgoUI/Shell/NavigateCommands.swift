import SwiftUI

/// The Navigate menu — one item per room, on the shortcut each room names.
///
/// Declared in the shell rather than in the app for `NewSessionCommands`'s reason: which room the
/// window is in is `CockpitNavigationModel`'s own business, and the menu that moves it belongs
/// beside the strip that does. Adding a room adds a menu item here with nothing to wire (ADR-0022).
public struct NavigateCommands: Commands {
    private let navigation: CockpitNavigationModel

    public init(navigation: CockpitNavigationModel) {
        self.navigation = navigation
    }

    public var body: some Commands {
        CommandMenu("Navigate") {
            ForEach(CockpitRoom.allCases) { room in
                Button(room.title) { navigation.room = room }
                    .keyboardShortcut(room.shortcut, modifiers: .command)
            }
        }
    }
}
