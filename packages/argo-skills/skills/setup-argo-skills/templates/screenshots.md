## Screenshots

A screenshot is evidence. It belongs in the tracker, not only in the session.

- When you create an issue from a bug report, put the user's screenshot in the body under a
  `## Screenshot` heading.
- A PR that changes how a screen looks carries one screenshot per changed state. If the change
  is a fix, carry the before image and the after image.

`gh issue` and `gh pr` cannot attach a file. Publish the PNGs to a ref instead. Run this in the
repo, with `shots` set to the directory that holds them:

```sh
shots=<dir>
ref=refs/evidence/issue-<N>          # a PR instead: refs/pr-screenshots/<head branch, / as ->
tree=$(for f in "$shots"/*.png; do
  printf '100644 blob %s\t%s\n' "$(git hash-object -w "$f")" "$(basename "$f")"
done | git mktree)
commit=$(git commit-tree "$tree" -m "evidence: $ref")
git push --force origin "$commit:$ref"
```

That push writes a commit sitting on no branch: no work branch and no pull request is involved,
so a guard that reserves those for a ship skill does not apply to it.

Give every PNG a URL-safe name. An empty `$shots` writes the empty tree and pushes nothing you
can link to, so make sure that the glob matched.

Embed each one by a raw URL pinned to that commit:

```markdown
![empty state](https://raw.githubusercontent.com/<owner>/<repo>/<commit>/empty-state.png)
```

The commit sits on no branch, so it never merges. The ref is the only thing that keeps the
image reachable: while the ref lives, the URL resolves; delete the ref and the image goes 404.
A PR screenshot is review-time evidence and its ref can go once the PR closes. An issue
screenshot must outlive the issue, so leave `refs/evidence/*` alone.

The raw URL renders on a public repo only. On a private repo, ask the user to drag the file
into the body on github.com.

You cannot read a pasted image as a file. Ask the user to save it and give you the path.
