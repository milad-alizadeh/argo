import ArgoEngine

extension Usage {
    /// Two spends added, where either may be absent.
    ///
    /// Absent is not zero, which is the whole reason this exists: a run of calls where one reported
    /// nothing has still spent what the others reported, and a run where NONE did has no figure at
    /// all rather than a zero claiming the work was free.
    static func total(_ first: Usage?, _ second: Usage?) -> Usage? {
        guard let first else { return second }
        guard let second else { return first }
        return first + second
    }
}
