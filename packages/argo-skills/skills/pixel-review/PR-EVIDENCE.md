# Publishing screenshots for a PR without committing them

From the directory holding the PNGs (`$SHOTS`), write them to a commit that no branch
carries, and push it to a throwaway ref:

```sh
slug=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
tree=$(for f in "$SHOTS"/*.png; do
  printf '100644 blob %s\t%s\n' "$(git hash-object -w "$f")" "$(basename "$f")"
done | git mktree)
commit=$(git commit-tree "$tree" -m "pixel-review: $slug")
git push --force origin "$commit:refs/pr-screenshots/$slug"
```

Embed each with a raw URL pinned to that commit; it renders inline during review, and the
ref is safe to delete once the PR closes:

```markdown
![status-row](https://raw.githubusercontent.com/<owner>/<repo>/<commit>/status-row.png)
```
