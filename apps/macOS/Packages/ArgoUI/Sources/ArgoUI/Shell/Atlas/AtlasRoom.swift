import AtlasLayout
import SwiftUI

/// The Atlas room, assembled: what has been measured of the active Project, and the one lever the
/// reader has over it (#1140, #1162 settles the rest).
///
/// One value rather than a reading and an action apart, for `TicketsRoom`'s reason: they cross one
/// seam, and a deck handed one without the other would draw a map nothing can rebuild.
///
/// `@MainActor` for `TicketsRoom`'s other reason: it holds the room's one verb, and a closure a
/// control calls is not `Sendable`.
@MainActor
package struct AtlasRoom {
    package let reading: AtlasReading
    /// The Project the map is of, named in the room's strip and in every vacancy sentence.
    package let project: CockpitPresentation.Project?
    /// Measure the Project again. The map is generated on demand and nothing watches the file
    /// system, so this is the whole of what makes a stale map current (#1140).
    package let rebuild: () -> Void
}

/// What the room has to draw. Four states, because they are four different instructions: nothing
/// measured yet says what would fix it, measuring says the wait is work rather than a hang, and a
/// file that will not read says the Project is not at fault.
package enum AtlasReading: Equatable {
    /// No Project is active, so there is no repository to measure.
    case noProject
    /// A Project with no Map file yet.
    case unmeasured
    /// The walk is running.
    case measuring
    case measured(AtlasMap)
    /// The Map file is there and could not be read. Carries what the reader is told, not the
    /// decoder's own words.
    case unreadable
}

package extension EnvironmentValues {
    /// The Atlas room the deck draws. In the environment rather than threaded down for
    /// `argoTicketAddress`'s reason, sharpened by a gate: `InstrumentDeckShell`'s initializer sits
    /// ON the parameter cap's grandfathered width, and that ratchet only ever descends (#1148).
    /// `nil` is a window that has resolved no room — a preview, a specimen, and every room but
    /// this one. The view draws that as the Project it has none of.
    @Entry var argoAtlasRoom: AtlasRoom?
}
