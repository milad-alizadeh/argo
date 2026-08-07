import ArgoUI
import SwiftUI

/// The whole app: one window, SwiftUI lifecycle, no AppDelegate.
@main
struct ArgoApp: App {
    var body: some Scene {
        Window("Argo", id: "cockpit") {
            CockpitView()
        }
        .defaultSize(width: 1280, height: 800)
    }
}
