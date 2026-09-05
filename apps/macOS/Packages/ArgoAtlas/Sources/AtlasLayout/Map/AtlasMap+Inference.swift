/// Reading and writing the inferred half of a Map file (#1157), and the two position lookups the
/// Couplings share with it — both ends of both readings name a Plot by where it sits.
extension AtlasMap {
    /// The Plot a position names, and the caller's own account of a position naming none: a
    /// Coupling and a Domain fail differently over the same off-by-one, and the log is what says
    /// which half of the file disagreed with the nesting.
    static func plotPath(
        at position: Int,
        among plots: [AtlasPlot],
        missing: (Int) -> AtlasMapError,
    ) throws(AtlasMapError)
        -> String {
        guard plots.indices.contains(position) else { throw missing(position) }
        return plots[position].path
    }

    /// Where a path sits in the Map's Plot order, and the caller's own account of a path that
    /// sits nowhere.
    static func place(
        of path: String,
        in position: [String: Int],
        missing: (String) -> AtlasMapError,
    ) throws(AtlasMapError)
        -> Int {
        guard let found = position[path] else { throw missing(path) }
        return found
    }

    /// The inference a file states, read back against the Plots it was taken over. A member at a
    /// position the Map has no Plot at is refused rather than dropped, for the reason a Coupling
    /// is: it means the two halves of the file disagree about which repository was measured, and
    /// a Domain read off by one would hold files it never placed.
    static func inference(
        _ wire: AtlasInferenceWire?,
        joining plots: [AtlasPlot],
    ) throws(AtlasMapError)
        -> AtlasInference? {
        guard let wire else { return nil }
        let missing = AtlasMapError.domainAtNoPlot
        var domains: [AtlasDomain] = []
        for domain in wire.domains {
            guard !domain.members.isEmpty else { throw .emptyDomain(domain.name) }
            var members: [AtlasDomainMember] = []
            for member in domain.members {
                let path = try plotPath(at: member.plot, among: plots, missing: missing)
                members.append(AtlasDomainMember(path: path, confidence: member.confidence))
            }
            domains.append(AtlasDomain(name: domain.name, tokens: domain.tokens, members: members))
        }
        return AtlasInference(
            domains: domains,
            resolution: wire.resolution,
            settled: wire.settled,
            agreement: wire.agreement,
        )
    }

    /// The inference as the file spells it: every member a position in the Map's own Plot order.
    /// A Domain naming a path the Map holds no Plot at is refused rather than dropped, because it
    /// has no position to be written at and a file that quietly lost files is one nothing can
    /// audit.
    static func wire(
        _ inference: AtlasInference?,
        at position: [String: Int],
    ) throws(AtlasMapError)
        -> AtlasInferenceWire? {
        guard let inference else { return nil }
        let missing = AtlasMapError.domainOutsideMap
        var domains: [AtlasDomainWire] = []
        for domain in inference.domains {
            guard !domain.members.isEmpty else { throw .emptyDomain(domain.name) }
            var members: [AtlasDomainMemberWire] = []
            for member in domain.members {
                let plot = try place(of: member.path, in: position, missing: missing)
                members.append(AtlasDomainMemberWire(plot: plot, confidence: member.confidence))
            }
            domains.append(AtlasDomainWire(
                name: domain.name, tokens: domain.tokens, members: members,
            ))
        }
        return AtlasInferenceWire(
            resolution: inference.resolution,
            settled: inference.settled,
            agreement: inference.agreement,
            domains: domains,
        )
    }
}
