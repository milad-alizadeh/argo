/// The fast half of a memo's key: whether two arrays are the same BUFFER (ADR-0028 #1070).
///
/// Every memo in the shell is keyed by the whole value it derived from, because a stamp listing the
/// fields a derivation reads is a stamp a later input falls quietly out of. That key is free while
/// the shell hands the same stored array every pass — which it does — and this is what says so, in
/// one place rather than once per memo: `TicketsRoomMemo` asks it of a listing and
/// `SessionRosterNamingMemo` of a roster, and both charge their own tally when the answer is no.
///
/// A memo retains its own reference, so nothing can write into a matched buffer in place: a write
/// to a shared array copies it first.
extension Array {
    func holdsTheStorageOf(_ other: [Element]) -> Bool {
        count == other.count && withUnsafeBufferPointer { mine in
            other.withUnsafeBufferPointer { theirs in mine.baseAddress == theirs.baseAddress }
        }
    }
}
