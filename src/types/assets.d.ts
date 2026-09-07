// Next.js compiles CSS imports through its own pipeline; TypeScript only
// needs to know the side-effect import is legitimate.
declare module "*.css";
