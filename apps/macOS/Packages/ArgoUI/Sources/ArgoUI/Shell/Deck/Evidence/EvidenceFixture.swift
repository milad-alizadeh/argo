/// The calls the panel's own previews open on, taken out of the shipping feed.
///
/// Read from `FeedProjection.previewCallRows` rather than written here: a panel preview holding a
/// result of its own would be evidence about a call nobody is shown, and the point of looking at
/// this surface is what the projection actually hands it.
enum EvidenceFixture {
    static let failed = call { $0.ending.hasFailed }
    static let edited = call { call in
        call.evidence.contains { result in
            if case .diff = result {
                true
            } else {
                false
            }
        }
    }

    private static func call(_ matching: (FeedCall) -> Bool) -> FeedCall? {
        FeedProjection.previewCallRows
            .compactMap { row -> FeedCall? in
                guard case let .call(call) = row.content else { return nil }
                return call
            }
            .first(where: matching)
    }
}
