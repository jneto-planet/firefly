/**
 * Builds the CLI argument array to pass to the Logger Client executable.
 *
 * All-or-nothing rule: if no IP is provided, no connection params are sent at
 * all (port and pattern alone are meaningless without a target address).
 */
export function buildLoggerClientArgs(args?: {
  ip?: string;
  port?: string;
  pattern?: string;
}): string[] {
  if (!args?.ip) return [];

  const result: string[] = ["-ip", args.ip];
  if (args.port) result.push("-port", args.port);
  if (args.pattern) result.push("-pattern", args.pattern);
  return result;
}
