/**
 * Tests for Logger Client connection-param building.
 *
 * The function under test is buildLoggerClientArgs(), which decides which CLI
 * flags to pass to the Logger Client executable.
 *
 * ONE TEST IS EXPECTED TO FAIL against a naive implementation:
 *   "empty IP with port+pattern → no args"
 *
 * A naive guard of   `if (args?.ip)`  only skips -ip; it still adds -port and
 * -pattern, producing ["-port","10000","-pattern","..."] — useless without a
 * target IP.  The correct behaviour (all-or-nothing) is tested here.
 */

import { describe, it, expect } from 'vitest';
import { buildLoggerClientArgs } from '../logger-client';

const DEFAULT_PORT    = '10000';
const DEFAULT_PATTERN = '%d [%c{1}] %p - %m';
const SAMPLE_IP       = '192.168.1.42';

describe('buildLoggerClientArgs', () => {

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns empty array when called with no arguments', () => {
    expect(buildLoggerClientArgs()).toEqual([]);
  });

  it('returns empty array when called with an empty object', () => {
    expect(buildLoggerClientArgs({})).toEqual([]);
  });

  it('builds full arg list when IP, port and pattern are all provided', () => {
    const result = buildLoggerClientArgs({
      ip: SAMPLE_IP,
      port: DEFAULT_PORT,
      pattern: DEFAULT_PATTERN,
    });

    expect(result).toEqual([
      '-ip',      SAMPLE_IP,
      '-port',    DEFAULT_PORT,
      '-pattern', DEFAULT_PATTERN,
    ]);
  });

  it('passes the IP value verbatim', () => {
    const ip = '10.0.0.99';
    const result = buildLoggerClientArgs({ ip, port: DEFAULT_PORT, pattern: DEFAULT_PATTERN });
    const idx = result.indexOf('-ip');
    expect(idx).toBeGreaterThan(-1);
    expect(result[idx + 1]).toBe(ip);
  });

  it('passes the port value verbatim', () => {
    const port = '9999';
    const result = buildLoggerClientArgs({ ip: SAMPLE_IP, port, pattern: DEFAULT_PATTERN });
    const idx = result.indexOf('-port');
    expect(idx).toBeGreaterThan(-1);
    expect(result[idx + 1]).toBe(port);
  });

  it('passes the pattern value verbatim (spaces and special chars are preserved)', () => {
    const result = buildLoggerClientArgs({
      ip: SAMPLE_IP,
      port: DEFAULT_PORT,
      pattern: DEFAULT_PATTERN,
    });
    const idx = result.indexOf('-pattern');
    expect(idx).toBeGreaterThan(-1);
    expect(result[idx + 1]).toBe(DEFAULT_PATTERN);
  });

  // ── All-or-nothing rule ───────────────────────────────────────────────────

  it('returns empty array when IP is undefined (all-or-nothing)', () => {
    // Simulates: sendParams=true but deviceIpAddress=null  →  params=undefined
    const result = buildLoggerClientArgs({ port: DEFAULT_PORT, pattern: DEFAULT_PATTERN });
    /**
     * EXPECTED TO FAIL with a naive implementation that guards each flag
     * independently:
     *
     *   if (args?.ip)      spawnArgs.push('-ip',      args.ip);      // skipped ✓
     *   if (args?.port)    spawnArgs.push('-port',    args.port);    // added   ✗
     *   if (args?.pattern) spawnArgs.push('-pattern', args.pattern); // added   ✗
     *
     *   Result would be: ['-port','10000','-pattern','%d [%c{1}] %p - %m']
     *   Expected:        []
     */
    expect(result).toEqual([]);
  });

  it('returns empty array when IP is an empty string (all-or-nothing)', () => {
    // Simulates: user opens the dialog, clears the IP field, clicks Open
    const result = buildLoggerClientArgs({ ip: '', port: DEFAULT_PORT, pattern: DEFAULT_PATTERN });
    /**
     * Same failure mode as the test above — a naive guard treats '' as falsy
     * for -ip but still appends -port and -pattern.
     */
    expect(result).toEqual([]);
  });

  // ── Optional flags ────────────────────────────────────────────────────────

  it('omits -port when port is absent', () => {
    const result = buildLoggerClientArgs({ ip: SAMPLE_IP, pattern: DEFAULT_PATTERN });
    expect(result).not.toContain('-port');
    expect(result).toContain('-ip');
    expect(result).toContain('-pattern');
  });

  it('omits -pattern when pattern is absent', () => {
    const result = buildLoggerClientArgs({ ip: SAMPLE_IP, port: DEFAULT_PORT });
    expect(result).not.toContain('-pattern');
    expect(result).toContain('-ip');
    expect(result).toContain('-port');
  });

  it('produces only -ip when only IP is provided', () => {
    const result = buildLoggerClientArgs({ ip: SAMPLE_IP });
    expect(result).toEqual(['-ip', SAMPLE_IP]);
  });

  // ── Argument ordering ─────────────────────────────────────────────────────

  it('always places -ip before -port and -pattern', () => {
    const result = buildLoggerClientArgs({
      ip: SAMPLE_IP,
      port: DEFAULT_PORT,
      pattern: DEFAULT_PATTERN,
    });
    const ipIdx      = result.indexOf('-ip');
    const portIdx    = result.indexOf('-port');
    const patternIdx = result.indexOf('-pattern');
    expect(ipIdx).toBeLessThan(portIdx);
    expect(portIdx).toBeLessThan(patternIdx);
  });
});
