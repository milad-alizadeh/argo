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
/// — grouped for the reason `AtlasMapChoice` is, and because they are one thought: #1162 says a
/// map is stale, and #1140's rebuild is the whole of what a reader does about it.
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
/// apart from the room's other facts.
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
    /// The design's Filters section, both switches. Grouped rather than spread over this value
    /// for the reason this value is grouped out of `AtlasRoom` — and because four is the cap on a
    /// parameter list (`apps/macOS/.swiftlint.yml`), read onto the one declaration shape SwiftLint
    /// cannot see.
    package let filters: AtlasFilterChoice
    /// The design's Arrangement section, both rows: what the regions of the map ARE, and which of
    /// the two readings of them is drawn (#1158, #1152).
    package let arrangement: AtlasArrangementChoice

    package init(
        channels: AtlasChannels,
        setChannels: @escaping (AtlasChannels) -> Void,
        filters: AtlasFilterChoice,
        arrangement: AtlasArrangementChoice,
    ) {
        self.channels = channels
        self.setChannels = setChannels
        self.filters = filters
        self.arrangement = arrangement
    }

    /// The Map as it is DRAWN — the measured Map with the reader's filters applied, and re-rooted
    /// on its Domains where they asked for that (#1158).
    ///
    /// Both columns ask this rather than each spelling the filter out: a second spelling is a
    /// second place to forget the next filter, and the sidebar's own numbers would then be
    /// describing a map the stage is not drawing. Hiding test files re-reads the repository
    /// without them (#1161), so everything said about the map has to be said about the same one.
    ///
    /// The filter runs FIRST and the regroup second: hiding the tests changes which files there
    /// are, and a region is the files it holds — regrouping first would tile regions round files
    /// the map is not drawing and leave empty ones behind.
    package func drawn(_ map: AtlasMap) -> AtlasMap {
        arranged(filtered(map))
    }

    /// One already-filtered Map, arranged the way the reader asked — re-rooted on its Domains, or
    /// left as it is.
    ///
    /// Apart from `filtered(_:)` so a caller that needs both readings pays for the filter once:
    /// hiding the tests rebuilds the whole tree, and the sidebar reads the filtered Map for what
    /// it can be grouped by and the arranged one for everything else.
    package func arranged(_ filtered: AtlasMap) -> AtlasMap {
        guard grouping(of: filtered) == .domains else { return filtered }
        return filtered.regrouped() ?? filtered
    }

    /// The measured Map with the reader's filters applied and NOTHING else — the repository as
    /// they left it, before anything decided how to arrange it.
    ///
    /// Its own step because the inference travels with the Plots: hiding the tests narrows the
    /// Domains too, so whether this Map can be grouped by domain at all is a question about this
    /// value rather than about the one that was measured.
    package func filtered(_ map: AtlasMap) -> AtlasMap {
        filters.hideTests.isOn ? map.excludingTestFiles() : map
    }

    /// How a Map is really grouped: the reader's choice held against what that Map can answer —
    /// `.folders` for a Map with no partition, whatever the choice says.
    ///
    /// The same seam `AtlasChannels.held(over:)` is spent at, for the same reason: a choice made
    /// over one Map meets another when the filter changes or the Project is measured again, and a
    /// map told to draw a partition it has none of would draw one grey region that the reader
    /// would read as a finding.
    package func grouping(of map: AtlasMap) -> AtlasGrouping {
        map.canRegroup ? arrangement.grouping : .folders
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
            filters: AtlasFilterChoice(
                hideTests: AtlasSwitch(isOn: false) { _ in },
                showTies: AtlasSwitch(isOn: false) { _ in },
            ),
            arrangement: AtlasArrangementChoice(
                grouping: .folders,
                setGrouping: { _ in },
                isCity: AtlasSwitch(isOn: false) { _ in },
            ),
        )
    }
}

/// What the map's regions are, and which of the two readings of them is drawn: the design's own
/// Arrangement section as one value (#1158, #1152).
///
/// The two are one section and one view draws them, but they are not the same KIND of decision —
/// Group by changes what the map is a picture OF, and View changes the camera over the picture.
/// They are together for `AtlasFilterChoice`'s reason: one section, one column, one view.
@MainActor
package struct AtlasArrangementChoice {
    /// Folders, or the subjects the inference guessed at. What the reader ASKED for — `held`
    /// against what the Map can answer by `AtlasMapChoice.grouping(of:)`, which is the value
    /// anything drawing the map reads.
    package let grouping: AtlasGrouping

    /// Re-tile the map. Nothing is kept past this window closing: how a reader is looking at a
    /// repository is not a fact about it, which is `isCity`'s rule and this one's.
    package let setGrouping: (AtlasGrouping) -> Void

    /// Whether the map is drawn as the city or as the treemap.
    package let isCity: AtlasSwitch

    package init(
        grouping: AtlasGrouping,
        setGrouping: @escaping (AtlasGrouping) -> Void,
        isCity: AtlasSwitch,
    ) {
        self.grouping = grouping
        self.setGrouping = setGrouping
        self.isCity = isCity
    }
}

/// What is left off the map, and what is drawn over it: the design's own Filters section as one
/// value (#1161, #1160).
///
/// The two are not the same KIND of decision — hiding test files changes what the repository is
/// for the purposes of the reading, and the ties are laid over a reading that is the same either
/// way — but they are one section of one column, and the view that draws them takes both.
@MainActor
package struct AtlasFilterChoice {
    /// Whether test files are left off the map.
    package let hideTests: AtlasSwitch
    /// Whether the strongest co-change ties are drawn across the whole map (#1160). A pinned
    /// file's own are drawn however this is set: the reader pointed at a file and asked a question
    /// the switch does not answer.
    package let showTies: AtlasSwitch

    package init(hideTests: AtlasSwitch, showTies: AtlasSwitch) {
        self.hideTests = hideTests
        self.showTies = showTies
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

    /// What was written about the Project's files (#1159). Its OWN entry rather than a field on
    /// `AtlasRoom`, which is the written layer's own rule kept where a reviewer can see it: the
    /// map is drawn from the measurement alone, this arrives from a second file that is fetched
    /// separately and may never arrive at all, and the room a window resolved none of draws
    /// exactly the room it drew before.
    ///
    /// `.none` rather than an optional, because a Project nobody has written about and a written
    /// layer nobody has fetched are the same instruction to the panel: say nothing extra.
    @Entry var argoAtlasNotes: AtlasNotes = .none
}
