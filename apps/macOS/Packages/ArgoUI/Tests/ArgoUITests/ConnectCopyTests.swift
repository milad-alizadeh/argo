import ArgoEngine
@testable import ArgoUI
import Testing

/// The copy rules the ticket carries, asserted over every word this panel can put on screen: the
/// error pattern is three parts, no honesty tier reaches the user, no status word is invented, and
/// there are no em dashes.
///
/// Swept rather than spot-checked. A rule proved on the one string somebody remembered is a rule
/// the next string breaks.
@Suite("Connect panel copy")
struct ConnectCopyTests {
    /// Every failure the panel can report, in one list, so the sweeps below cover the set rather
    /// than a sample of it.
    static let notes: [ConnectNote] =
        [
            .noSuchProject,
            .noSuchAccount,
            .portNotServedByProvider(.linear, .codeHost),
            .noGrant,
            .grantExpired,
            .scopeNotVisible("milad-alizadeh/argo"),
            .unauthorized,
            .unreadable("The request timed out."),
        ].map(ConnectNote.init(refusal:))
        + [
            BindingFault.accountRemoved,
            .portNotServedByProvider,
            .grantMissing,
            .grantExpired,
        ].map(ConnectNote.init(fault:))
        + [
            GitHubDeviceFlowError.declined,
            .expired,
            .malformedResponse,
            .refused(code: "device_flow_disabled", description: ""),
        ].map { ConnectNote(deviceFlow: $0, provider: .github) }

    static let panels: [ConnectPanelProjection.Panel] = [
        ConnectFixture.fresh,
        ConnectFixture.folderOnly,
        ConnectFixture.partly,
        ConnectFixture.wired,
        ConnectReading(companion: .unknown),
        ConnectReading(folder: ConnectFixture.folder, mode: .settings(agent: .claude)),
    ].map(ConnectPanelProjection.panel(from:))

    /// Every string the panel and its failures can render, flattened once.
    static var words: [String] {
        panels.flatMap(strings(of:)) + notes.flatMap { [$0.what, $0.why, $0.fix] }
    }

    @Test
    func `no copy carries an em dash`() {
        #expect(Self.words.allSatisfy { !$0.contains("—") })
    }

    /// The ladder onboarding cut. A provenance tier is an internal attribute, and a user should
    /// never have to learn one to finish setting up a project.
    @Test
    func `no honesty tier appears anywhere in the flow`() {
        let tiers = ["DIRECT", "DERIVED", "CONVENTION", "honesty", "tier", "provenance"]

        #expect(Self.words.allSatisfy { word in
            tiers.allSatisfy { !word.localizedCaseInsensitiveContains($0) }
        })
    }

    /// The registry's words name Session liveness, Delivery and connection health. None of those
    /// is what this panel is about, and borrowing one here would be the same word meaning two
    /// things in two places.
    ///
    /// A whole rendered line, not a substring: "the provider stopped accepting its token" is a
    /// sentence about what happened, and a line that reads only `stopped` is a status claim. The
    /// difference is whether the word stands alone, which is exactly what this compares.
    @Test
    func `no status word is borrowed from another surface`() {
        let borrowed = ["running", "idle", "stopped", "ended", "stale", "needs input", "passing"]

        #expect(Self.words.allSatisfy { word in
            !borrowed.contains(word.lowercased())
        })
    }

    /// `unknown` is the one status word this panel does use, and it is the registry's own answer
    /// for a fact that cannot be established.
    @Test
    func `the only status word used is the registry's unknown`() {
        let panel = ConnectPanelProjection.panel(from: ConnectReading(companion: .unknown))

        #expect(panel.companion.detail == "unknown")
    }

    @Test
    func `every failure says what happened, why, and what to do`() {
        #expect(Self.notes.allSatisfy {
            !$0.what.isEmpty && !$0.why.isEmpty && !$0.fix.isEmpty
        })
        #expect(Self.notes.allSatisfy { $0.spoken.contains($0.fix) })
    }

    /// A provider's own sentence is the only thing that usually says how to fix its refusal, so it
    /// goes through untouched rather than being reworded into Argo's voice.
    @Test
    func `a provider's own words are carried verbatim`() {
        let unreadable = ConnectNote(refusal: .unreadable("The request timed out."))
        let refused = ConnectNote(
            deviceFlow: .refused(code: "access_denied", description: "Your org blocks OAuth Apps."),
            provider: .github,
        )

        #expect(unreadable.why == "The request timed out.")
        #expect(refused.why == "Your org blocks OAuth Apps.")
    }

    /// Where the provider sent no sentence, its code is better than a sentence Argo made up.
    @Test
    func `a refusal with no description falls back to the provider's code`() {
        let refused = ConnectNote(
            deviceFlow: .refused(code: "device_flow_disabled", description: ""),
            provider: .github,
        )

        #expect(refused.why == "device_flow_disabled")
    }

    private static func strings(of panel: ConnectPanelProjection.Panel) -> [String] {
        let rows = [panel.folder, panel.companion] + [panel.agent].compactMap(\.self)
        return [panel.heading, panel.folderCall, panel.call]
            + rows.flatMap { [$0.title, $0.detail, $0.spoken] }
            + panel.ports.flatMap { port in
                [port.row.title, port.row.detail]
                    + port.choices.map(\.title)
                    + port.offers.map(\.title)
            }
    }
}
