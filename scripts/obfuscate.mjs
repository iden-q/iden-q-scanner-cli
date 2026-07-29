import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import JavaScriptObfuscator from "javascript-obfuscator";

// Same config as q-scanner-lib (see its obfuscate.mjs for the bisection that
// produced it), plus two differences: disableConsoleOutput must stay false
// here — console output *is* this program's entire output — and
// renameGlobals stays true (see below) rather than lib's false, because
// esbuild bundles this CLI to flat ESM with no IIFE wrapper, so every
// top-level function/const here (scanCommand, printReport, walkDir...) sits
// in what the obfuscator treats as global scope; leaving it false shipped
// every one of them fully readable, 1:1 with the source filenames.
const HIGH_OBFUSCATION = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  numbersToExpressions: true,
  renameGlobals: true,
  selfDefending: false,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: ["rc4"],
  stringArrayRotate: false,
  stringArrayShuffle: false,
  stringArrayWrappersCount: 3,
  stringArrayWrappersChainedCalls: false,
  stringArrayWrappersParametersMaxCount: 3,
  stringArrayWrappersType: "variable",
  stringArrayThreshold: 1,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  sourceMap: true,
  sourceMapMode: "separate",
};

mkdirSync("dist-maps", { recursive: true });

const filePath = "dist/index.js";
const code = readFileSync(filePath, "utf8");
const result = JavaScriptObfuscator.obfuscate(code, HIGH_OBFUSCATION);
writeFileSync(filePath, result.getObfuscatedCode());
writeFileSync("dist-maps/index.js.map", result.getSourceMap());
chmodSync(filePath, 0o755);
console.log(`obfuscated ${filePath}`);
