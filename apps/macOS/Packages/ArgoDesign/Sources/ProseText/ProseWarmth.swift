import Foundation

/// The faces an off-main ask found nothing measured for, collected so the caller can go and
/// measure them.
///
/// Three numbers in this module come off a hosting ruler and cannot come off anything else — a
/// face's line box, what an empty run of it collapses to, and how far its line hangs below its own
/// first baseline (`ProseLineBox`, `ProseBaseline`). A ruler is the main actor's; the
/// whole-document measure pass is not (ADR-0030, Rule 3). The pass therefore runs, notes every face
/// it could not be answered for, warms those on the main actor and runs again — rather than warming
/// a NAMED list up front, which would be a list that silently falls behind the faces the feed sets
/// and answers the row that outgrew it with a number off the wrong engine.
///
/// A task local, because the pass splits its rows across a task group and a task local is what
/// every child of one inherits. `nil` everywhere else: a main-actor ask measures where it stands
/// and owes nobody anything.
public final class ProseWarmth: Sendable {
    @TaskLocal public static var owed: ProseWarmth?

    private let faces = ProseTally<[String: ProseFace]>([:])

    public init() {}

    /// Every face owed, once each. Keyed by the same name the probes are keyed by, so two rows
    /// wanting the same face owe one measurement.
    public var owing: [ProseFace] {
        faces.withLock { Array($0.values) }
    }

    public var isEmpty: Bool {
        faces.withLock { $0.isEmpty }
    }

    func owe(_ face: ProseFace) {
        faces.withLock { $0[face.key] = face }
    }
}
