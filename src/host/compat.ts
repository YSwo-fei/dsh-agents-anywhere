import type { Context } from '@deepseek-ai/cordis'
import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { stateRoot, type Config } from './config.js'

/**
 * DSH API surface this bridge consumes. The plugin is written against one DSH generation, but a
 * DSH upgrade can rename a service or an event; that must produce a readable diagnosis rather than
 * a silently inactive plugin or a TypeError deep inside a request handler.
 */
export const consumedServices = {
  sessions: { required: true, note: '会话对象、事件流与 flush' },
  sessionQuery: { required: true, note: '会话清单与持久化日志' },
  workspaceRegistry: { required: true, note: '工作目录与归档会话' },
  agents: { required: false, note: '会话运行状态' },
  sessionController: { required: false, note: '发送消息、中断、steer' },
  attachments: { required: false, note: '读取会话附件' },
  fileUploads: { required: false, note: '上传附件' },
  llm: { required: false, note: '模型目录与模型选择' },
  permissionPresets: { required: false, note: '权限预设' },
  agentPresets: { required: false, note: 'Agent 模式' },
  commands: { required: false, note: 'DSH 命令' },
  sessionProjections: { required: false, note: '模型选择投影' },
  questions: { required: false, note: '用户提问' },
} as const

export const consumedEvents = [
  'session/created', 'session/event', 'session/disposed', 'agent/assistant-stream',
  'agent/status', 'domain/changed', 'commands/change', 'llm/adapters-updated',
  'permission-presets/catalog-changed',
] as const

export type ConsumedService = keyof typeof consumedServices
export const requiredServices = (Object.keys(consumedServices) as ConsumedService[])
  .filter(key => consumedServices[key].required)

export interface CompatibilityReport {
  version: string
  services: { key: ConsumedService; required: boolean; present: boolean; note: string }[]
  missingRequired: ConsumedService[]
  missingOptional: ConsumedService[]
}

function hostVersion(): string {
  for (const key of ['DSH_VERSION', 'DSH_DESKTOP_VERSION']) {
    const value = process.env[key]
    if (value) return value
  }
  // The profile cannot always see the SDK (Electron keeps it inside app.asar), so this is a best effort.
  const profile = process.env['DSH_PROFILE_DIR']
  for (const base of [profile, process.argv[1] && join(process.argv[1], '..', '..')]) {
    if (!base) continue
    try {
      const resolved = createRequire(join(base, 'noop.js')).resolve('@deepseek-ai/dsh-app-boot/package.json')
      const version = (JSON.parse(readFileSync(resolved, 'utf8')) as { version?: string }).version
      if (version) return version
    } catch { /* keep looking */ }
  }
  return 'unknown'
}

/** Read-only probe: it reports what the running host registers, never mutates the context. */
export function probeHost(ctx: Context): CompatibilityReport {
  const services = (Object.keys(consumedServices) as ConsumedService[]).map(key => {
    const entry = consumedServices[key]
    let present = false
    try { present = ctx.get(key) !== undefined } catch { present = false }
    return { key, required: entry.required, present, note: entry.note }
  })
  return {
    version: hostVersion(),
    services,
    missingRequired: services.filter(s => s.required && !s.present).map(s => s.key),
    missingOptional: services.filter(s => !s.required && !s.present).map(s => s.key),
  }
}

export function compatFields(report: CompatibilityReport): Record<string, string | number | boolean> {
  return {
    hostVersion: report.version,
    services: report.services.filter(s => s.present).map(s => s.key).join(','),
    missingRequired: report.missingRequired.join(','),
    missingOptional: report.missingOptional.join(','),
  }
}

/** One line per process for support tickets, plus a machine-readable copy in the state root. */
export async function recordCompatibility(ctx: Context, config: Config, report: CompatibilityReport): Promise<void> {
  const details = compatFields(report)
  const line = `DSH 版本 ${report.version}；可用服务 ${details.services || '无'}` +
    `${report.missingRequired.length ? `；缺少必需服务 ${report.missingRequired.join('、')}` : ''}` +
    `${report.missingOptional.length ? `；缺少可选服务 ${report.missingOptional.join('、')}` : ''}`
  try { ctx.logger?.('agents-anywhere').info('compat.probe %s', line) } catch { /* the host logger is optional */ }
  if (report.missingRequired.length === 0 && report.missingOptional.length === 0) return
  try {
    const root = stateRoot(config)
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'compat.json'), `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      plugin: 'dsh-plugin-agents-anywhere',
      hostVersion: report.version,
      services: report.services,
    }, null, 2)}\n`, 'utf8')
  } catch { /* diagnostics must never fail plugin load */ }
}

/**
 * Cordis delays a plugin whose injected services never appear, which looks like a missing sidebar
 * entry with no error at all. Report that explicitly instead of staying silent.
 */
export function watchServiceReadiness(ctx: Context, timeoutMs = 5000): void {
  let started = false
  const timer = setTimeout(() => {
    if (started) return
    const report = probeHost(ctx)
    const missing = report.missingRequired.length ? report.missingRequired : requiredServices
    try {
      ctx.logger?.('agents-anywhere').warn(
        'compat.blocked 本机连接未启动：当前 DSH 未提供 %s 服务。请升级或降级插件到与该 DSH 版本匹配的版本。',
        missing.join('、'))
    } catch { /* the host logger is optional */ }
  }, timeoutMs)
  timer.unref?.()
  ctx.inject([...requiredServices], () => { started = true })
  ctx.effect(() => () => clearTimeout(timer))
}
