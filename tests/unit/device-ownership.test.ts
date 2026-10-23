import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Config, resolveConfig } from '../../src/host/config.js'
import { localMachineRegistry } from '../../src/host/desktop/machine-state.js'
import { OnboardingManager } from '../../src/host/onboarding/manager.js'
import type { DesktopDetection } from '../../src/contracts/index.js'

const running: DesktopDetection = {
  status: 'installed', executablePath: '/example/Agents Anywhere', launchArgs: [], packaged: true,
  message: 'Agents Anywhere 桌面端正在运行。请在桌面端完成连接设置。',
}

function managerAt(home: string, desktop: DesktopDetection, ownership?: 'plugin' | 'desktop') {
  const opened: string[] = []
  const config: Config = {
    stateRoot: join(home, 'plugin'), apiBaseUrl: 'https://api.example.test', connectorSourceDir: home, uvPath: 'uv',
    ...(ownership ? { deviceOwnership: ownership } : {}),
  }
  return {
    opened,
    manager: new OnboardingManager(config, {
      detect: async () => desktop,
      launchDesktop: async () => {},
      connector: {
        onState: () => () => {}, prepare: async () => {}, start: async () => {}, stop: async () => {}, assertHealthy: async () => {},
      },
      checkServer: async () => {},
      machineState: localMachineRegistry(home),
      openFolder: async (path) => { opened.push(path) },
    }),
  }
}

test('device ownership defaults to the plugin and rejects unknown values', () => {
  assert.equal(resolveConfig({}).deviceOwnership, 'plugin')
  assert.equal(resolveConfig({ deviceOwnership: 'desktop' }).deviceOwnership, 'desktop')
  assert.equal(Config({}).deviceOwnership, 'plugin')
  assert.throws(() => resolveConfig({ deviceOwnership: 'both' }), /deviceOwnership 必须是 'plugin' 或 'desktop'/)
});

test('plugin ownership keeps serving when the Desktop app is running', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'aa-ownership-plugin-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const { manager, opened } = managerAt(home, running)
  assert.equal((await manager.inspect()).ownershipMode, 'plugin')
  assert.equal((await manager.inspect()).desktop.status, 'installed')
  await manager.openConnectorFolder('data')
  assert.equal(opened.length, 1, 'the plugin must not hand the device back to the Desktop app')
  await manager.dispose()
})

test('desktop ownership still hands the device back to a running Desktop app', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'aa-ownership-desktop-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const { manager, opened } = managerAt(home, running, 'desktop')
  assert.equal((await manager.inspect()).ownershipMode, 'desktop')
  await assert.rejects(() => manager.openConnectorFolder('data'), /桌面端正在运行/)
  assert.equal(opened.length, 0)
  await manager.dispose()
})

test('desktop ownership keeps working when the Desktop app is not running', async (t) => {
  const home = await mkdtemp(join(tmpdir(), 'aa-ownership-absent-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const { manager, opened } = managerAt(home, { status: 'absent', message: '未检测到桌面端。' }, 'desktop')
  await manager.openConnectorFolder('data')
  assert.equal(opened.length, 1)
  await manager.dispose()
});
