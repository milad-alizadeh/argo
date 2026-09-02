import ArgoEngine
import Darwin
import Foundation

// What the retained event streams cost in memory, measured two ways — because neither way alone is
// honest about the number this file exists to hold down.
//
// The CENSUS walks the events and sums the characters their media payloads hold. Deterministic,
// allocator-free, and the only one a gate can assert on: it says exactly what the streams retain
// per picture and nothing about what the process happens to be doing. It undercounts by whatever
// Swift's own per-value overhead is, which is a per-picture constant and so cannot hide a payload.
//
// The FOOTPRINT is the process's own dirty and compressed pages — the number Activity Monitor
// shows and the one a user reports. It measures the whole process, so it is only ever read as a
// delta around one piece of work, and its noise is one-sided upward: the allocator keeps pages it
// has freed. Reported, never asserted.

/// Every picture any of these events carried, prompts and call results alike.
func mediaEvidence(in events: [TranscriptEvent]) -> [MediaEvidence] {
    events.flatMap { event -> [MediaEvidence] in
        switch event {
        case let .prompt(_, images, _):
            return images
        case let .toolCallOutcome(outcome):
            guard case let .media(media) = outcome.result else { return [] }
            return [media]
        default:
            return []
        }
    }
}

/// What these events RETAIN for their pictures.
func retainedMediaBytes(in events: [TranscriptEvent]) -> Int {
    mediaEvidence(in: events).reduce(0) { $0 + ($1.bytes?.retainedBytes ?? 0) }
}

/// The base64 those pictures are, whole — what an event stream retained before #989 addressed them
/// instead, and so the figure the census above is read against.
func mediaPayloadBytes(in events: [TranscriptEvent]) -> Int {
    mediaEvidence(in: events).reduce(0) { $0 + ($1.bytes?.count ?? 0) }
}

/// What the process has allocated and not freed — LIVE bytes, which is the number a retained event
/// stream is answerable for.
///
/// The footprint below cannot answer it: reading 161 MB of transcript churns several times its own
/// size of base64 and JSON through malloc, and freed pages stay dirty in the allocator's hands, so
/// the footprint reads the run's PEAK whatever the run retains. Measured across every zone, since
/// Swift's allocations land in more than the default one.
func liveHeapBytes() -> Int {
    var zones: UnsafeMutablePointer<vm_address_t>?
    var count: UInt32 = 0
    guard malloc_get_all_zones(mach_task_self_, nil, &zones, &count) == KERN_SUCCESS,
          let zones
    else { return 0 }
    var live = 0
    for index in 0 ..< Int(count) {
        let zone = UnsafeMutableRawPointer(bitPattern: UInt(zones[index]))
        var statistics = malloc_statistics_t()
        malloc_zone_statistics(zone?.assumingMemoryBound(to: malloc_zone_t.self), &statistics)
        live += statistics.size_in_use
    }
    return live
}

/// The process's dirty and compressed pages, in bytes, or zero where the kernel would not say. The
/// PEAK of a read rather than what it retained — see above — and reported for that: it is the
/// number Activity Monitor shows.
func settledFootprint() -> Int {
    malloc_zone_pressure_relief(nil, 0)
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / 4)
    let read = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
            task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
        }
    }
    return read == KERN_SUCCESS ? Int(info.phys_footprint) : 0
}

/// The CPU the whole PROCESS spent, which is what a read costs: the pipeline runs the file cursor,
/// the reader actor and the consumer on three different threads, so the calling thread's own clock
/// — `threadCPUSeconds`, what every seconds figure in this suite is taken with — reads a read as
/// free.
func processCPUSeconds() -> Double {
    var spent = timespec()
    clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &spent)
    return Double(spent.tv_sec) + Double(spent.tv_nsec) / 1e9
}

extension MediaBytes.Address {
    /// Which of the three this is, for a report that counts them.
    var kind: String {
        switch self {
        case .run: "run"
        case .file: "file"
        case .held: "held"
        }
    }
}
