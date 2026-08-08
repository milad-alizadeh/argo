@testable import ArgoUI
import Testing

@Suite("Shortest distinguishing label")
struct DistinguishingLabelTests {
    @Test
    func `a name nothing collides with carries no qualifier`() {
        let labels = DistinguishingLabel.labels(for: [
            "/Users/milad/Labs/argo",
            "/Users/milad/Labs/cockpit",
        ])

        #expect(labels == ["argo", "cockpit"])
    }

    @Test
    func `duplicates take the nearest distinguishing parent`() {
        let labels = DistinguishingLabel.labels(for: [
            "/Users/milad/Client/argo",
            "/Users/milad/Labs/argo",
        ])

        #expect(labels == ["Client/argo", "Labs/argo"])
    }

    @Test
    func `a three-way collision extends until every label is distinct`() {
        let labels = DistinguishingLabel.labels(for: [
            "/w/one/file.swift",
            "/w/two/file.swift",
            "/w/three/file.swift",
        ])

        #expect(labels == ["one/file.swift", "two/file.swift", "three/file.swift"])
        #expect(Set(labels).count == labels.count)
    }

    @Test
    func `the qualifier stops at one parent, even while rivals remain`() {
        // The cap is the point: a label that keeps extending becomes the path it stands in
        // for. Where two entries read alike at the cap, they read alike (#377).
        let labels = DistinguishingLabel.labels(for: [
            "/w/one/same/file.swift",
            "/w/two/same/file.swift",
        ])

        #expect(labels == ["same/file.swift", "same/file.swift"])
    }

    @Test
    func `an exact twin is not a rival`() {
        // Nothing tells two entries on one path apart, so treating the twin as a rival only
        // pushes the qualifier out for everyone.
        let labels = DistinguishingLabel.labels(for: [
            "/Users/milad/Labs/argo",
            "/Users/milad/Labs/argo",
            "/Users/milad/Client/argo",
        ])

        #expect(labels == ["Labs/argo", "Labs/argo", "Client/argo"])
    }

    @Test
    func `a path with no components degrades to no label at all`() {
        // `nil`, not a word: the caller owns how an absence is spelled, and a helper that
        // picked one would put a second spelling of "unknown" into the app.
        #expect(DistinguishingLabel.labels(for: [nil, "/", ""]) == [nil, nil, nil])
    }

    @Test
    func `a single-component path is its own label`() {
        #expect(DistinguishingLabel.labels(for: ["/argo", "/Labs/argo"]) == ["argo", "Labs/argo"])
    }

    @Test
    func `a relative path is qualified by its own components, never by the process cwd`() {
        // A path resolved against the working directory would draw its qualifier from
        // ancestry the record never carried — a fabricated address, quietly plausible.
        let labels = DistinguishingLabel.labels(for: ["src/index.ts", "test/index.ts"])

        #expect(labels == ["src/index.ts", "test/index.ts"])
    }
}
