/// Reading which working directories a live CLI is running in — the outside-the-transcript half of
/// `SessionLiveness`.
///
/// A port rather than a direct call to `ps`, so what the Hub makes of liveness is falsifiable
/// without a process table to arrange: the same shape `CheckoutRead` gives the git read.
public typealias LivenessRead = @Sendable () async -> Set<String>

/// The app's adapter: the process table, read through subprocesses. One reader for the process, so
/// the blocking calls queue behind one another rather than running a `ps` per caller.
public let processLivenessRead: LivenessRead = {
    await processLivenessReader.liveCwds()
}

private let processLivenessReader = ProcessLivenessReader()
