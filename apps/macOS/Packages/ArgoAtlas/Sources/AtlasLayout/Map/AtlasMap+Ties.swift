/// Which of a Map's Couplings the map DRAWS (#1160).
///
/// The counting keeps every pair either file held on to — 18,402 of them for this repository — and
/// a picture with 18,402 lines across it is a ball of wool. So the drawing chooses, and the
/// choosing is here rather than in the view: it is arithmetic over what was counted, it decides
/// what the reader is being shown, and a rule that lives in a `Canvas` is a rule no test can reach.
public extension [AtlasCoupling] {
    /// The strongest ties in the list, strongest first, one line per pair.
    ///
    /// This is what the Strongest ties switch draws. `cap` is stated beside that switch rather
    /// than left in here, because a picture that silently drops the 161st strongest tie is a
    /// picture making a claim about the repository it cannot keep.
    func strongest(cap: Int = AtlasCoupling.cap) -> [AtlasCoupling] {
        Array(AtlasCoupling.oncePerPair(sorted(by: AtlasCoupling.strongestFirst))
            .prefix(Swift.max(0, cap)))
    }

    /// The files one Plot keeps changing with, strongest first, at most `limit` of them.
    ///
    /// From EITHER end of the pair: a Coupling is one relation seen from two files, and the one
    /// whose path sorted second is no less tied for it.
    func ties(of path: String, limit: Int = AtlasCoupling.perFile) -> [AtlasCoupling] {
        filter { $0.first == path || $0.second == path }.strongest(cap: limit)
    }
}

public extension AtlasMap {
    /// The strongest ties across the whole map. The Map's own spelling of the choosing above, so
    /// no caller holding a Map has to reach past it for the list.
    func strongestTies(cap: Int = AtlasCoupling.cap) -> [AtlasCoupling] {
        couplings.strongest(cap: cap)
    }

    /// The files one Plot keeps changing with, which is what pinning it draws.
    func ties(of path: String, limit: Int = AtlasCoupling.perFile) -> [AtlasCoupling] {
        couplings.ties(of: path, limit: limit)
    }
}

public extension AtlasCoupling {
    /// The most ties the map draws at once. The prototype's own number, and the reason for it:
    /// nine hundred cords is a ball of wool, a hundred and sixty is a reading.
    static let cap = 160

    /// The most of one file's own ties the map draws when that file is pinned. Fewer, because they
    /// all leave one box: past a handful they stop being separate cords and become a fan.
    static let perFile = 6

    /// The two ends, in the one order neither of them decides: the pair as a KEY, so a Coupling
    /// stated `a`→`b` and one stated `b`→`a` are recognised as the one tie they are.
    var pair: String {
        first < second ? first + "\n" + second : second + "\n" + first
    }

    /// Strongest first, and where two are equally strong the paths break it. Swift's sort is not
    /// stable, so without the second term one Map would draw a different hundred and sixty on
    /// every repaint of the same measurement.
    static func strongestFirst(_ left: AtlasCoupling, _ right: AtlasCoupling) -> Bool {
        left.strength == right.strength ? left.pair < right.pair : left.strength > right.strength
    }

    /// One line per pair. A reversed twin is the same tie seen from the other end: drawing both
    /// lays a second stroke over the first and spends a slot in the cap on a line already there.
    ///
    /// The counting normalises its own output, so this only ever fires on a Map file written
    /// elsewhere — which is exactly why it is here. A Map is data, and a rule the drawing depends
    /// on cannot rest on the generator having been the one to write it.
    static func oncePerPair(_ couplings: [AtlasCoupling]) -> [AtlasCoupling] {
        var seen: Set<String> = []
        return couplings.filter { seen.insert($0.pair).inserted }
    }
}
