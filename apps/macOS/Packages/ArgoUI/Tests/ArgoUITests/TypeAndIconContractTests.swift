@testable import ArgoUI
import Testing

/// The two scales a mark and a word are picked from, kept separate without letting them drift.
@Suite("Type and icon scales")
struct TypeAndIconContractTests {
    // MARK: - Typography

    /// One sans for everything the interface says, one mono for machine facts.
    @Test
    func `identity lines are set in the interface sans, not a face of their own`() {
        let identityRoles = [ArgoTypography.sessionTitle, ArgoTypography.identityHeading]

        #expect(identityRoles.allSatisfy { $0.typeface == .interface })
    }

    @Test
    func `the mono is confined to machine facts`() {
        let machineRoles = ArgoTypography.all
            .filter { $0.style.typeface == .machine }
            .map(\.name)
        #expect(machineRoles == [
            "machineDisplay", "machineBody", "machine", "machineEmphasis", "machineCaption",
        ])
    }

    /// The machine ladder reaches the body rung, so a machine fact can stand beside the words it
    /// annotates at ONE size.
    @Test
    func `a machine fact can meet the interface's own body size`() {
        #expect(ArgoTypography.machineBody.size == ArgoTypography.body.size)
        #expect(ArgoTypography.machineBody.typeface == .machine)
    }

    /// The scale is Apple's macOS table, not a ladder of Argo's own. Anchored on two documented
    /// values rather than all eleven, so this fails if the enum stops being the HIG's.
    @Test
    func `the scale is the platform's, at the platform's sizes`() {
        #expect(ArgoTypeScale.allCases.count == 11)
        #expect(ArgoTypeScale.body.size == 13)
        #expect(ArgoTypeScale.caption1.size == 10)
    }

    @Test
    func `every rung is a whole point`() {
        for rung in ArgoTypeScale.allCases {
            #expect(rung.size == rung.size.rounded())
        }
    }

    /// A role is a NAME for a rung, never a size of its own.
    @Test
    func `no role carries a size the scale does not have`() {
        let scale = Set(ArgoTypeScale.allCases.map(\.size))

        for role in ArgoTypography.all {
            #expect(scale.contains(role.style.size))
        }
    }

    /// The feed's body is ONE size; prose and call lines are told apart by ink, measure and shape.
    @Test
    func `the feed sets its prose and its call lines on one rung`() {
        #expect(ArgoFeedRow.proseRung.size == ArgoTypography.body.size)
        // Still opened up: the column is read rather than scanned, and the leading carries that.
        #expect(ArgoFeedRow.proseLineSpacing > 0)
    }

    /// Every shape the subject slot of a call line can take — both rules below are claims about
    /// the whole set, so a shape missing here is one half the contract never sees.
    private static let subjectShapes: [FeedCall.Subject] = [
        .command("swift build"),
        .narration("Build the UI package", standingIn: "swift build"),
        .plain("grill"),
    ] + (FeedCall.FileName(path: "Sources/Feed.swift").map { [FeedCall.Subject.file($0)] } ?? [])

    /// A command and a sentence the agent wrote sit in the SAME slot, one row apart; only the
    /// command may take the machine face.
    @Test
    func `only a command takes the machine face in a call line's subject slot`() {
        for subject in Self.subjectShapes {
            var isCommand: Bool {
                guard case .command = subject else { return false }
                return true
            }
            #expect((subject.style.typeface == .machine) == isCommand)
        }
    }

    @Test
    func `every subject shape sits on the feed's one body rung`() {
        for subject in Self.subjectShapes {
            #expect(subject.style.rung == ArgoTypography.body.rung)
        }
    }

    /// Markup keeps its own steps — the one exception the one-size rule is stated against.
    @Test
    func `a heading still stands above the body it belongs to`() {
        #expect(ArgoTypeScale.title3.size > ArgoFeedRow.proseRung.size)
    }

    // MARK: - The icon scale

    /// A scale long enough to hold a rung per role is picked by proximity rather than by meaning.
    @Test
    func `the icon scale stays short enough to pick a rung by what it means`() {
        #expect(ArgoIconSize.allCases.count <= 3)
    }

    @Test
    func `the rungs are ordered and none of them is a near-miss for another`() {
        let rungs = ArgoIconSize.ladder.map(\.size.rawValue)

        #expect(rungs == rungs.sorted())
        for (index, rung) in rungs.enumerated() {
            for other in rungs[(index + 1)...] {
                // Far enough apart that two marks on adjacent rungs are visibly different marks
                // rather than the same one drawn twice by two call sites that disagreed.
                #expect(other - rung >= 2)
            }
        }
    }

    /// The rungs are absolute, so this is what stops one being raised past the densest text it can
    /// sit beside.
    @Test
    func `no rung outgrows the densest line of type it can sit on`() {
        let densest = ArgoTypography.all.map(\.style.size).min() ?? 0

        #expect(ArgoIconSize.inline.rawValue <= densest)
        // The control rung answers to the control's own line, not to a caption's.
        #expect(ArgoIconSize.control.rawValue <= ArgoTypography.control.size + 1)
    }

    @Test
    func `a pointer is drawn at the same size as the marks it shares a line with`() {
        #expect(ArgoIconSize.allCases.allSatisfy { $0.rawValue >= ArgoIconSize.inline.rawValue })
    }

    // MARK: - Which mark, in the evidence panel's header

    /// A command has no language, and a header that asks for one falls through to the generic
    /// document — a shell call's evidence opening under a page icon, whatever its last word ends
    /// in.
    @Test
    func `a command's header takes the terminal, never a language glyph`() {
        let ran = "sh scripts/screenshot.sh out.png && cat notes.md"
        let call = FeedCall(
            kind: .execute, subject: .command(ran), churn: nil, ending: .succeeded,
            evidence: [], repeats: 1, spend: nil,
        )

        #expect(call.language == nil)
        #expect(call.opened.symbol == ArgoSymbol.ran)
        #expect(call.opened.symbol != ArgoSymbol.plainSource)
        #expect(call.opened.symbol != EvidenceLanguage.markdown.symbol)
    }
}
