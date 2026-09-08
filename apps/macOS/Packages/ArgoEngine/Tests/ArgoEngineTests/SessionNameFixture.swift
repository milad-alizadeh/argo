@testable import ArgoEngine

/// The draws and the standings the mirror's claims are built from, in one place so a floor claim
/// cannot be written against a different `unworded` than the rule claims use — it would pass while
/// disagreeing with them.
///
/// Out here rather than at the bottom of the suite because `SessionNameMirrorTests.swift` had
/// three code lines left under `file_length` and no room for another claim.
enum SessionNameFixture {
    /// The roster title every reading below is taken at. The mirror only ever COMPARES the draw's
    /// to the standing's, so one word standing for "both halves came from one pass" says the whole
    /// of it — and the join's own claim is the one place two different ones appear (#1695).
    static let onePass = "One roster pass"

    /// A Session whose CLI holds no title and whose own name says something about the work — the
    /// ordinary row, and the one the reported bug was about.
    static let unnamed = SessionNameStanding(
        cliTitle: nil, namesTheWork: true, rosterTitle: onePass,
    )

    /// The same, before its first real prompt: a filename or a bare `/clear`, and nothing to say.
    static let unworded = SessionNameStanding(
        cliTitle: nil, namesTheWork: false, rosterTitle: onePass,
    )

    /// `unnamed` as a LATER pass read it: the row's words have moved on since the draw was
    /// captured, which is the one join the mirror must refuse (#1695).
    static func unnamed(inPass rosterTitle: String) -> SessionNameStanding {
        SessionNameStanding(cliTitle: nil, namesTheWork: true, rosterTitle: rosterTitle)
    }

    static func named(_ title: String) -> SessionNameStanding {
        SessionNameStanding(cliTitle: title, namesTheWork: true, rosterTitle: onePass)
    }

    static func derived(_ name: String, inPass rosterTitle: String = onePass) -> SessionNameDraw {
        drawn(name, drawsDerivedTitle: true, inPass: rosterTitle)
    }

    /// A name a person typed in the rename dialog. Since #1653 it travels by the same rule as
    /// every other name the roster draws — the helper stays because the CASE is still worth
    /// naming in a claim, not because the mirror can still tell it apart.
    static func readerNamed(_ name: String) -> SessionNameDraw {
        drawn(name)
    }

    static func drawn(
        _ name: String, drawsDerivedTitle: Bool = false, inPass rosterTitle: String = onePass,
    )
        -> SessionNameDraw {
        SessionNameDraw(
            name: name,
            drawsDerivedTitle: drawsDerivedTitle,
            takesSlashCommand: true,
            rosterTitle: rosterTitle,
        )
    }
}
