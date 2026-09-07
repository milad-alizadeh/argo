@testable import ArgoEngine

/// The two draws and the three standings the mirror's claims are built from, in one place so a
/// floor claim cannot be written against a different `unworded` than the rule claims use — it
/// would pass while disagreeing with them.
///
/// Out here rather than at the bottom of the suite because `SessionNameMirrorTests.swift` had
/// three code lines left under `file_length` and no room for another claim.
enum SessionNameFixture {
    /// A Session whose CLI holds no title and whose own name says something about the work — the
    /// ordinary row, and the one the reported bug was about.
    static let unnamed = SessionNameStanding(cliTitle: nil, namesTheWork: true)

    /// The same, before its first real prompt: a filename or a bare `/clear`, and nothing to say.
    static let unworded = SessionNameStanding(cliTitle: nil, namesTheWork: false)

    static func named(_ title: String) -> SessionNameStanding {
        SessionNameStanding(cliTitle: title, namesTheWork: true)
    }

    static func derived(_ name: String) -> SessionNameDraw {
        drawn(name, drawsDerivedTitle: true)
    }

    /// A name a person typed in the rename dialog. Since #1653 it travels by the same rule as
    /// every other name the roster draws — the helper stays because the CASE is still worth
    /// naming in a claim, not because the mirror can still tell it apart.
    static func readerNamed(_ name: String) -> SessionNameDraw {
        drawn(name)
    }

    static func drawn(
        _ name: String, drawsDerivedTitle: Bool = false,
    )
        -> SessionNameDraw {
        SessionNameDraw(
            name: name,
            drawsDerivedTitle: drawsDerivedTitle,
            takesSlashCommand: true,
        )
    }
}
