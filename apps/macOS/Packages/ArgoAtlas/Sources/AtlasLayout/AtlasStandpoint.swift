import CoreGraphics

/// Where the reader is standing over one Map, and the two answers that follow from it (#1490).
///
/// **The tiling comes from the Map, never from the folder.** That is the whole of this type: a
/// descent used to re-root the Map ahead of the tiler (#1156), so every level got a layout of its
/// own at a scale of its own in the same frame, and two consecutive frames of a descent shared no
/// rectangle — nothing for a camera to move between. There is ONE tiling now, laid out from the
/// repository's root and never rebuilt, and going into a folder moves the camera instead
/// (`docs/designs/cockpit-atlas.html`, "WHY NOTHING RE-TILES ANY MORE").
///
/// The reader's SCOPE did not go with it. What is said in words — the index beside the map, the
/// reading of the open file, the trail naming where they are — is still of the folder they are in,
/// and `inside` is that Map. Two answers from one value, so the picture and the words cannot come
/// to disagree about which folder that is.
public struct AtlasStandpoint: Equatable, Sendable {
    /// The Map as the reader's filters leave it, and the one thing tiled.
    public let map: AtlasMap

    /// The folder they have descended into, or nothing for the whole repository.
    public let folder: String?

    public init(on map: AtlasMap, standingIn folder: String? = nil) {
        self.map = map
        self.folder = folder
    }

    /// The tiling: of the whole Map, at every depth. The folder is not a parameter of it and cannot
    /// become one — which is what makes a descent a camera move rather than a reflow.
    ///
    /// `grouping` says what the Plates this Map arrives with ARE, and nothing here re-tiles by it
    /// either: re-rooting a Map on its Domains is `AtlasMap.regrouped()`'s, done before the Map
    /// reaches this value at all (#1158). What it settles is the third channel of a domain map —
    /// which Domain a file was placed in, and how surely — because that is the one fact a
    /// re-rooted Map no longer says by its shape alone.
    public func plan(
        by channels: AtlasChannels,
        into extent: CGSize,
        grouping: AtlasGrouping = .folders,
    )
        -> AtlasPlan {
        AtlasPlan(tiling: map, by: channels, into: extent, grouping: grouping)
    }

    /// The Map of the folder they are standing in — what the index, the reading and every number
    /// said in words are of.
    ///
    /// The whole Map where the descent has gone out from under them, which is what
    /// `descending(to:)` answering nothing means and where `trail(to:)` puts them too.
    public var inside: AtlasMap {
        folder.flatMap { map.descending(to: $0) } ?? map
    }

    /// The folders from the root down to where they are, root first. Read off the whole Map rather
    /// than off `inside`, because a trail is the way in and `inside` has already taken it.
    public var trail: [AtlasStep] {
        map.trail(to: folder)
    }

    /// The level they are ON, as one path rather than an optional: "nowhere" is not one of the
    /// places a reader can be standing, and the Map's own root is where a reader who has descended
    /// into nothing is.
    public var here: String {
        folder ?? map.root.path
    }
}
