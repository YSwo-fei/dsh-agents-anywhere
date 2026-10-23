import { homedir, userInfo } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { CLOUD_API_BASE_URL, type ConnectionSettings } from '../contracts/index.js'
import { normalizeServerOrigin } from './account/server.js'

export interface Config {
  dshHome?: string
  apiBaseUrl?: string
  stateRoot?: string
  connectorSourceDir?: string
  uvPath?: string
  /** Ask Node for IPv4 addresses first; turn off on networks where IPv6 is the working path. */
  preferIpv4?: boolean
  /**
   * Who owns this machine's device: this plugin, or the Agents Anywhere desktop app.
   * 'plugin' keeps an independent device so DSH stays remote-controllable even when
   * the desktop app is installed and running; 'desktop' defers to the app.
   */
  deviceOwnership?: string
}

export const Config: z<Config> = z.object({
  dshHome: z.string(),
  apiBaseUrl: z.string().default(CLOUD_API_BASE_URL),
  stateRoot: z.string(),
  connectorSourceDir: z.string(),
  uvPath: z.string(),
  preferIpv4: z.boolean().default(true),
  deviceOwnership: z.string().default('plugin'),
})

export interface ResolvedConfig extends ConnectionSettings {
  dshHome?: string
  stateRoot: string
  legacyStateRoot?: string
  connectorSourceDir: string
  uvPath: string
  deviceOwnership: 'plugin' | 'desktop'
}

export function stateRoot(config: Config): string {
  return config.stateRoot ?? join(userInfo().homedir, '.agents-anywhere', 'dsh-bridge-next')
}

/** Fixed per-user rendezvous with the Connector; DSH_HOME and stateRoot do not move it. */
export function bridgeDirectory(): string {
  return join(userInfo().homedir, '.agents-anywhere', 'dsh-bridge')
}

/**
 * Where plugins before 2.0.3 published the endpoint. Connectors before 2.0.3 look only here, so
 * the bridge mirrors its endpoint to this directory; it is resolved exactly as those plugins did.
 */
export function legacyBridgeDirectory(config: Config): string | undefined {
  const home = config.dshHome ?? process.env['DSH_HOME'] ?? join(homedir(), '.dsh')
  return isAbsolute(home) ? join(home, 'agents-anywhere', 'bridge') : undefined
}

function resolveOwnership(value: string | undefined): 'plugin' | 'desktop' {
  if (value === undefined || value === 'plugin' || value === 'desktop') return value ?? 'plugin'
  throw new Error("deviceOwnership 必须是 'plugin' 或 'desktop'。")
}

export function resolveConfig(config: Config): ResolvedConfig {
  if (config.dshHome !== undefined && !isAbsolute(config.dshHome)) throw new Error('DSH_HOME 必须是绝对路径。')
  const root = stateRoot(config)
  const connectorSourceDir = config.connectorSourceDir ?? fileURLToPath(new URL('./bundled-connector/', import.meta.url))
  if (!isAbsolute(root) || !isAbsolute(connectorSourceDir)) throw new Error('数据目录和 Connector 源码目录必须是绝对路径。')
  return {
    ...(config.dshHome !== undefined ? { dshHome: config.dshHome } : {}),
    stateRoot: root,
    ...(config.stateRoot === undefined ? { legacyStateRoot: join(userInfo().homedir, '.agentsanywhere', 'dsh-bridge-next') } : {}),
    connectorSourceDir,
    apiBaseUrl: normalizeServerOrigin(config.apiBaseUrl ?? CLOUD_API_BASE_URL),
    uvPath: config.uvPath ?? process.env['UV_PATH'] ?? 'uv',
    deviceOwnership: resolveOwnership(config.deviceOwnership),
  }
}
