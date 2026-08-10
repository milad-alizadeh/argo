import SwiftUI

/// The File menu's half of the New Session affordance.
///
/// Declared in the shell rather than in the app so that both routes to a spawn end the same way,
/// with the roster on the Session that just started: `CockpitNavigationModel.session` is the
/// shell's own business, and a menu item wired in the app could only ever do the first half.
///
/// ⌘N is bound HERE and not on the toolbar button — two controls on one shortcut is one binding
/// with a loser, and the menu is where macOS puts this key.
public struct NewSessionCommands: Commands {
    private let spawn: CockpitSpawn

    @MainActor public init(
        presentation: CockpitPresentation,
        actions: CockpitActions,
        navigation: CockpitNavigationModel,
    ) {
        self.spawn = CockpitSpawn(
            presentation: presentation,
            actions: actions,
            navigation: navigation,
        )
    }

    public var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button(NewSessionOffer.label) {
                Task { await spawn.run() }
            }
            .keyboardShortcut("n", modifiers: .command)
            .disabled(!spawn.offer.isLaunchable)
        }
    }
}
