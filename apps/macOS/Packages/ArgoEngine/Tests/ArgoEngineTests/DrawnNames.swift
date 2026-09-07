@testable import ArgoEngine

/// The two draws and the three standings the mirror's claims are built from, in one file so every
/// suite reads the same fixtures — a floor claim written against a different `unworded` than the
/// rule claims use would pass while disagreeing with them.
///
/// Beside `MirroredNames` and for the same reason: a second copy would let two suites drift on
/// what a name Argo derived, or a CLI holding none, is.
enum DrawnNames {
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
