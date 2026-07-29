import { palette, err } from "./theme.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Progress feedback on stderr so stdout (table/JSON report) stays clean for
 * piping. Falls back to a single static line when stderr isn't a TTY (CI). */
export class Spinner {
  private text: string;
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(text: string) {
    this.text = text;
  }

  start(): this {
    if (!err.enabled) {
      process.stderr.write(`${this.text}\n`);
      return this;
    }
    process.stderr.write("\x1b[?25l"); // hide cursor
    this.timer = setInterval(() => {
      process.stderr.write(`\r${err.fg(palette.helixBlueLight, FRAMES[this.frame])} ${this.text}`);
      this.frame = (this.frame + 1) % FRAMES.length;
    }, 80);
    return this;
  }

  update(text: string): void {
    this.text = text;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (err.enabled) process.stderr.write("\r\x1b[K\x1b[?25h"); // clear line, show cursor
  }
}
