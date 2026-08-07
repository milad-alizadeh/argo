import Foundation

/// What a Hub's sweep is running against: the Project to find Sessions for, and the engine that
/// opens the ones it finds.
///
/// Held rather than re-derived because discovery outlives `connect`. A transcript written an hour
/// later is opened by the same engine against the same Project, and neither is reachable from the
/// working set itself.
struct HubSweep {
    let engine: Engine
    let projectURL: URL
}
