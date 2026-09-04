# Publishing screenshots without committing them

From the directory holding the PNGs (`$SHOTS`), write them to a commit that no branch
carries, and push it to a ref:

```sh
ref=refs/pr-screenshots/$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
tree=$(for f in "$SHOTS"/*.png; do
  printf '100644 blob %s\t%s\n' "$(git hash-object -w "$f")" "$(basename "$f")"
done | git mktree)
commit=$(git commit-tree "$tree" -m "evidence: $ref")
git push --force origin "$commit:$ref"
```

Give every PNG a URL-safe name. An empty `$SHOTS` writes the empty tree and pushes nothing
you can link to, so make sure that the glob matched.

Embed each with a raw URL pinned to that commit. It renders inline during review:

```markdown
![status-row](https://raw.githubusercontent.com/<owner>/<repo>/<commit>/status-row.png)
```

The ref is the only thing that keeps the image reachable. While it lives, the URL resolves;
delete it and the image goes 404. Pick the namespace by how long the image must last:

- `refs/pr-screenshots/<branch-slug>` — review-time evidence, as above. `bun run worktrees:gc`
  deletes the ref once the PR closes.
- `refs/evidence/issue-<N>` — a screenshot in an issue body. Nothing sweeps that namespace,
  because a closed bug report is where the picture matters most.

The raw URL renders on a public repo only. On a private repo, ask the user to drag the file
into the body on github.com.
