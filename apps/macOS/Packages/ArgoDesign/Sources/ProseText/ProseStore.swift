import Foundation
import os
import Synchronization

/// A `ProseCache` any thread may read and fill.
///
/// The whole-document measure pass runs off the main actor and splits its rows across cores
/// (ADR-0030, Rule 3), so every store the measure touches is reached from several threads at once
/// while the main thread draws out of the same one. The stores were `@MainActor` statics until
/// then, which is the isolation this replaces — not because the state stopped being shared, but
/// because the main actor stopped being where it is used.
///
/// The lock is never held across the read. A `ProseCache.reading` that computed under the lock
/// would serialise every Core Text pass in the document behind one mutex, which is the whole of
/// what the pass was made parallel for — so a miss looks the answer up, computes it OUTSIDE, and
/// puts it back. Two threads that miss on one string both typeset it and store equal answers,
/// which costs one duplicated pass and keeps the pass parallel.
///
/// A `Mutex` and not a lock beside a `nonisolated(unsafe)` field: a mutex OWNS the state it
/// guards, so the guarantee is the compiler's rather than a promise nothing checks
/// (`rules/swift-style.md`). It is `~Copyable` for the same reason, which is why every store here
/// is a `let` rather than a value anything hands around.
///
/// `Value: Sendable` follows from that, and it is what draws the line around WHICH readings can be
/// kept here: a mutex may only hand out state that is allowed to cross a thread, and a `CTLine` is
/// not. The two readings that hold one — a typeset run, and a placed prose frame — are kept on the
/// main actor by the surfaces that draw them, and computed uncached where the measure pass asks
/// for them off it. See `ProseMetrics.typeset(_:across:in:)`.
public struct ProseStore<Value: Sendable>: ~Copyable, Sendable {
    private let cache: Mutex<ProseCache<Value>>

    public init(ceiling: Int = 512, cap: Int = 8192) {
        self.cache = Mutex(ProseCache(ceiling: ceiling, cap: cap))
    }

    public func reading(of text: String, read: (String) -> Value) -> Value {
        if let known = cache.withLock({ $0.peek(text) }) {
            return known
        }
        #if DEBUG
            ProseStoreReads.counting?.withLock { $0 += 1 }
        #endif
        let reading = read(text)
        cache.withLock { $0.store(reading, of: text) }
        return reading
    }

    /// What is held for `text` and nothing else — no read, no store. The one ask a caller that
    /// cannot compute the answer where it stands is allowed to make: `ProseLineBox` off the main
    /// actor, where the answer comes from a hosting ruler.
    public func held(_ text: String) -> Value? {
        cache.withLock { $0.holding(text) }
    }

    /// See `ProseCache.hold(atLeast:)`.
    public func hold(atLeast entries: Int) {
        cache.withLock { $0.hold(atLeast: entries) }
    }

    /// Everything held, dropped — the ceiling kept, because it is a fact about the document being
    /// walked rather than about what was measured.
    public func empty() {
        cache.withLock { held in
            let ceilings = (ceiling: held.ceiling, cap: held.cap)
            held = ProseCache(ceiling: ceilings.ceiling, cap: ceilings.cap)
        }
    }

    #if DEBUG
        public var cost: ProseCacheCost {
            cache.withLock { $0.cost }
        }
    #endif
}

/// One store per MEASURE, and one lock over the lot of them.
///
/// Several measures are in use at once — the reading's column, the inside of a prompt's bubble, one
/// per table column — so a single store would be emptied by every row that followed a table. Held
/// to a handful and then dropped whole, because a seam under the reader's finger asks at a
/// different measure every frame.
///
/// The lock covers the DICTIONARY and never the read: a miss takes the answer outside it, exactly
/// as `ProseStore` does and for the same reason.
public struct ProseMeasuredStore<Value: Sendable>: ~Copyable, Sendable {
    private let stores: Mutex<[CGFloat: ProseCache<Value>]>
    /// How many measures are kept before the lot is dropped.
    private let measuresHeld: Int
    /// The floor every store here is opened at, raised by `hold(atLeast:)`. Kept beside the stores
    /// rather than in them because a measure that arrives LATER — a seam let go at a fresh width,
    /// the first paint after a room switch — opens its store after the walk that holds it and
    /// would otherwise open at the literal, which is the ceiling ADR-0028 Rule 4 forbids.
    private let holding: Mutex<Int>

    public init(measuresHeld: Int = 8) {
        self.stores = Mutex([:])
        self.measuresHeld = measuresHeld
        self.holding = Mutex(0)
    }

    public func reading(
        of text: String,
        across measure: CGFloat,
        ceiling: Int = 512,
        read: (String) -> Value,
    )
        -> Value {
        if let known = stores.withLock({ $0[measure]?.peek(text) }) {
            return known
        }
        let reading = read(text)
        stores.withLock { held in
            if held[measure] == nil, held.count >= measuresHeld {
                held.removeAll()
            }
            var store = held[measure]
                ?? ProseCache<Value>(ceiling: max(ceiling, holding.withLock { $0 }))
            store.store(reading, of: text)
            held[measure] = store
        }
        return reading
    }

    /// Every measure's store held to what a whole-document walk is about to cross, and every
    /// store opened after it too.
    public func hold(atLeast entries: Int) {
        holding.withLock { $0 = max($0, entries) }
        stores.withLock { held in
            for measure in held.keys {
                held[measure]?.hold(atLeast: entries)
            }
        }
    }

    public func empty() {
        stores.withLock { $0.removeAll() }
    }
}

/// One Sendable value behind a lock — the counters and the epochs beside the stores above.
///
/// A class rather than a `Mutex`, because these are the values that have to be COPIED: an epoch is
/// compared, and a tally is carried into a task local, and a mutex is `~Copyable` by construction.
/// Its lock owns its state the same way, so the `Sendable` here is checked rather than promised.
public final class ProseTally<Value: Sendable>: Sendable {
    private let held: OSAllocatedUnfairLock<Value>

    public init(_ value: Value) {
        self.held = OSAllocatedUnfairLock(initialState: value)
    }

    public func withLock<Answer: Sendable>(_ work: @Sendable (inout Value) -> Answer) -> Answer {
        held.withLock { work(&$0) }
    }
}

#if DEBUG
    /// What ONE caller had to READ across every `ProseStore` in the process — the misses it paid,
    /// counted over its own work and nothing else.
    ///
    /// The cost a store carries is the PROCESS's, and since ADR-0030 the whole-document measure
    /// pass fills these stores from other threads: a case reading a store's counter either side of
    /// its own walk is counting somebody else's document. A task local is the scope the answer is
    /// true in — the pass's own child tasks inherit it, and every other task does not.
    ///
    /// Out here rather than on `ProseStore` because a generic type may hold no static of its own,
    /// and the question is about the caller rather than about one store anyway.
    public enum ProseStoreReads {
        public static func during(_ work: () -> Void) -> Int {
            let own = ProseTally(0)
            $counting.withValue(own) { work() }
            return own.withLock { $0 }
        }

        @TaskLocal static var counting: ProseTally<Int>?
    }
#endif
