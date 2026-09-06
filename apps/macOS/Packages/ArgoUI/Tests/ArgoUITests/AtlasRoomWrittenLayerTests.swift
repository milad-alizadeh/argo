@testable import ArgoEngine
@testable import ArgoUI
import AtlasLayout
import Foundation
import Testing

/// What the Atlas room does with the written layer (#1159): it fetches it separately, it carries
/// it beside the measurement rather than inside it, and it drops it with the Project.
@MainActor
@Suite("Atlas room — the written layer")
struct AtlasRoomWrittenLayerTests {
    /// One note about one file, in the shape a written layer file holds. Put beside the Map by
    /// hand, which is how one arrives: nothing in Argo writes one, because a note is read out of
    /// the code rather than measured out of it.
    private static let oneNote = """
    {"version": 1, "files": {"argo/a.swift": {"note": "The first file."}}}
    """

    private func wrote(
        _ json: String,
        for project: CockpitPresentation.Project,
        in rootURL: URL,
    ) throws {
        try json.write(
            to: rootURL.appending(path: project.id + ".notes.json"),
            atomically: true,
            encoding: .utf8,
        )
    }

    /// The same note, recording a digest of what it was written about.
    private static func oneNote(about subject: String) -> String {
        """
        {"version": 1, "files": {"argo/a.swift":
            {"note": "The first file.", "subject": "\(subject)"}}}
        """
    }

    /// A repository with one file in it, and a written layer beside the Map that measures it.
    ///
    /// `subject` is what the note claims the file held when it was written: the file's own digest
    /// for a note that still holds, anything else for one that has gone stale, and none at all for
    /// a note nothing can check.
    private func written(subject: (String) -> String? = { _ in nil }) throws -> (
        model: AtlasRoomModel, project: CockpitPresentation.Project,
    ) {
        let (model, rootURL) = try AtlasRoomFixture.room()
        let repositoryURL = rootURL.appending(path: "argo", directoryHint: .isDirectory)
        try AtlasRoomFixture.makeRepository(at: repositoryURL)
        try AtlasRoomFixture.commitFile("a.swift", saying: "let a = 1\n", in: repositoryURL)
        let project = AtlasRoomFixture.project("argo", at: rootURL)
        // The app's own digest, not a second one spelled here: a test that hashed the file its own
        // way would pass while the store and the written layer disagreed about what a subject is.
        let held = AtlasSubject.digest(of: repositoryURL.appending(path: "a.swift"))
        let layer = subject(held ?? "").map { Self.oneNote(about: $0) } ?? Self.oneNote
        try wrote(layer, for: project, in: rootURL)
        return (model, project)
    }

    @Test func `a written layer beside the Map is read beside it`() async throws {
        let (model, project) = try written()

        await model.rebuild(project)

        #expect(model.notes.note(ofFile: "argo/a.swift")?.words == "The first file.")
    }

    /// The last criterion, end to end through the room: the file moved on, the sentence did not,
    /// and what the panel is handed says so.
    @Test func `a note written about an older version of the file arrives stale`() async throws {
        let (model, project) = try written { _ in "0000000000000000" }

        await model.rebuild(project)

        let note = try #require(model.notes.note(ofFile: "argo/a.swift"))
        #expect(note.standing == .stale)
        #expect(note.words == "The first file.")
    }

    /// The other half of the same path, so `.stale` above is the check answering rather than the
    /// check failing: a note recording what the file actually holds arrives current.
    @Test func `a note written about the file as it stands arrives current`() async throws {
        let (model, project) = try written { held in held }

        await model.rebuild(project)

        #expect(model.notes.note(ofFile: "argo/a.swift")?.standing == .current)
    }

    /// The ticket's second criterion where a reader meets it: a Project nobody wrote about draws
    /// the same map and is told nothing extra, and nothing fails over a file nobody promised.
    @Test func `a Project with no written layer is told nothing, and still draws`() async throws {
        let (model, rootURL) = try AtlasRoomFixture.room()

        await model.rebuild(AtlasRoomFixture.project("argo", at: rootURL))

        #expect(model.notes.isEmpty)
        if case .measured = model.reading {} else {
            Issue.record("measuring left the room reading \(model.reading)")
        }
    }

    /// Nothing survives a change of Project, the written layer included: a sentence about one
    /// repository's file beside another repository's map is the state ADR-0015 rules out.
    @Test func `leaving a Project drops what was written about it`() async throws {
        let (model, project) = try written()
        await model.rebuild(project)

        await model.open(nil)

        #expect(model.notes.isEmpty)
    }
}
