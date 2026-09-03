/// A bounded store of readings, keyed by the string each was read from.
///
/// Evicted oldest-first at the ceiling, never emptied whole (ADR-0028 Rule 4). A whole-document
/// walker reaches this one: `FeedTableCoordinator.reading()` builds a `MinimapRow` per row and
/// every prose row asks `ProseReading.structure(of:)` for its shape. A store emptied at a ceiling
/// under the length of that walk arrives back at row 0 with nothing left of it, so every pass pays
/// every parse — a 4 000-row reading against a 512 literal emptied itself seven times a pass and
/// hit nothing.
///
/// So the ceiling is the DOCUMENT's and not a literal here: `hold(atLeast:)` raises it to the rows
/// a walk is about to cross, and `cap` is what keeps a session read all day bounded anyway.
public struct ProseCache<Value> {
    /// The most entries held at once. Raised to the document and never lowered — a short reading
    /// does not shrink the store a long one filled, and lowering it would evict for nothing.
    public private(set) var ceiling: Int

    /// What no document raises the ceiling past, and what makes an unbounded store impossible
    /// here: two readings of 4 096 rows, the one being read and the one behind it, so coming back
    /// to a session finds its shapes still held. Roughly a second copy of each of those two
    /// transcripts' prose — see `ProseReading` for the two stores it applies to, and
    /// `MermaidPlans` for the renderer's own.
    public let cap: Int

    private var readings: [String: Value] = [:]

    /// The keys in the order they were first read, oldest first, and how far eviction has consumed
    /// them. A cursor rather than `removeFirst`, which is linear in the store on every eviction.
    private var arrivals: [String] = []
    private var evicted = 0

    #if DEBUG
        /// What the store answered and what it had to read. DEBUG for the reason `FeedPaneCost`
        /// states, and what holds the working-set claim above to a measurement (ADR-0028 Rule 4).
        public private(set) var cost = ProseCacheCost()
    #endif

    /// Spelled out rather than left to the memberwise one, which a private stored property makes
    /// private.
    public init(ceiling: Int = 512, cap: Int = 8192) {
        self.ceiling = min(max(1, ceiling), cap)
        self.cap = cap
    }

    /// Held to what a whole-document walk is about to cross, so the walk does not evict its own
    /// head before it wraps. Raises only: several walks share these stores.
    public mutating func hold(atLeast entries: Int) {
        ceiling = min(cap, max(ceiling, entries))
    }

    public mutating func reading(of text: String, read: (String) -> Value) -> Value {
        if let known = peek(text) {
            return known
        }
        let reading = read(text)
        store(reading, of: text)
        return reading
    }

    /// What is held for `text`, and the hit or the miss counted for it. Split out of `reading`
    /// because the read itself is Core Text, which is the one thing a lock over this store may not
    /// be held across (`ProseStore`): the whole-document pass fills it from several threads at
    /// once, and a lock that covered the typesetting would make the pass serial again.
    /// What is held for `text`, counted for neither side. The ask a caller makes when it cannot
    /// compute the answer itself, so its miss is not a walk's miss — see `ProseStore.held(_:)`,
    /// and `ProseCacheCostTests`, which gates the counters this would inflate.
    public func holding(_ text: String) -> Value? {
        readings[text]
    }

    public mutating func peek(_ text: String) -> Value? {
        guard let known = readings[text] else {
            #if DEBUG
                cost.misses += 1
            #endif
            return nil
        }
        #if DEBUG
            cost.hits += 1
        #endif
        return known
    }

    /// One reading kept. Idempotent: two threads that missed on the same string both arrive here
    /// with the same answer, and the second overwrites the first with its equal.
    public mutating func store(_ reading: Value, of text: String) {
        let isFresh = readings.updateValue(reading, forKey: text) == nil
        guard isFresh else { return }
        arrivals.append(text)
        dropOldest()
    }

    /// The oldest readings dropped until the store is inside its ceiling.
    ///
    /// A key appears at most once ahead of the cursor: it is appended on a miss alone, and a miss
    /// means it was either never held or already dropped by the cursor going past it. So the key
    /// under the cursor is always the oldest live one.
    private mutating func dropOldest() {
        while readings.count > ceiling, evicted < arrivals.count {
            readings.removeValue(forKey: arrivals[evicted])
            evicted += 1
        }
        // Compacted once the consumed head is most of the list, which makes the whole eviction
        // amortised constant rather than the copy a per-eviction `removeFirst` would pay.
        guard evicted > arrivals.count / 2 else { return }
        arrivals.removeFirst(evicted)
        evicted = 0
    }
}

#if DEBUG
    /// What a store answered from what it held, against what it had to read — the counter ADR-0028
    /// Rule 4 asks for, so a claim about a working set is measured rather than asserted.
    public struct ProseCacheCost {
        public var hits = 0
        public var misses = 0

        public init() {}

        /// The share of the reads BETWEEN two readings of this counter that came off the store.
        /// A delta rather than a rate, because the stores are static and one process walks many
        /// documents through them. Nothing read is a rate of 1: nothing missed.
        public func hitRate(since opening: ProseCacheCost) -> Double {
            let held = hits - opening.hits
            let read = held + misses - opening.misses
            return read == 0 ? 1 : Double(held) / Double(read)
        }
    }
#endif
