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

    @Test
    func `every role sits on the dense ladder the cockpit is built at`() {
        for role in ArgoTypography.all {
            #expect(role.style.size >= 10 && role.style.size <= 20)
        }
    }

    // MARK: - The icon scale

    /// The whole point of the scale is that it is SHORT. A multiplier on the type ramp produced an
    /// icon size per role — eleven of them, separated by fractions of a point — and a scale that
    /// long is picked by proximity rather than by meaning.
    @Test
    func `the icon scale stays short enough to pick a rung by what it means`() {
        #expect(ArgoIconSize.allCases.count <= 4)
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

    /// An indicator is punctuation. At label size a chevron reads as a word, which is exactly the
    /// bug the separate rung exists to prevent.
    @Test
    func `an indicator is well under the smallest rung that names anything`() {
        #expect(ArgoIconSize.indicator.rawValue < ArgoIconSize.inline.rawValue / 1.5)
    }
}
