@testable import ArgoUI
import Testing

/// The context instrument's whole content decision, asserted where it is made.
///
/// Its own suite beside `SessionHeaderProjectionTests` rather than more cases inside it: the tier
/// function is a rule with edges, and the four numbers it turns on are the reason this ticket has
/// tests at all. A boundary that is only right in a view is a boundary nothing holds.
@Suite("Session header context")
struct SessionHeaderContextTests {
    private func tier(at tokens: Int) -> SessionHeaderProjection.Context.Tier? {
        SessionHeaderProjection.context(tokens: tokens).tier
    }

    /// The four numbers from the spec, exactly. `>=` and not `>` on both lines: crossing a
    /// threshold is being AT it, and an off-by-one here is a Session that reads healthy at the
    /// moment handing it off became the right move.
    @Test
    func `the tier changes on the threshold itself, never a token later`() {
        #expect(tier(at: 149_999) == .okay)
        #expect(tier(at: 150_000) == .warn)
        #expect(tier(at: 299_999) == .warn)
        #expect(tier(at: 300_000) == .crit)
    }

    /// The lines are Argo's own policy and DIRECT — a fixed count of tokens, not a share of a
    /// window whose size the transcript may never name. Asserted so a later "make it 15% and 30%"
    /// has to argue with a test rather than slip in as a refactor.
    @Test
    func `the thresholds are token counts Argo owns, not fractions of the window`() {
        #expect(SessionHeaderProjection.ContextPolicy.warn == 150_000)
        #expect(SessionHeaderProjection.ContextPolicy.crit == 300_000)
        #expect(SessionHeaderProjection.ContextPolicy.capacity == 1_000_000)
    }

    /// The honest gap, and the one rendering that must never be defaulted: an unread context is
    /// shown EMPTY and labelled `unknown`, because `.okay` at zero would read as a Session with a
    /// fresh window rather than as one Argo could not read.
    @Test
    func `a context that could not be read is unknown, and never the healthy tier`() {
        let context = SessionHeaderProjection.context(tokens: nil)

        #expect(context.tier == nil)
        #expect(context.tier != .okay)
        #expect(context.reading == "unknown")
        // Empty, not zero-length: an absent fill is drawn as no fill at all, and the two policy
        // lines have nothing to stand in.
        #expect(context.fill == nil)
        #expect(context.marks.isEmpty)
    }

    @Test
    func `the reading is what is held against the window`() {
        #expect(SessionHeaderProjection.context(tokens: 216_764).reading == "217k / 1M")
        // Under a hundred thousand a tenth is still a fact somebody uses; above it, it is noise on
        // a number that changes every turn.
        #expect(SessionHeaderProjection.context(tokens: 67175).reading == "67.2k / 1M")
        #expect(SessionHeaderProjection.context(tokens: 984).reading == "984 / 1M")
        // The rounding must not carry a reading over the unit it was picked for: `1000k / 1M` is
        // one number said two ways on one line.
        #expect(SessionHeaderProjection.context(tokens: 999_999).reading == "1M / 1M")
    }

    /// Both lines, every time there is a bar to draw them on — so which threshold is coming is
    /// readable BEFORE it is crossed, which is the whole reason the bar exists.
    @Test
    func `the bar carries both policy lines, where they actually fall`() {
        let context = SessionHeaderProjection.context(tokens: 216_764)

        #expect(context.marks == [0.15, 0.3])
        #expect(context.fill == 0.216764)
    }

    /// A window Argo guessed too small must not draw outside its own bar. The reading beside it
    /// still says the true number, which is the honest half — only the ink is clamped.
    @Test
    func `a Session past the window fills the bar and no further`() throws {
        let context = SessionHeaderProjection.context(tokens: 1_400_000)

        #expect(try #require(context.fill) == 1)
        #expect(context.reading == "1.4M / 1M")
        #expect(context.tier == .crit)
    }

    /// Story 42. The panel decodes the colours; the reading is two inches away and unmissable, and
    /// a panel that repeated it would be the same fact twice with two chances to disagree.
    @Test
    func `the guide explains the lines and never repeats the reading`() {
        let context = SessionHeaderProjection.context(tokens: 216_764)
        let panel = SessionHeaderProjection.Context.guide
            .map { "\($0.threshold) \($0.meaning)" }
            .joined(separator: " ") + SessionHeaderProjection.Context.remedy

        #expect(!panel.contains(context.reading))
        #expect(!panel.contains("217k"))
        #expect(panel.contains("past 150k"))
        #expect(panel.contains("past 300k"))
        #expect(panel.contains("handing off is worth doing"))
        #expect(panel.contains("handing off is overdue"))
    }

    /// Each line wears the ink it is explaining, rather than naming a hue in words: "amber" would
    /// be a second vocabulary to keep in step with the palette, and no use to anybody who cannot
    /// tell the two apart in the first place.
    @Test
    func `the guide's lines carry the tiers they decode`() {
        #expect(SessionHeaderProjection.Context.guide.map(\.tier) == [.warn, .crit])
    }

    /// The instrument is never absent. A Session whose context cannot be read still HAS one, and a
    /// zone that disappeared would say the fact does not apply rather than that Argo came up short.
    @Test
    func `the header always carries an instrument, readable or not`() {
        let unread = SessionHeaderProjection.header(from: session(tokens: nil))

        #expect(unread.context.reading == "unknown")
        #expect(unread.context.detail == "Context unknown")
    }

    /// The reading is said out loud by the INSTRUMENT, which is its own element on the line because
    /// it carries a control. The identity beside it must not say it as well, or a screen reader
    /// hears the same number twice crossing one header.
    @Test
    func `the identity announcement leaves the reading to the instrument`() {
        let header = SessionHeaderProjection.header(from: session(tokens: 216_764))

        #expect(header.context.detail == "Context 217k of 1M")
        #expect(!header.announcement.contains("217k"))
        #expect(!header.announcement.contains("Context"))
    }

    /// The PNGs are the only evidence these renderings have, so a tier with no case in the catalog
    /// is a state that ships without anybody looking at it.
    @Test
    func `every tier, and the unreadable one, has a specimen of its own`() {
        let drawn = SessionHeaderFixture.contexts

        #expect(drawn.map(\.specimen) == [.contextOk, .contextWarn, .contextCrit, .contextUnknown])
        #expect(drawn.map(\.header.context.tier) == [.okay, .warn, .crit, nil])
    }

    private func session(tokens: Int?) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "Session",
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .idle,
            contextTokens: tokens,
        )
    }
}
