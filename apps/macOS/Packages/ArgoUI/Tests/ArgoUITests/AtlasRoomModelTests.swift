@testable import ArgoEngine
@testable import ArgoUI
import AtlasLayout
import Foundation
import Testing

/// What the Atlas room reads on arriving at a Project, and what the reader's one lever does.
///
/// The store is pointed at a throwaway folder, never at the machine's own application support: a
/// suite that wrote a Map file for a real Project would leave it there.
@MainActor
@Suite("Atlas room model")
struct AtlasRoomModelTests {
    private func fixture() throws -> (model: AtlasRoomModel, rootURL: URL) {
        let rootURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-atlas-room-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        return (AtlasRoomModel(store: AtlasMapStore(directoryURL: rootURL)), rootURL)
    }

    private func project(_ id: String, at rootURL: URL) -> CockpitPresentation.Project {
        CockpitPresentation.Project(
            id: id,
            name: id,
            location: rootURL.appending(path: id).path,
            isReachable: true,
            isRegistered: true,
        )
    }

    /// A window with no active Project has no repository to measure, which is a different sentence
    /// from a Project nobody has measured yet.
    @Test
    func `no active Project is not an unmeasured one`() async throws {
        let (model, _) = try fixture()

        await model.open(nil)

        #expect(model.reading == .noProject)
    }

    /// Nothing is measured on arriving: a first open that silently walked a repository would cost
    /// the reader a wait they never asked for.
    @Test
    func `a Project with no Map file reads as unmeasured, and nothing is written`() async throws {
        let (model, rootURL) = try fixture()

        await model.open(project("argo", at: rootURL))

        #expect(model.reading == .unmeasured)
        #expect(try FileManager.default.contentsOfDirectory(atPath: rootURL.path).isEmpty)
    }

    /// The reader's one lever, and the whole of what makes a map exist.
    @Test
    func `measuring writes a Map the next open reads back`() async throws {
        let (model, rootURL) = try fixture()
        let project = project("argo", at: rootURL)

        await model.rebuild(project)
        let measured = model.reading
        let reopened = AtlasRoomModel(store: AtlasMapStore(directoryURL: rootURL))
        await reopened.open(project)

        #expect(measured == reopened.reading)
        if case .measured = measured {} else {
            Issue.record("measuring left the room reading \(measured)")
        }
    }

    /// A window that switches Project must never go on drawing the last one's map (ADR-0015).
    @Test
    func `switching Project drops the map of the one being left`() async throws {
        let (model, rootURL) = try fixture()
        await model.rebuild(project("argo", at: rootURL))

        await model.open(project("cockpit", at: rootURL))

        #expect(model.reading == .unmeasured)
    }
}
