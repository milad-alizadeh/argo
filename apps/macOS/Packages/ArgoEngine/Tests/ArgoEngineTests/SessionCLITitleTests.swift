@testable import ArgoEngine
import Foundation
import Testing

/// The two titles the CLI holds itself, read back off the transcript (#1623).
///
/// #1494 taught Argo to WRITE Claude's title with `/rename` and left it unable to read one, so a
/// Session renamed on the phone kept whatever Argo held and the two surfaces disagreed. `/rename`
/// writes a `custom-title` record; the CLI's own summariser writes `ai-title`. Both shapes were
/// confirmed on disk, and the reader's own name is the one that wins.
@Suite("CLI titles")
struct SessionCLITitleTests {
    @Test
    func `a custom-title record is read as the reader's own name`() {
        let line = #"{"type":"custom-title","customTitle":"Roster titles","sessionId":"s"}"#

        #expect(TranscriptRecord.parse(line: line) == .customTitle("Roster titles"))
    }

    /// The same degrade-down every other record kind takes: a `type` this reader knows with the
    /// field it names absent is a record it cannot USE, and keeping its bytes loses nothing.
    @Test
    func `a custom-title record with no title keeps its bytes`() {
        let line = #"{"type":"custom-title","sessionId":"s"}"#

        #expect(TranscriptRecord.parse(line: line) == .unknown(raw: line))
    }

    @Test
    @MainActor
    func `the name the reader typed at the prompt outranks the summariser's`() async {
        let hub = await hubObserving([
            .title("Summarised for you", .summarised),
            .title("Roster titles", .custom),
        ])

        #expect(hub.sessions[0].title == "Roster titles")
    }

    /// The order the two records land in is the CLI's business, not Argo's: the summariser runs
    /// whenever it runs, and a rename it lands behind must not take the reader's name off the row.
    @Test
    @MainActor
    func `a summariser title arriving after the reader's own does not replace it`() async {
        let hub = await hubObserving([
            .title("Roster titles", .custom),
            .title("Summarised for you", .summarised),
        ])

        #expect(hub.sessions[0].title == "Roster titles")
    }

    /// Latest-wins WITHIN a kind, which is what the CLI means by writing the record again: the
    /// summariser re-titles a Session as the conversation moves.
    @Test
    @MainActor
    func `a second title of the same kind replaces the first`() async {
        let hub = await hubObserving([
            .title("First guess", .summarised),
            .title("Second guess", .summarised),
        ])

        #expect(hub.sessions[0].title == "Second guess")
    }

    @Test
    @MainActor
    func `either kind is read back as the title the CLI holds`() async {
        let summarised = await hubObserving([.title("Summarised for you", .summarised)])
        let custom = await hubObserving([.title("Roster titles", .custom)])

        #expect(summarised.sessions[0].nameStanding.cliTitle == "Summarised for you")
        #expect(custom.sessions[0].nameStanding.cliTitle == "Roster titles")
    }

    /// The whole point of the reading: a name Argo assembled off the first prompt is Argo's alone,
    /// and answering it here would tell the mirror the phone already shows it.
    @Test
    @MainActor
    func `a prompt-derived name is no CLI title at all`() async {
        let hub = await hubObserving([.prompt(
            text: "Fix the roster titles",
            images: [],
            atMs: nil,
        )])

        #expect(hub.sessions[0].title == "Fix the roster titles")
        #expect(hub.sessions[0].nameStanding.cliTitle == nil)
        // And it clears the mirror's floor: a first prompt says what the work is.
        #expect(hub.sessions[0].nameStanding.namesTheWork)
    }

    /// The floor the mirror reads before typing a name of Argo's own making. A transcript that has
    /// said nothing yet is named after its file, and typing THAT at a prompt would have the CLI
    /// write it as a `custom-title` — the top of the ladder, outranking every prompt after it.
    @Test
    @MainActor
    func `a Session that has said nothing yet names no work to mirror`() async {
        let hub = await hubObserving([.recordIdentity(uuid: "leaf")])

        #expect(hub.sessions[0].nameStanding.namesTheWork == false)
    }

    /// The bare `/clear` that opens a fresh transcript is the same trap: `SessionTitle` calls it
    /// provisional and takeable, and a mirror would make it permanent.
    @Test
    @MainActor
    func `a bare slash command names no work to mirror either`() async {
        let hub = await hubObserving([.prompt(text: "/clear", images: [], atMs: nil)])

        #expect(hub.sessions[0].title == "/clear")
        #expect(hub.sessions[0].nameStanding.namesTheWork == false)
    }

    /// The chain has the same contest across its links, and for the same reason: `/rename` on the
    /// root and a summariser title on the resumed file are two records about ONE Session. Without
    /// the comparison, `merge` took whichever the continuation held and a reader's own name was
    /// downgraded to a generated one by the act of resuming.
    @Test
    @MainActor
    func `a resumed link's summariser title does not unseat the name the reader typed`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        let root = hubTestObservation(id: "root", events: [
            .recordIdentity(uuid: "root-leaf"),
            .title("Roster titles", .custom),
        ])
        let resumed = hubTestObservation(id: "resumed", events: [
            .headLeaf(uuid: "root-leaf"),
            .title("Summarised for you", .summarised),
        ])

        await hubObserveToEnd(hub, resumed)
        await hubObserveToEnd(hub, root)

        #expect(hub.sessions[0].title == "Roster titles")
    }

    /// What the mirror is handed to decide with (`Hub.mirrorNames`). Every row is keyed, because
    /// the mirror refuses a row it was handed no standing for — and a CLI holding no title reads
    /// `nil`, which is what says Argo may speak for it.
    @Test
    @MainActor
    func `the reading the mirror asks for keys every row on the roster`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hubObserveToEnd(hub, hubTestObservation(
            id: "named",
            events: [.title("Roster titles", .custom)],
        ))
        await hubObserveToEnd(hub, hubTestObservation(
            id: "derived",
            events: [.prompt(text: "Fix the roster titles", images: [], atMs: nil)],
        ))

        #expect(hub.nameStandings["named"]?.cliTitle == "Roster titles")
        #expect(hub.nameStandings["derived"]?.cliTitle == nil)
        #expect(hub.nameStandings["derived"]?.namesTheWork == true)
    }

    @MainActor
    private func hubObserving(_ events: [TranscriptEvent]) async -> Hub {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo"))
        await hubObserveToEnd(hub, hubTestObservation(id: "session", events: events))
        return hub
    }
}
