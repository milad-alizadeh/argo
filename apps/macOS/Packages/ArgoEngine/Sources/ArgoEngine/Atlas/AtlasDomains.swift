import AtlasLayout

/// Domains, inferred from the two signals every repository has (#1157).
///
/// The folder tree files code by LAYER and nothing files it by subject, so the second partition
/// has to be inferred — from what files are called, and from what changes together. Neither is a
/// dependency graph, deliberately: a lexical reading needs no toolchain, no build and no language
/// support, so a repository Argo has never seen draws the same map as this one.
///
/// Nothing here is measured. Every number this produces is a guess with a confidence, and it
/// travels only inside `AtlasInference`, which carries what the guess is worth.
///
/// What it makes of this repository, as a sense of scale: 2,871 files become 23 Domains — named
/// minimap, tickets, composer, plan, roster, mermaid — with 243 files belonging to nothing, at a
/// resolution the repository settled on, and the blended reading agrees with a reading of the
/// filenames alone 0.95 of the time.
enum AtlasDomains {
    /// How much of an edge's weight the names carry, against what changes together. Names lead
    /// because they are the signal every repository has on its first commit, and history is what
    /// corrects them: a fresh repository still gets domains, and an old one gets better ones.
    static let nameShare = 0.6

    /// How much a folder name on the way down counts, which is NOTHING. Stated here as well as at
    /// `AtlasNames`, because it has to reach two readings that must agree — the vectors, and the
    /// words barred from every label — and a repository whose house words were counted at one
    /// weight and whose vectors were built at another is two readings of two repositories.
    static let directoryWeight = AtlasNames.directoryWeight

    /// The Domains over a Map's Plots, and what the inference is worth.
    ///
    /// `paths` is every path the Map holds a Plot for, in the Map's own Plot order, and the
    /// couplings name those same paths. `repository` is the repository's own name, which is
    /// barred from every Domain label: every Domain in it is one of its domains.
    static func inferred(
        over paths: [String],
        coupledBy couplings: [AtlasCoupling],
        called repository: String,
    )
        -> AtlasInference {
        let vectors = AtlasNames.vectors(of: paths, directoryWeight: directoryWeight)
        let alike = AtlasNameEdges.edges(of: vectors)
        let blended = AtlasGraph(
            count: paths.count,
            weights: blend(alike, with: couplings, over: paths),
        )
        let chosen = AtlasPlateau.chosen(over: blended)
        let placed = AtlasMembership(of: chosen.belonging, over: blended)
        let reading = AtlasNaming(
            vectors: vectors,
            house: AtlasDomainNames.house(
                over: paths, weighing: directoryWeight, called: repository,
            ),
        )
        return AtlasInference(
            domains: domains(placed, over: paths, naming: reading),
            resolution: chosen.resolution,
            settled: chosen.settled,
            agreement: agreement(
                with: placed, over: alike, among: paths.count, at: chosen.resolution,
            ),
        )
    }

    /// The two signals as one graph. A pair that BOTH signals state is the sum of the two, which
    /// is the whole point: a tie the names and the history both see outweighs either alone.
    private static func blend(
        _ alike: [AtlasPair: Double],
        with couplings: [AtlasCoupling],
        over paths: [String],
    )
        -> [AtlasPair: Double] {
        var place: [String: Int] = [:]
        for (position, path) in paths.enumerated() {
            place[path] = position
        }
        var weights = alike.mapValues { $0 * nameShare }
        for coupling in couplings {
            guard let first = place[coupling.first], let second = place[coupling.second] else {
                continue
            }
            weights[AtlasPair(first, second), default: 0] +=
                (1 - nameShare) * coupling.strength
        }
        return weights
    }

    /// The Domains themselves, largest first, each named by what its files are called.
    ///
    /// Largest first because that is the order they are read in, and because a word may name only
    /// one Domain: the larger Domain has the better claim on a word both hold, and the smaller
    /// takes its next one rather than two Domains answering to one name. The prototype scores
    /// every word and drops the taken ones afterwards, which leaves a Domain sharing its whole
    /// top four with a larger one unnamed; barring them BEFORE the scoring promotes its fifth
    /// word instead, and a named Domain beats a numbered one.
    private static func domains(
        _ placed: AtlasMembership,
        over paths: [String],
        naming reading: AtlasNaming,
    )
        -> [AtlasDomain] {
        var members: [Int: [Int]] = [:]
        for (position, community) in placed.belonging.enumerated()
            where community != AtlasMembership.unplaced {
            members[community, default: []].append(position)
        }
        var taken: Set<String> = []
        var built: [AtlasDomain] = []
        // Ties break on the community's own id, so two Domains of one size cannot swap places
        // between two readings of one repository.
        for (_, held) in members.sorted(by: larger) {
            let words = AtlasDomainNames.naming(held, reading, barring: taken)
            taken.formUnion(words.prefix(1))
            built.append(AtlasDomain(
                // A Domain every one of whose words is a house word or already another Domain's
                // name is left standing on its rank, which is at least something a reader can
                // point at twice — never a raw community id, a number nothing else uses. It is
                // the last resort, and this repository reaches it never.
                name: words.first ?? "domain \(built.count + 1)",
                tokens: words,
                members: held.map {
                    AtlasDomainMember(path: paths[$0], confidence: placed.confidence[$0])
                },
            ))
        }
        return built
    }

    /// Which of two communities is read first: the one holding more files.
    private static func larger(
        _ one: (key: Int, value: [Int]),
        _ other: (key: Int, value: [Int]),
    )
        -> Bool {
        one.value.count == other.value.count
            ? one.key < other.key
            : one.value.count > other.value.count
    }

    /// How far the blended reading agrees with a reading taken from the NAMES alone, at the same
    /// resolution. Two independent signals agreeing is not proof either is right; with no answer
    /// key it is the only accuracy number there is, and it is reported rather than acted on.
    private static func agreement(
        with placed: AtlasMembership,
        over alike: [AtlasPair: Double],
        among files: Int,
        at resolution: Double,
    )
        -> Double? {
        let names = AtlasGraph(count: files, weights: alike)
        let alone = AtlasLouvain.communities(of: names, resolution: resolution)
        return AtlasAgreement.between(
            placed.belonging,
            AtlasMembership(of: alone, over: names).belonging,
        )
    }
}
