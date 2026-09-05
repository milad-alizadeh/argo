import Foundation

/// The written layer file exactly as it is written, before anything is checked (#1159).
///
/// Its own shape rather than `Codable` on `AtlasNotes`, for `AtlasMapWire`'s reason: the file is
/// written by something other than this reader, and the value tree is what the panel reads. Every
/// key but `version` is optional, because a written layer that said one kind of thing and not the
/// others is a layer that said something.
///
/// **Keys this reader has no use for are ignored rather than refused.** The same file carries the
/// pair notes of #1160 and the domain names of #1158, and a reader that refused a file for holding
/// them would break on the ticket after this one.
///
/// The version is not among them: it is read on its own first, through `AtlasVersionWire`, exactly
/// as the Map file's is and for the same reason — read as part of the whole file it could only be
/// checked against a file that already parsed as this version's shape.
struct AtlasNotesWire: Codable {
    let writtenAt: Date?
    let model: String?
    let files: [String: AtlasNoteWire]?
    let folders: [String: AtlasNoteWire]?
}

/// One Note as the file spells it. `note` is the sentence and is the only required key: a subject
/// nothing flagged carries no `why`, and a writer that recorded no digest carries no `subject`.
///
/// `why` is the FILE's word for what the domain calls the flag, kept because the file is written by
/// something other than this reader and renaming a key here would only rename it on one side.
struct AtlasNoteWire: Codable {
    let note: String
    let why: [String]?
    let subject: String?
}
