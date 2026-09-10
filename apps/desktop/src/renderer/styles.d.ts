// Vite bundles the stylesheet; TypeScript is only told the import exists. `main.tsx` imports
// `styles/globals.css` for its side effect, which is what puts the token contract on the page.
declare module '*.css' {}
