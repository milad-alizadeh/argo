/// A bounded store of readings, keyed by the string each was read from.
///
/// Emptied whole at the ceiling rather than evicted by age. An LRU would keep the right entries,
/// and keeping them is worth less than what its bookkeeping costs on every hit: a miss here is one
/// parse of one string, which is the cost this type exists to pay once rather than the cost it
/// exists to avoid entirely.
struct ProseCache<Value> {
    /// Enough for the visible rows of a long turn several times over, so a scroll and a drag both
    /// stay inside it — and small enough that a session read all day cannot grow without bound.
    let ceiling: Int

    private var readings: [String: Value] = [:]

    /// Spelled out rather than left to the memberwise one, which a private stored property makes
    /// private.
    init(ceiling: Int = 512) {
        self.ceiling = ceiling
    }

    mutating func reading(of text: String, read: (String) -> Value) -> Value {
        if let known = readings[text] {
            return known
        }
        if readings.count >= ceiling {
            readings.removeAll(keepingCapacity: true)
        }
        let reading = read(text)
        readings[text] = reading
        return reading
    }
}
