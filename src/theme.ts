import type { Severity } from "@iden-q/scanner-lib";

/** IdenQ dark design system — mirrors iden-q-web-ingress's _colors.scss.
 * Keep in sync by hand; the CLI can't import a .scss file. */
export const palette = {
  helixBlue: "#1845cd",
  helixBlueLight: "#4e74e2",
  mutationSpark: "#faec52",
  cytosineAqua: "#16e9d7",
  genomeWhite: "#ffffff",
  genomeWhiteMuted: "#9ba0a3",
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
} as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const NO_COLOR = "NO_COLOR" in process.env || process.env.TERM === "dumb";

function painter(stream: NodeJS.WriteStream) {
  const enabled = stream.isTTY === true && !NO_COLOR;
  const fg = (hex: string, text: string): string => {
    if (!enabled) return text;
    const [r, g, b] = hexToRgb(hex);
    return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
  };
  const bold = (text: string): string => (enabled ? `\x1b[1m${text}\x1b[0m` : text);
  const dim = (text: string): string => (enabled ? `\x1b[2m${text}\x1b[0m` : text);
  return { enabled, fg, bold, dim };
}

export type Painter = ReturnType<typeof painter>;

/** Colors written to stdout (report output, banner) — disabled when stdout is piped. */
export const out = painter(process.stdout);
/** Colors written to stderr (spinner, progress) — disabled when stderr is piped. */
export const err = painter(process.stderr);

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: palette.error,
  high: palette.warning,
  medium: palette.info,
  low: palette.success,
  info: palette.genomeWhiteMuted,
};

export const SEVERITY_ICON: Record<Severity, string> = {
  critical: "✖",
  high: "▲",
  medium: "●",
  low: "○",
  info: "·",
};
