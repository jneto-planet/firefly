/**
 * Regression test: "Cannot send config to terminal when more than one device is connected"
 *
 * Root cause: restartApp() called adb() (no -s flag) instead of adbs(serial, ...)
 * When ADB sees multiple connected devices and no -s flag, it errors with
 * "error: more than one device/emulator" and refuses to run the command.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// --- Mocks (must be hoisted before any real imports) ---

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp') },
}));

vi.mock('node:fs', () => ({
  default: { existsSync: vi.fn(() => false) },
  existsSync: vi.fn(() => false),
}));

vi.mock('../config', () => ({
  loadConfig: vi.fn(() => Promise.resolve({ custom_adb_path: '' })),
  saveConfig: vi.fn(() => Promise.resolve()),
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(() => '/usr/bin/adb'),
}));

// --- Import SUT after mocks are in place ---

import { spawn } from 'node:child_process';
import { restartApp } from '../adb';

// --- Helpers ---

/** Creates a fake ChildProcess that emits close after a tick. */
function mockProcess(exitCode: number, stderr = '', stdout = '') {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  proc.pid = 9999;
  setImmediate(() => {
    if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
    if (stderr) proc.stderr.emit('data', Buffer.from(stderr));
    proc.emit('close', exitCode);
  });
  return proc;
}

/** Returns a process that succeeds (exit 0). */
const successProcess = () => mockProcess(0, '', '');

/**
 * Returns a process that simulates ADB's behaviour when multiple devices are
 * connected and no -s flag is provided: exit 1 + "more than one device" error.
 */
const multiDeviceErrorProcess = () =>
  mockProcess(1, 'error: more than one device/emulator', '');

// --- Tests ---

describe('restartApp – multi-device bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (spawn as ReturnType<typeof vi.fn>).mockImplementation(() => successProcess());
  });

  it('passes the device serial (-s <serial>) to every ADB command', async () => {
    const serial = 'EMULATOR_5554';
    const pkg = 'com.example.terminal';

    await restartApp(serial, pkg);

    const calls = (spawn as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    /**
     * Without the fix, adb() is invoked (no -s flag).
     * This assertion will FAIL before the fix is applied:
     *   Expected: true
     *   Received: false  ← -s not found in spawn args
     */
    for (const [, args] of calls as [string, string[]][]) {
      const idx = args.indexOf('-s');
      expect(idx, `spawn called without -s flag: ${JSON.stringify(args)}`).toBeGreaterThan(-1);
      expect(args[idx + 1]).toBe(serial);
    }
  });

  it('targets only the selected device and not any other connected device', async () => {
    const serial = 'DEVICE_TARGET';
    const otherSerial = 'DEVICE_OTHER';

    await restartApp(serial, 'com.example.terminal');

    for (const [, args] of (spawn as ReturnType<typeof vi.fn>).mock.calls as [string, string[]][]) {
      const idx = args.indexOf('-s');
      if (idx !== -1) {
        expect(args[idx + 1]).not.toBe(otherSerial);
        expect(args[idx + 1]).toBe(serial);
      }
    }
  });

  it('still succeeds when the multi-device error would occur without a serial flag', async () => {
    /**
     * Simulate real ADB behaviour: calls WITHOUT -s fail with "more than one
     * device/emulator" (exit 1); calls WITH a valid -s succeed (exit 0).
     *
     * After the fix, restartApp always passes -s, so no call hits the error path.
     * Before the fix, the force-stop and monkey calls lack -s and would fail.
     */
    (spawn as ReturnType<typeof vi.fn>).mockImplementation((_cmd: string, args: string[]) => {
      if (!args.includes('-s')) return multiDeviceErrorProcess();
      return successProcess();
    });

    const result = await restartApp('DEVICE_SERIAL', 'com.example.terminal');

    // The function should complete successfully (true) because -s is always used
    expect(result).toBe(true);

    // Verify no ADB call was made without the serial flag
    for (const [, args] of (spawn as ReturnType<typeof vi.fn>).mock.calls as [string, string[]][]) {
      expect(
        args.includes('-s'),
        `ADB called without -s (would fail with multiple devices): ${JSON.stringify(args)}`,
      ).toBe(true);
    }
  });
});
