import SwiftUI

/// The two approved bounded glass vessels in the native toolbar.
struct ShellToolbar: ToolbarContent {
    @Binding var room: CockpitRoom
    let presentation: CockpitPresentation
    let actions: CockpitActions

    @ToolbarContentBuilder var body: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            RoomsVessel(selection: $room)
        }
        ToolbarSpacer(.flexible, placement: .principal)
        ToolbarItemGroup(placement: .principal) {
            GitVessel(checkout: presentation.checkout, refresh: actions.refreshCheckout)
        }
    }
}
