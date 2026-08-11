// Minimal declarations for the Node built-ins used by source-contract tests.
declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: string): string;
}
declare module "node:path" {
  export function join(...paths: string[]): string;
}
declare const process: { cwd(): string };
