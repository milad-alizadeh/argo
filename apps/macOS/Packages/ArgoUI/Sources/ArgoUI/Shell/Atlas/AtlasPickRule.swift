import AtlasLayout
import AtlasView

/// What a click on the map means, decided apart from the view that draws it (#1153, #1154, #1156).
///
/// A rule rather than three branches inside a `View`: this is the seam the whole descent turns on —
/// a folder is a place to go and a file is a thing to read — and a decision spelled inside a body
/// is a decision no test can ask about. `AtlasPickRuleTests` is what asks.
enum AtlasPickRule {
    /// The three things a pick can do. `close` is a real answer rather than the absence of one:
    /// clicking the ground puts a reading away, which is one of the three ways out of it.
    enum Outcome: Equatable {
        /// Go into a folder.
        case enter(String)
        /// Open a file's reading, or close it where that file is already the open one.
        case read(String)
        /// Put the reading away.
        case close
    }

    /// What the pick at one pixel changes, against where the reader is standing.
    ///
    /// **The plate you are standing on is the ground.** Clicking it closes the reading, exactly as
    /// clicking off the map does — a descent into the folder you are already in would re-tile
    /// nothing and read as a click that did nothing at all.
    ///
    /// That is the FOLDER's path, not the outermost plate's: where a folder holds one folder and
    /// nothing else the tiler folds the run and draws one plate for the deepest of them
    /// (`AtlasTiler.folding(from:)`), so the outer plate of a folded map names a level BELOW the
    /// reader. Clicking it goes there, which is what its name says it does.
    /// `folder` is the level the reader is ON — the folder they descended into, or the Map's own
    /// root where they have descended into nothing. One path rather than an optional, because
    /// "nowhere" is not one of the places a reader can be standing.
    static func outcome(of picked: AtlasTarget?, standingIn folder: String) -> Outcome {
        switch picked {
        case let .folder(path) where path != folder:
            .enter(path)
        case let .file(path):
            .read(path)
        default:
            .close
        }
    }

    /// Whether the file a reader has open is still on the map they are about to be looking at.
    ///
    /// A reading is of a file, and a file the map no longer draws is a reading of nothing: the
    /// panel would empty itself and leave a marked row nobody can scroll to. `nil` is nothing open,
    /// which stays nothing open.
    static func stays(_ open: String?, on map: AtlasMap) -> Bool {
        guard let open else { return false }
        return map.plots.contains { $0.path == open }
    }
}
