@testable import ArgoUI
import Testing

/// The two scales a mark and a word are picked from. They used to be one — an icon was a multiple
/// of its label — and these are the claims that keep them separate without letting them drift.
@Suite("Type and icon scales")
struct TypeAndIconContractTests {
    // MARK: - Typography

    /// The identity roles are the two that used to carry a face of their own. They speak in the
    /// interface sans now: one sans for everything the interface says, one mono for machine facts.
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
        #expect(machineRoles == ["machine", "machineEmphasis", "machineCaption"])
    }

    /// The scale is Apple's macOS table, not a ladder of Argo's own — which is what makes it
    /// reusable: `body` means the same thing on every surface and in every other Mac app. Anchored
    /// on two documented values rather than all eleven, so this fails if the enum stops being the
    /// HIG's and passes without restating it.
    @Test
    func `the scale is the platform's, at the platform's sizes`() {
        #expect(ArgoTypeScale.allCases.count == 11)
        #expect(ArgoTypeScale.body.size == 13)
        #expect(ArgoTypeScale.caption1.size == 10)
    }

    /// Two half-point rungs used to exist — `11.5` and `10.5`. A rung nobody can see is a rung
    /// nobody chose.
    @Test
    func `every rung is a whole point`() {
        for rung in ArgoTypeScale.allCases {
            #expect(rung.size == rung.size.rounded())
        }
    }

    /// A role is a NAME for a rung, never a size of its own. The app had eleven sizes when a role
    /// could carry a number; it cannot now, and this is the claim that says so out loud.
    @Test
    func `no role carries a size the scale does not have`() {
        let scale = Set(ArgoTypeScale.allCases.map(\.size))

        for role in ArgoTypography.all {
            #expect(scale.contains(role.style.size))
        }
    }

    /// The feed's body is ONE size. A paragraph set a rung above the call line under it asks the
    /// reader to take the larger of the two as the more important, when the only difference is that
    /// one of them is prose. What tells them apart is ink, measure and shape — never size.
    @Test
    func `the feed sets its prose and its call lines on one rung`() {
        #expect(ArgoFeedRow.proseRung.size == ArgoTypography.body.size)
        // Still opened up: the column is read rather than scanned, and the leading is what carries
        // that now that the size does not.
        #expect(ArgoFeedRow.proseLineSpacing > 0)
    }

    /// Every shape the subject slot of a call line can take. Written once because both rules below
    /// are claims about the whole set — a shape added to one list and not the other would be a
    /// shape half the contract never sees.
    private static let subjectShapes: [FeedCall.Subject] = [
        .command("swift build"),
        .narration("Build the UI package", standingIn: "swift build"),
        .plain("grill"),
    ] + (FeedCall.FileName(path: "Sources/Feed.swift").map { [FeedCall.Subject.file($0)] } ?? [])

    /// The mono is the claim "this is machine text", and a call line is where it is easiest to make
    /// by accident: a command and a sentence the agent wrote sit in the SAME slot, one row apart.
    /// Only the command may take the machine face — a narration set in it would say the agent's
    /// words were something to run, and a filename is a name rather than a thing to retype.
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

    /// One rung under all of them. A subject a size above its neighbours would be the line's own
    /// type scale disagreeing with itself about which of two words matters more.
    @Test
    func `every subject shape sits on the feed's one body rung`() {
        for subject in Self.subjectShapes {
            #expect(subject.style.rung == ArgoTypography.body.rung)
        }
    }

    /// Markup keeps its own steps. An outline the agent wrote has to read as one, so a heading
    /// stands above the paragraph under it — the exception the one-size rule is stated against.
    @Test
    func `a heading still stands above the body it belongs to`() {
        #expect(ArgoTypeScale.title3.size > ArgoFeedRow.proseRung.size)
    }

    // MARK: - The icon scale

    /// The whole point of the scale is that it is SHORT. A multiplier on the type ramp produced an
    /// icon size per role — eleven of them, separated by fractions of a point — and a scale that
    /// long is picked by proximity rather than by meaning.
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

    /// What the old multiplier bought — a mark never standing proud of its own line — is kept as a
    /// ceiling instead. The rungs are absolute now, so this is the assertion that stops one being
    /// raised past the densest text it can sit beside.
    @Test
    func `no rung outgrows the densest line of type it can sit on`() {
        let densest = ArgoTypography.all.map(\.style.size).min() ?? 0

        #expect(ArgoIconSize.inline.rawValue <= densest)
        // The control rung is the exception, and deliberately: it marks a control rather than
        // annotating a word, so it answers to the control's own line and not to a caption's.
        #expect(ArgoIconSize.control.rawValue <= ArgoTypography.control.size + 1)
    }

    /// A chevron is a control, not punctuation. It had a rung of its own at well under label size,
    /// and what that bought was a disclosure nobody could see they were allowed to click.
    @Test
    func `a pointer is drawn at the same size as the marks it shares a line with`() {
        #expect(ArgoIconSize.allCases.allSatisfy { $0.rawValue >= ArgoIconSize.inline.rawValue })
    }

    // MARK: - Which mark, in the evidence panel's header

    /// A command has no language, and a header that asks for one falls through to the generic
    /// document — which is a shell call's evidence opening under a page icon. The claim is the
    /// fall-through itself: the mark is the terminal the command RAN in, and the question about a
    /// language is one a command is never asked, whatever its own last word happens to end in.
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
