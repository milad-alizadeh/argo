## Screenshots

A screenshot is evidence. It belongs in the tracker, not only in the session.

- When you create an issue from a bug report, put the user's screenshot in the body under a
  `## Screenshot` heading.
- A PR that changes how a screen looks names every changed state, and says where each is seen:
  the hosted component story, or the render command. If the change is a fix, describe the before
  as well as the after.

**An agent attaches the image itself**, through github.com in a browser where the user is signed
in (Claude in Chrome). `gh` and the REST API cannot attach a file; the page's upload is the only
route, and GitHub hosts the file on its own CDN, outside the repository.

1. Put the file inside the working directory, untracked. `file_upload` refuses paths the session
   was not given, temp dirs included.
2. Open the issue or PR. In the "Add a comment" box, capture GitHub's file input without the native
   picker: with `javascript_tool`, wrap `HTMLInputElement.prototype.click` so a `type=file` input
   is kept rather than clicked, click the "Paste, drop, or click to add files" button, and restore
   the original `click`.
3. `find` the input (the tree shows it as a `type="file"` button) and pass the path to
   `file_upload`.
4. After a few seconds the box holds `<img … src="https://github.com/user-attachments/assets/<id>" />`.
   Copy that tag, empty the box through the native `value` setter plus an `input` event, and put
   the tag in the body with `gh issue edit --body-file`. Delete the local file.

Beside an image, a PR still links the hosted component story or gives the render command and state
names, so a reader can draw the current one.

An agent's local captures are **disposable**: a temp dir, judged, deleted. A PNG in a git object
has no version, so a later reader cannot tell whether it shows the code beside it or the code it
replaced.
