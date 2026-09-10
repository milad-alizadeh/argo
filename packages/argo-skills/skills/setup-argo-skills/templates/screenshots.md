## Screenshots

A screenshot is evidence. It belongs in the tracker, not only in the session.

- When you create an issue from a bug report, put the user's screenshot in the body under a
  `## Screenshot` heading.
- A PR that changes how a screen looks names every changed state, and says where each is seen:
  the hosted component story, or the render command. If the change is a fix, describe the before
  as well as the after.

**Two routes, and an agent has one of them.** `gh issue` and `gh pr` cannot attach a file, so the
image reaches GitHub one of two ways:

- **A person drags the file into the body on github.com.** GitHub hosts it on its own CDN, dated
  and outside the repository. This is the route for a bug report's screenshot and for a design
  ticket's state renders, and it is the only route that puts a PNG in a body. Ask for it.
- **An agent writes a link.** A hosted component site gives one deep link per component;
  otherwise give the render command and the state names, so a reader draws it themselves.

An agent's own screenshots are **disposable**: a temp dir, judged, deleted. A PNG in a git object
has no version, so a later reader cannot tell whether it shows the code beside it or the code it
replaced.
