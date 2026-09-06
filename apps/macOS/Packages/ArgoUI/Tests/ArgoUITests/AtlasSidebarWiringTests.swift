import AppKit
@testable import ArgoUI
import AtlasLayout
import Foundation
import Testing

/// The Atlas room reaches BOTH columns of the split view (#1489).
///
/// The room is handed down the environment, and the sidebar and the detail are siblings — so a
/// room injected into either one of them reaches nothing in the other. It was on the detail, which
/// left `AtlasSidebar` drawing its strip and no section at all however much had been measured, and
/// looking exactly like the room with nothing measured in it.
///
/// Held through the SHELL rather than through `AtlasRoomHost`, because the host was never wrong:
/// it injects above its own split view, which is what made the specimens right while the app was
/// empty. What is asserted is the shell's own wiring, which is `HostedCockpit`'s whole reason.
///
/// The three channel menus and the two filter switches are read off AppKit rather than counted in
/// SwiftUI: `Picker` and `Toggle` are the two controls in that column the platform draws views for,
/// so their presence is the one thing a suite with no screenshot can say about what the reader
/// would see there.
@MainActor
@Suite("Atlas sidebar — the room reaches the column", .serialized)
struct AtlasSidebarWiringTests {
    /// A repository with one file in it, measured, and the shell opened on it.
    private func opened() async throws -> HostedCockpit {
        let (model, rootURL) = try AtlasRoomFixture.room()
        let repositoryURL = rootURL.appending(path: "argo", directoryHint: .isDirectory)
        try AtlasRoomFixture.makeRepository(at: repositoryURL)
        try AtlasRoomFixture.commitFile("a.swift", saying: "let a = 1\n", in: repositoryURL)
        let project = AtlasRoomFixture.project("argo", at: rootURL)
        await model.rebuild(project)
        guard case .measured = model.reading else {
            Issue.record("The fixture repository measured no Map: \(model.reading)")
            throw AtlasSidebarWiringFailure.unmeasured
        }
        let shell = HostedCockpit(showing: Self.presentation(of: project), atlas: model)
        shell.visit(.atlas)
        await shell.settle()
        return shell
    }

    /// Encoding's three menus, drawn beside a Map the room has measured. Three rather than
    /// non-empty: a column that resolved the room but drew one section would pass a weaker claim.
    @Test func `the sidebar draws the channel menus beside a measured map`() async throws {
        let shell = try await opened()

        #expect(Self.views(named: "SwiftUIPopupButton", in: shell.host).count == 3)
    }

    /// And Filters' two switches, which is the same claim through the other control the platform
    /// draws: one section resolving and another not would be a different defect from this one.
    @Test func `the sidebar draws the filter switches beside a measured map`() async throws {
        let shell = try await opened()

        #expect(Self.views(named: "PlatformSwitch", in: shell.host).count == 2)
    }

    /// And the same measured room from the Sessions room, where the column is still mounted and
    /// nobody can see it: the sections are the reader's, not the shell's, so a window sitting in
    /// another room pays no filter over the Map on every pass it takes.
    @Test func `the sidebar draws no section from another room`() async throws {
        let shell = try await opened()

        shell.visit(.sessions)
        await shell.settle()

        #expect(Self.views(named: "SwiftUIPopupButton", in: shell.host).isEmpty)
        #expect(Self.views(named: "PlatformSwitch", in: shell.host).isEmpty)
    }

    /// The window over one Project, which is what the room is scoped to (ADR-0015). No Session in
    /// it: the Atlas room draws no roster row, and a reading nothing asks for is a slower fixture.
    private static func presentation(
        of project: CockpitPresentation.Project,
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [project],
            activeProjectID: project.id,
            sessions: [],
            connection: .idle,
        )
    }

    /// Every view of a class by NAME, because the two the platform draws here are SwiftUI's own
    /// and neither is a type this target can name.
    private static func views(named name: String, in view: NSView) -> [NSView] {
        let here = String(describing: type(of: view)) == name ? [view] : []
        return here + view.subviews.flatMap { views(named: name, in: $0) }
    }
}

/// A fixture that measured nothing has nothing to say about the sidebar, and `Issue.record` above
/// is what reports it — this only stops the test.
private enum AtlasSidebarWiringFailure: Error {
    case unmeasured
}
