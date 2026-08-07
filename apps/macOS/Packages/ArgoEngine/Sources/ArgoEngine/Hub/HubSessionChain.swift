import Foundation

struct HubTranscript {
    let id: String
    var session: HubSession

    init(observation: TranscriptObservation) {
        id = observation.id
        session = HubSession(observation: observation)
    }
}

enum HubSessionChain {
    static func sessions(
        from transcripts: [HubTranscript],
        owners: [String: String],
    ) -> [HubSession] {
        var byID: [String: HubSession] = [:]
        for transcript in transcripts where byID[transcript.id] == nil {
            byID[transcript.id] = transcript.session
        }
        var children: [String: [String]] = [:]
        var roots: [String] = []
        for transcript in transcripts {
            guard let parentID = parentID(of: transcript, owners: owners), parentID != transcript.id
            else {
                roots.append(transcript.id)
                continue
            }
            children[parentID, default: []].append(transcript.id)
        }

        var claimed: Set<String> = []
        var sessions: [HubSession] = []
        for id in roots + transcripts.map(\.id) where !claimed.contains(id) {
            guard var session = byID[id] else { continue }
            claimed.insert(id)
            var currentID = id
            while let childID = children[currentID]?.first,
                  !claimed.contains(childID),
                  let continuation = byID[childID] {
                session.mergeContinuation(continuation)
                claimed.insert(childID)
                currentID = childID
            }
            sessions.append(session)
        }
        return sessions
    }

    private static func parentID(
        of transcript: HubTranscript,
        owners: [String: String],
    ) -> String? {
        guard let headLeafUUID = transcript.session.headLeafUUID else { return nil }
        return owners[headLeafUUID]
    }
}
