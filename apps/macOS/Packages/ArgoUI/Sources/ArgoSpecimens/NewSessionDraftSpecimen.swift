import ArgoEngine
import ArgoUI
import SwiftUI

struct NewSessionDraftSpecimen: View {
    enum State {
        case ready
        case loading
        case unavailable
    }

    let state: State
    @SwiftUI.State private var navigation = CockpitNavigationModel()

    var body: some View {
        CockpitView(presentation: .emptyPreview, actions: actions)
            .environment(navigation)
            .task { navigation.prepareNewSession() }
    }

    private var actions: CockpitActions {
        var actions = CockpitActions(drive: InMemorySessionDriver())
        actions.sessions.prepare = { harness, _ in
            switch state {
            case .ready: break
            case .loading: try await Task.sleep(for: .seconds(30))
            case .unavailable:
                if harness != .claude {
                    throw AgentSpawnError.executableNotFound(command: "codex")
                }
            }
            return SessionPreparation(
                harness: .claude,
                catalog: .claude,
                run: .unpicked,
                mode: .code,
            )
        }
        return actions
    }
}
