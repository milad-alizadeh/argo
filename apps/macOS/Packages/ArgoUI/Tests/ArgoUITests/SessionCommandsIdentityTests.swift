@testable import ArgoUI
import Testing

/// The Session menu acts on the SELECTED Session, and the selection moves under it (#806).
///
/// `SessionCommands` reaches the menu as a `FocusedValue`, and SwiftUI keeps the value it already
/// holds whenever the fresh one compares equal — so the menu's items go on calling the closures
/// built for whichever Session was selected when they were last taken.
struct SessionCommandsIdentityTests {
    @MainActor
    @Test
    func `a rename after the selection moved renames the Session that is now selected`() {
        let acted = SessionsActedOn()
        let menu = MenuBar()
        menu.offered(commands(for: "session-a", acting: acted))
        menu.offered(commands(for: "session-b", acting: acted))

        menu.rename()

        #expect(acted.renamed == "session-b")
    }

    @MainActor
    @Test
    func `an archive after the selection moved archives the Session that is now selected`() {
        let acted = SessionsActedOn()
        let menu = MenuBar()
        menu.offered(commands(for: "session-a", acting: acted))
        menu.offered(commands(for: "session-b", acting: acted))

        menu.archive()

        #expect(acted.archived == "session-b")
    }

    /// Through the shipped initializer, which is where the id and the closures are bound to one
    /// Session — a menu naming one Session and acting on another is the defect itself.
    @MainActor
    private func commands(for session: String, acting acted: SessionsActedOn) -> SessionCommands {
        SessionCommands(
            for: .init(id: session, title: session, access: .managed, status: .idle),
            rename: { acted.renamed = $0 },
            archive: { id, _ in acted.archived = id },
        )
    }
}

/// The menu bar's hold on the focused value: it takes a fresh `SessionCommands` only where that
/// one differs from the one it already has.
@MainActor private final class MenuBar {
    private var held: SessionCommands?

    func offered(_ commands: SessionCommands) {
        guard held != commands else { return }
        held = commands
    }

    func rename() {
        held?.rename()
    }

    func archive() {
        held?.archive()
    }
}

/// Which Session each gesture landed on.
@MainActor private final class SessionsActedOn {
    var renamed: String?
    var archived: String?
}
