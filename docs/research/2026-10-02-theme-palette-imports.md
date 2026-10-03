# Theme palette imports

Checked 2026-10-02 against `BankkRoll/tweakcn-theme-picker` commit
[`7b261a42335d474a6be93ac77ec3f8186db70af7`](https://github.com/BankkRoll/tweakcn-theme-picker/commit/7b261a42335d474a6be93ac77ec3f8186db70af7).
The canonical Tailwind v4 OKLCH sources inspected were:

- [Catppuccin](https://github.com/BankkRoll/tweakcn-theme-picker/blob/7b261a42335d474a6be93ac77ec3f8186db70af7/registry/themes/catppuccin.css)
- [Ocean Breeze](https://github.com/BankkRoll/tweakcn-theme-picker/blob/7b261a42335d474a6be93ac77ec3f8186db70af7/registry/themes/ocean-breeze.css)
- [Northern Lights](https://github.com/BankkRoll/tweakcn-theme-picker/blob/7b261a42335d474a6be93ac77ec3f8186db70af7/registry/themes/northern-lights.css)

Only color declarations were adapted to Argo's `:root[data-theme=ID]` and `.dark` selectors. Radius, typography, spacing, tracking, shadows, providers, and component code were excluded. The source's light Northern Lights white foregrounds and Ocean Breeze white primary foreground did not meet Argo's 4.5:1 text-pair requirement; these foregrounds were changed to dark ink. Ocean Breeze uses `oklch(0.22 0.03 260)` for light primary text and raises dark sidebar-accent and muted text to the paired readable foreground. Northern Lights uses `oklch(0.16 0 0)` for the light primary/secondary and dark primary foregrounds; its dark secondary/accent surfaces were darkened to `oklch(0.44 ...)` to pair with light text. Catppuccin's light accent text was darkened and muted text strengthened. Argo's warning and status roles remain local. Dark warning uses a low-chroma restrained surface and paired foreground; the danger indicator is independent of native `--destructive`.

The final theme set for this trial is Default, Catppuccin, Ocean Breeze, and Northern Lights, each with independent Light and Dark modes. Neutral and the unfinished Forest candidate were superseded and removed. Graphite was already deleted before this work and remains deleted. Dark warning and danger indicator values were aligned across the remaining four themes. The Dark danger indicator uses saturated red `oklch(0.7 0.2 25)` and is tested against the darkest and lightest theme surfaces it can appear beside.

The copied theme CSS is licensed under MIT. Required notice from the source repository's `LICENSE`:

```text
MIT License

Copyright (c) 2026 Bankk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
