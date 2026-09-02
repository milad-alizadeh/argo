import Darwin
import Testing

/// Who owns the descriptor a test client dials on — both ends of the lifetime, because a client
/// that released nothing would pass a suite that only forbids releasing twice.
///
/// A suite about the FIXTURE, which is unusual and deliberate. `CompanionClient` was a struct
/// holding a raw `Int32`, so `withGate`'s `defer { client.close() }` and the four bodies that also
/// close it each closed the same number — and the kernel hands out the LOWEST free number, so the
/// second close landed on whatever was opened in between (#936).
@Suite("Companion client ownership")
@MainActor
struct CompanionClientOwnershipTests {
    @Test
    func `a closed client releases its descriptor and never takes the number back`() async throws {
        try await PermissionGate.withGate { _, _, client in
            let number = client.descriptor
            client.close()
            #expect(fcntl(number, F_GETFD) == -1, "the close released nothing")

            // No reclaim, nothing to prove: the scenario could not be staged, which is not a
            // verdict on the client. Every other run of this test says what this one cannot.
            guard let reclaimed = ReclaimedDescriptor.taking(number) else { return }
            defer { reclaimed.dropAll() }

            client.close()

            #expect(
                fcntl(number, F_GETFD) != -1,
                "the second close took fd \(number) back off whoever the kernel had given it to",
            )
        }
    }
}
