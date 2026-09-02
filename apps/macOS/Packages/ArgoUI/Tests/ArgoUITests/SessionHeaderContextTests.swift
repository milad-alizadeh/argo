@testable import ArgoUI
import Testing

/// The context instrument's whole content decision, asserted where it is made.
@Suite("Session header context")
struct SessionHeaderContextTests {
    private func tier(at tokens: Int) -> SessionHeaderProjection.Context.Tier? {
        SessionHeaderProjection.context(tokens: tokens).tier
    }

    /// The four numbers from the spec, exactly. `>=` and not `>` on both lines: crossing a
    /// threshold is being AT it.
    @Test
    func `the tier changes on the threshold itself, never a token later`() {
        #expect(tier(at: 149_999) == .okay)
        #expect(tier(at: 150_000) == .warn)
        #expect(tier(at: 299_999) == .warn)
        #expect(tier(at: 300_000) == .crit)
    }

    /// The lines are Argo's own policy and DIRECT — a fixed count of tokens, not a share of a
    /// window whose size the transcript may never name.
    @Test
    func `the thresholds are token counts Argo owns, not fractions of the window`() {
        #expect(SessionHeaderProjection.ContextPolicy.warn == 150_000)
        #expect(SessionHeaderProjection.ContextPolicy.crit == 300_000)
        #expect(SessionHeaderProjection.ContextPolicy.capacity == 1_000_000)
    }

    /// An unread context is shown EMPTY and labelled `unknown`; `.okay` at zero would read as a
    /// fresh window rather than as one Argo could not read.
    @Test
    func `a context that could not be read is unknown, and never the healthy tier`() {
        let context = SessionHeaderProjection.context(tokens: nil)

        #expect(context.tier == nil)
        #expect(context.tier != .okay)
        #expect(context.reading == "unknown")
        // Empty, not zero-length: an absent fill is drawn as no fill at all.
        #expect(context.fill == nil)
        #expect(context.marks.isEmpty)
    }

    @Test
    func `the reading is what is held against the window`() {
        #expect(SessionHeaderProjection.context(tokens: 216_764).reading == "217k / 1M")
        // A tenth below a hundred thousand, none above it.
        #expect(SessionHeaderProjection.context(tokens: 67175).reading == "67.2k / 1M")
        #expect(SessionHeaderProjection.context(tokens: 984).reading == "984 / 1M")
        // The rounding must not carry a reading over the unit it was picked for (`1000k / 1M`).
        #expect(SessionHeaderProjection.context(tokens: 999_999).reading == "1M / 1M")
    }

    /// Both lines, every time there is a bar to draw them on.
    @Test
    func `the bar carries both policy lines, where they actually fall`() {
        let context = SessionHeaderProjection.context(tokens: 216_764)

        #expect(context.marks == [0.15, 0.3])
        #expect(context.fill == 0.216764)
    }

    /// A window Argo guessed too small must not draw outside its own bar: only the ink is clamped,
    /// and the reading beside it still says the true number.
    @Test
    func `a Session past the window fills the bar and no further`() throws {
        let context = SessionHeaderProjection.context(tokens: 1_400_000)

        #expect(try #require(context.fill) == 1)
        #expect(context.reading == "1.4M / 1M")
        #expect(context.tier == .crit)
    }

    /// Story 42. The panel decodes the colours and never repeats the reading beside it.
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

    /// Each line wears the ink it is explaining rather than naming a hue in words.
    @Test
    func `the guide's lines carry the tiers they decode`() {
        #expect(SessionHeaderProjection.Context.guide.map(\.tier) == [.warn, .crit])
    }

    /// The instrument is never absent: a Session whose context cannot be read still HAS one.
    @Test
    func `the header always carries an instrument, readable or not`() {
        let unread = SessionHeaderProjection.header(from: session(tokens: nil))

        #expect(unread.context.reading == "unknown")
        #expect(unread.context.detail == "Context unknown")
    }

    /// The reading is said out loud by the INSTRUMENT alone; the identity beside it saying it too
    /// makes a screen reader hear the same number twice crossing one header.
    @Test
    func `the identity announcement leaves the reading to the instrument`() {
        let header = SessionHeaderProjection.header(from: session(tokens: 216_764))

        #expect(header.context.detail == "Context 217k of 1M")
        #expect(!header.announcement.contains("217k"))
        #expect(!header.announcement.contains("Context"))
    }

    /// The PNGs are the only evidence these renderings have, so every tier needs a catalog case.
    @Test
    func `every tier, and the unreadable one, has a specimen of its own`() {
        let drawn = SessionHeaderFixture.contexts

        #expect(drawn.map(\.name) == ["contextOk", "contextWarn", "contextCrit", "contextUnknown"])
        #expect(drawn.map(\.header.context.tier) == [.okay, .warn, .crit, nil])
    }

    private func session(tokens: Int?) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "Session",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(model: "claude-opus-5")),
            work: .init(location: "/Users/milad/Developer/argo"),
            spend: .init(contextTokens: tokens),
        )
    }
}
