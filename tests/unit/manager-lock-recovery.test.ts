import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { OnboardingManager } from '../../src/host/onboarding/manager.js'
import { resolveConfig } from '../../src/host/config.js'

const roots: string[] = []

async function stateRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'aa-manager-'))
  roots.push(root)
  return root
}

after(async () => {
  await Promise.all(roots.map(root => rm(root, { recursive: true, force: true })))
})

function manager(root: string): OnboardingManager {
  return new OnboardingManager(resolveConfig({ stateRoot: root, apiBaseUrl: 'http://127.0.0.1:9' }), {
    // Desktop detection is the only dependency a load needs; keep it off this machine's state.
    detect: async () => ({ status: 'absent', message: '未检测到桌面端。' }),
  })
}

test('a load that loses the manager lock stays retryable instead of failing forever', async () => {
  const root = await stateRoot()
  const owner = manager(root)
  await owner.initialize()

  const contender = manager(root)
  await assert.rejects(contender.initialize(), /另一个插件实例正在管理本机设备/)

  // Ownership is still held elsewhere, so the retry keeps the same honest answer.
  await assert.rejects(contender.initialize(), /另一个插件实例正在管理本机设备/)

  // The second instance was killed without releasing its lease: the next request must succeed.
  await owner.dispose()

  await contender.initialize()
  const snapshot = await contender.inspect()
  assert.equal(snapshot.stage, 'idle')
  await contender.dispose()
})
