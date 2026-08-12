@testable import ArgoEngine
import Foundation
import Testing

@Suite("Cockpit pointing")
struct CockpitPointingTests {
    private let launchDirectoryURL = URL(fileURLWithPath: "/Users/milad/Experiments/argo")
    private let argo = ProjectRecord(id: "argo", path: "/Users/milad/Developer/argo")
    private let cockpit = ProjectRecord(id: "cockpit", path: "/Users/milad/Developer/cockpit")

    @Test
    func `a launch points the Hub at what it resolved to, transcripts and all`() {
        let move = idle.moved(by: .launched(.registered(argo), reading: registry()))

        #expect(move.pointing.launch == .registered(argo))
        #expect(move.pointing.launchOrigin == .registered(argo))
        #expect(move.hub == .connect(url: argo.url, carryingLaunchTranscripts: true))
    }

    /// The named transcripts are an override for the folder they were named with, so they do not
    /// travel onto a Project the user switched to afterwards.
    @Test
    func `switching away from the launch target leaves its transcripts behind`() {
        let move = launched(at: .registered(argo)).moved(by: .selected(id: cockpit.id))

        #expect(move.hub == .connect(url: cockpit.url, carryingLaunchTranscripts: false))
    }

    @Test
    func `switching to a registered Project activates it and re-points`() {
        let move = launched(at: .registered(argo)).moved(by: .selected(id: cockpit.id))

        #expect(move.pointing.launch == .registered(cockpit))
        #expect(move.activates == cockpit.id)
        #expect(move.pointing.registry.activeProjectID == cockpit.id)
    }

    /// The unregistered launch target is the only way back to where the process was pointed, and
    /// going back there registers nothing.
    @Test
    func `switching to the launch origin re-points without touching the registry`() {
        let origin = LaunchProject.unregistered(launchDirectoryURL)
        let pointing = launched(at: origin).moved(by: .selected(id: argo.id)).pointing

        let move = pointing.moved(by: .selected(id: origin.id))

        #expect(move.pointing.launch == origin)
        #expect(move.activates == nil)
        #expect(move.pointing.registry == pointing.registry)
        #expect(move.hub == .connect(url: launchDirectoryURL, carryingLaunchTranscripts: true))
    }

    @Test
    func `selecting the mark already on screen moves nothing`() {
        let pointing = launched(at: .registered(argo))

        let move = pointing.moved(by: .selected(id: argo.id))

        #expect(move.pointing == pointing)
        #expect(move.hub == .unchanged)
    }

    /// A mark the strip cannot draw is a mark nothing can select — but an id from a stale action
    /// closure still arrives here, and it must not blank the window.
    @Test
    func `selecting an id neither the registry nor the launch knows moves nothing`() {
        let pointing = launched(at: .registered(argo))

        #expect(pointing.moved(by: .selected(id: "gone")).hub == .unchanged)
    }

    /// Registering and relocating both end here, so the registry's active Project is the mark on
    /// screen rather than whatever the last launch left behind.
    @Test
    func `a folder that landed becomes the active Project as well as the mark on screen`() {
        let move = launched(at: .registered(argo))
            .moved(by: .landed(on: cockpit, leaving: registry()))

        #expect(move.pointing.launch == .registered(cockpit))
        #expect(move.activates == cockpit.id)
        #expect(move.hub == .connect(url: cockpit.url, carryingLaunchTranscripts: false))
    }

    /// A registration or relocation the store refused answers no record. The registry it left is
    /// still held — the window stays where it is rather than going stale against the file.
    @Test
    func `a landing with no record holds the registry and moves nothing`() {
        let pointing = launched(at: .registered(argo))
        let refused = ProjectRegistry(projects: [argo], activeProjectID: argo.id)

        let move = pointing.moved(by: .landed(on: nil, leaving: refused))

        #expect(move.pointing.launch == .registered(argo))
        #expect(move.pointing.registry == refused)
        #expect(move.activates == nil)
        #expect(move.hub == .unchanged)
    }

    @Test
    func `removing a Project the window is not on leaves the window where it is`() {
        let pointing = launched(at: .registered(argo))
        let remaining = ProjectRegistry(projects: [argo], activeProjectID: argo.id)

        let move = pointing.moved(by: .removed(cockpit, leaving: remaining))

        #expect(move.pointing.launch == .registered(argo))
        #expect(move.pointing.registry == remaining)
        #expect(move.hub == .unchanged)
    }

    @Test
    func `removing the Project on screen lands on the registry's new active one`() {
        let pointing = launched(at: .registered(argo))
        let remaining = ProjectRegistry(projects: [cockpit], activeProjectID: cockpit.id)

        let move = pointing.moved(by: .removed(argo, leaving: remaining))

        #expect(move.pointing.launch == .registered(cockpit))
        #expect(move.activates == nil)
        #expect(move.hub == .connect(url: cockpit.url, carryingLaunchTranscripts: false))
    }

    /// There is no Project left to read, so the Hub is let go rather than pointed at a folder the
    /// registry has just been told to forget.
    @Test
    func `removing the last Project leaves an unregistered pointer and disconnects`() {
        let pointing = launched(at: .registered(argo))

        let move = pointing.moved(by: .removed(argo, leaving: .empty))

        #expect(move.pointing.launch == .unregistered(argo.url))
        #expect(move.pointing.registry == .empty)
        #expect(move.activates == nil)
        #expect(move.hub == .disconnect)
    }

    /// Otherwise the strip draws the same repository twice, once as the launch and once as the
    /// record — which is what `LaunchProject.resolve` is asked before the pointing starts.
    @Test
    func `a launch inside a registered repo points at that repo's record`() {
        let configuration = LaunchConfiguration(
            launchDirectoryURL: launchDirectoryURL,
            projectOverrideURL: argo.url,
            transcriptURLs: [],
        )

        let origin = LaunchProject.resolve(configuration: configuration, registry: registry())
        let move = idle.moved(by: .launched(origin, reading: registry()))

        #expect(move.pointing.launch == .registered(argo))
        #expect(move.pointing.launchOrigin == .registered(argo))
    }

    /// What the coordinator holds before the registry has been read.
    private var idle: CockpitPointing {
        CockpitPointing(
            registry: .empty,
            launch: .unregistered(launchDirectoryURL),
            launchOrigin: nil,
        )
    }

    private func launched(at origin: LaunchProject) -> CockpitPointing {
        idle.moved(by: .launched(origin, reading: registry())).pointing
    }

    private func registry() -> ProjectRegistry {
        ProjectRegistry(projects: [argo, cockpit], activeProjectID: argo.id)
    }
}
