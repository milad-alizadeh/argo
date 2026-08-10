@testable import ArgoUI
import Testing

/// What the instrument says about a run of frames.
///
/// Worth a suite even though it is arithmetic: every number #516 is judged on comes out of here, so
/// a p95 that is quietly a mean would make a fix look like a regression and vice versa.
@Suite("Frame reading")
struct FrameReadingTests {
    @Test
    func `a clean cadence drops nothing`() {
        let reading = FrameReading(milliseconds: Array(repeating: 8.3, count: 120))

        #expect(reading.count == 120)
        #expect(reading.p50 == 8.3)
        #expect(reading.p95 == 8.3)
        #expect(reading.worst == 8.3)
        #expect(reading.dropped == 0)
    }

    /// The whole reason the tail is reported: a run that is 99% perfect and stutters once has a
    /// flawless median, and the reader sees the stutter.
    @Test
    func `one hitch in a hundred survives into the worst frame and the count`() {
        let reading = FrameReading(milliseconds: Array(repeating: 8.0, count: 99) + [90])

        #expect(reading.p50 == 8)
        #expect(reading.worst == 90)
        #expect(reading.dropped == 1)
    }

    /// Nearest-rank: the answer is an interval something actually took.
    @Test
    func `the percentile is an observed value, never one between two`() {
        let reading = FrameReading(milliseconds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

        #expect(reading.p50 == 5)
        #expect(reading.p95 == 10)
    }

    /// A launch that has produced no frames yet has to read as an absence rather than as a
    /// perfect score.
    @Test
    func `nothing observed reads as nothing`() {
        let reading = FrameReading(milliseconds: [])

        #expect(reading.p50 == 0)
        #expect(reading.p95 == 0)
        #expect(reading.worst == 0)
        #expect(reading.dropped == 0)
    }

    /// The floor is the gate, so what counts as dropped is the thing most worth pinning: 16.67ms
    /// exactly is a frame that landed, and anything past it is one that did not.
    @Test
    func `the floor is a frame that landed`() {
        let reading = FrameReading(milliseconds: [16.6, 16.66, 16.7, 17])

        #expect(reading.dropped == 2)
    }
}
