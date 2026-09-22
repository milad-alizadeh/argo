import type { CompanionPart } from '../drive/channel/companion-plugin'

// The socket a companion part's shipped hook dials. A proof reads it out of the script itself so it
// connects where Claude Code would, rather than where the test thinks the part is listening. The
// `-w` flag is optional because the Permission hook waits forever and the MessageDisplay one does not.
export function hookSocketPath(part: CompanionPart) {
  return part.hook.script.match(/nc -U (?:-w \d+ )?"([^"]+)"/)?.[1] ?? ''
}
