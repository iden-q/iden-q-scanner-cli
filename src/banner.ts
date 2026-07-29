import { palette, out } from "./theme.js";

// "ANSI Shadow" wordmark, IDEN|Q split at column 29 so the Q — the DNA-helix
// accent in the real IdenQ mark — can carry the brand yellow on its own.
const ROWS: [string, string][] = [
  ["██╗██████╗ ███████╗███╗   ██╗", " ██████╗ "],
  ["██║██╔══██╗██╔════╝████╗  ██║", "██╔═══██╗"],
  ["██║██║  ██║█████╗  ██╔██╗ ██║", "██║   ██║"],
  ["██║██║  ██║██╔══╝  ██║╚██╗██║", "██║▄▄ ██║"],
  ["██║██████╔╝███████╗██║ ╚████║", "╚██████╔╝"],
  ["╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝", " ╚══▀▀═╝ "],
];

export function printBanner(): void {
  console.log();
  for (const [iden, q] of ROWS) {
    console.log(out.bold(out.fg(palette.genomeWhite, iden)) + out.bold(out.fg(palette.mutationSpark, q)));
  }
  console.log(out.dim(out.fg(palette.genomeWhiteMuted, "  post-quantum cryptography exposure scanner")));
  console.log(out.dim(out.fg(palette.genomeWhiteMuted, "  for devops, platform & security engineers — gate it in CI")));
  console.log(out.fg(palette.helixBlue, "  " + "─".repeat(46)));
}
