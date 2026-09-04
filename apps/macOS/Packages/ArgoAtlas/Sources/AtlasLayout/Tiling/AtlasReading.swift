/// What the tiler is allowed to read a Measure as. The one place a value is judged usable, so
/// nothing downstream of it has to ask again.
///
/// JSON has no literal for a value that is not a finite number, so a Map that was READ cannot carry
/// one. A Map built in memory can: nothing stops a caller handing `AtlasPlot` a division that went
/// somewhere. A NaN weight sinks a whole subtree silently — `max` returns it, the tiler's own
/// `total > 0` guard then fails, and every file under that Plate gets a zero rectangle with nothing
/// anywhere saying one went missing. So it is refused here, at the boundary, and reads as absent.
extension AtlasPlot {
    /// The Measure's value, or nothing when the Plot never carried it or carries a number no
    /// rectangle can be made from.
    func value(of measure: String) -> Double? {
        guard let value = measures[measure], value.isFinite else { return nil }
        return value
    }
}

extension AtlasMap {
    /// Every usable value of one Measure across the Map, in the order the file holds them.
    func values(of measure: String) -> [Double] {
        plots.compactMap { $0.value(of: measure) }
    }
}
