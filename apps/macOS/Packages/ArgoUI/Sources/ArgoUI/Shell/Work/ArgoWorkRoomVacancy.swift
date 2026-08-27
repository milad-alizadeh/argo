import SwiftUI

/// What the Work room's vacancy panel is measured at (`docs/designs/cockpit-work-room.md` — the
/// room's own states). Beside the surface rather than in the contract: a measure read by one
/// surface is not a token (`rules/design-system.md`).
enum ArgoWorkRoomVacancy {
    /// The panel's measure. Narrow on purpose and unrelated to `ArgoFeedRow.column`: this is two
    /// centred sentences rather than a body of prose, and at the deck's full width they would set
    /// as one line each and stop reading as a paragraph.
    static let panelWidth: CGFloat = 460
}
