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
    /// How current the drawn Map is, and the one lever that makes it current again.
    package let currency: AtlasCurrency
    /// What the reader has chosen of the map: what it measures, what it leaves out, and which of
    /// the two views it is drawn as (#1161, #1152).
    package let choice: AtlasMapChoice

    package init(
        reading: AtlasReading,
        project: CockpitPresentation.Project?,
        currency: AtlasCurrency,
        choice: AtlasMapChoice,
    ) {
        self.reading = reading
        self.project = project
        self.currency = currency
        self.choice = choice
    }
}

/// How far the drawn Map is behind the repository it measured, and the gesture that closes the gap
/// — grouped for the reason `AtlasMapChoice` is (`swift-boundaries.sh` edge 6), and because they
/// are one thought: #1162 says a map is stale, and #1140's rebuild is the whole of what a reader
/// does about it.
@MainActor
package struct AtlasCurrency {
    /// How many commits the repository has taken since the drawn Map was measured. `nil` where the
    /// reading has no Map, or where nothing can be said about its age (#1162).
    package let behind: Int?
    /// Measure the Project again. The map is generated on demand and nothing watches the file
    /// system, so this is the whole of what makes a stale map current (#1140).
    package let rebuild: () -> Void

    package init(behind: Int? = nil, rebuild: @escaping () -> Void) {
        self.behind = behind
        self.rebuild = rebuild
    }
}

/// Everything the reader has decided about the map, and the write back for each — grouped rather
/// than spread over `AtlasRoom` itself, the way `CockpitPresentation.Session` groups a reading
/// apart from the room's other facts (`swift-boundaries.sh` edge 6).
///
/// The sidebar and the stage both read this. They are two columns of one split view, so a choice
/// held by either would be a choice the other could not see.
@MainActor
package struct AtlasMapChoice {
    /// The reader's own channels, or the opening reading where none has been chosen yet.
    package let channels: AtlasChannels
    /// Put new channels into effect. Never re-tiles by itself: the plan is recomputed from
    /// whatever this is set to wherever it is read, which is what makes a colour change a repaint
    /// and not a rebuild.
    package let setChannels: (AtlasChannels) -> Void
    /// Whether test files are left off the map.
    package let hideTests: AtlasSwitch
    /// Whether the map is drawn as the city or as the treemap.
    package let isCity: AtlasSwitch

    package init(
        channels: AtlasChannels,
        setChannels: @escaping (AtlasChannels) -> Void,
        hideTests: AtlasSwitch,
        isCity: AtlasSwitch,
    ) {
        self.channels = channels
        self.setChannels = setChannels
        self.hideTests = hideTests
        self.isCity = isCity
    }

    /// The Map as it is DRAWN — the measured Map with the reader's filters applied.
    ///
    /// Both columns ask this rather than each spelling the filter out: a second spelling is a
    /// second place to forget the next filter (#1160's Strongest ties lands in exactly this
    /// shape), and the sidebar's own numbers would then be describing a map the stage is not
    /// drawing. Hiding test files re-reads the repository without them (#1161), so everything said
    /// about the map has to be said about the same one.
    package func drawn(_ map: AtlasMap) -> AtlasMap {
        hideTests.isOn ? map.excludingTestFiles() : map
    }

    /// The choice a window that has resolved no room draws: every channel unnamed, every switch
    /// off, and every write a no-op. One declaration rather than the same four closures written
    /// out at each vacancy and in each preview.
    ///
    /// Computed rather than stored: a stored property's initializer is evaluated outside this
    /// type's own isolation, and these closures are not `Sendable`.
    package static var inert: AtlasMapChoice {
        AtlasMapChoice(
            channels: AtlasChannels(""),
            setChannels: { _ in },
            hideTests: AtlasSwitch(isOn: false) { _ in },
            isCity: AtlasSwitch(isOn: false) { _ in },
        )
    }
}

/// One boolean the reader owns, with the write that puts it into effect. A pair rather than a
/// `Binding`, because the value is read from a container and the write goes through its own verb —
/// which is what keeps a choice persisted where it has to be.
@MainActor
package struct AtlasSwitch {
    package let isOn: Bool
    package let set: (Bool) -> Void

    package init(isOn: Bool, set: @escaping (Bool) -> Void) {
        self.isOn = isOn
        self.set = set
    }

    /// The pair as one binding, for a control that takes one.
    package var binding: Binding<Bool> {
        Binding(get: { isOn }, set: set)
    }
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
