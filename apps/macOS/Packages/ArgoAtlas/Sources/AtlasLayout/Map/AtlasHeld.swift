/// What the Map file can spell back, said once (#1157).
///
/// A value the file cannot hold is a Map read that differs from the Map written, on a field
/// something downstream compares — which is how a measurement that changed nothing looks like a
/// rebuild. Every value type in the Map holds its own numbers to this on the way in, so the type
/// carries only what the file carries, and the number lives here rather than in each of them.
extension Double {
    /// Three decimals, which is what the Map file keeps. Fine enough to tell 0.001 from nothing at
    /// all — finer than any band a reader is offered — and rounding this repository's 18,402
    /// Couplings alone takes 105 KB off app data that is read on every open.
    var heldByTheMapFile: Double {
        (self * 1000).rounded() / 1000
    }
}
