import ArgoEngine
import SwiftUI

/// The head's status pair over every reading a provider can put in it (#893). The first two come
/// off GitHub, whose `state` IS Argo's filing; the rest are providers with words of their own.
struct StatusPairSpecimen: View {
    struct Reading: Identifiable {
        let word: String
        let bucket: TicketState

        var id: String {
            "\(word) \(bucket.rawValue)"
        }
    }

    static let readings = [
        Reading(word: "open", bucket: .open),
        Reading(word: "open", bucket: .claimed),
        Reading(word: "In progress", bucket: .claimed),
        Reading(word: "closed", bucket: .resolved),
        Reading(word: "Cancelled", bucket: .ruledOut),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            ForEach(Self.readings) { StatusPair(word: $0.word, bucket: $0.bucket) }
        }
        .padding(ArgoSpacing.section)
        .frame(width: ArgoTicketDetail.idealWidth, alignment: .leading)
        .argoDeckSurface()
    }
}
