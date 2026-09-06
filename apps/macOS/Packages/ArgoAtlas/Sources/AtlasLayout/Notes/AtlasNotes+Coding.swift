import Foundation

/// Reading the written layer file (#1159).
///
/// **Every failure is the same answer: nothing was written.** That is the whole difference between
/// this reader and `AtlasMap`'s, which has an error for every way its bytes can be wrong. The Map
/// is what the reader asked for, so a Map file that will not read has to say so and offer a
/// rebuild. The written layer is not: it is fetched separately and optionally, nothing waits for
/// it, and a repository with none draws the same map — so a file that is missing, half-written,
/// foreign or from a later Argo all leave the reader with the map they came for and no sentence
/// beside it.
public extension AtlasNotes {
    /// Reads a written layer file, or `nil` where these bytes are not one this reader knows.
    init?(decoding data: Data) {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        // The version on its own and FIRST, the way the Map file's reader takes it: a file from a
        // later Argo whose note shape this reader does not know must not be read against this
        // reader's idea of one.
        guard let stated = try? decoder.decode(AtlasVersionWire.self, from: data),
              stated.version == AtlasNotes.version,
              let wire = try? decoder.decode(AtlasNotesWire.self, from: data)
        else {
            return nil
        }
        self.init(
            writtenAt: wire.writtenAt,
            model: wire.model,
            files: AtlasNotes.read(wire.files),
            folders: AtlasNotes.read(wire.folders),
        )
    }

    /// The Notes of one kind, as values. A Note with nothing to say is dropped rather than kept as
    /// an empty block in the panel: the file is written by a program, and a subject the writer
    /// skipped is likelier to arrive as an empty string than as a missing key.
    private static func read(_ wire: [String: AtlasNoteWire]?) -> [String: AtlasNote] {
        var notes: [String: AtlasNote] = [:]
        for (path, note) in wire ?? [:] where !note.note.isEmpty {
            notes[path] = AtlasNote(words: note.note, flag: note.why ?? [], subject: note.subject)
        }
        return notes
    }
}
