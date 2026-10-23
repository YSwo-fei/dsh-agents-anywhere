import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import { userInfo } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import type { ResolvedConfig } from '../config.js'
import type { ConnectorSettings } from '../../contracts/connector.js'

/** Host-side locale detection also works before a Client connects or in headless mode. */
export async function systemLanguages(): Promise<string[]> {
  const languages = [Intl.DateTimeFormat().resolvedOptions().locale]
  const locale = process.env['LC_ALL'] || process.env['LC_MESSAGES'] || process.env['LANG']
  if (locale) languages.push(locale)
  languages.push(...(process.env['LANGUAGE'] ?? '').split(':').filter(Boolean))
  if (process.platform === 'darwin') {
    try {
      // Node can inherit an English shell locale even when macOS prefers Chinese.
      const { stdout } = await promisify(execFile)('/usr/bin/defaults', ['read', '-g', 'AppleLanguages'], {
        encoding: 'utf8', timeout: 1500, windowsHide: true,
      })
      languages.push(...(stdout.match(/[a-z]{2,3}(?:[-_][a-z0-9]+)*/gi) ?? []))
    } catch { /* Use Intl and POSIX locales when system preferences are unavailable. */ }
  }
  return languages
}

/** Where the uv installer actually puts its binary, per platform, including places a GUI launch's PATH omits. */
function installationDirectories(home: string): string[] {
  const env = process.env
  if (process.platform === 'win32') {
    const localAppData = env['LOCALAPPDATA'] ?? join(home, 'AppData', 'Local')
    const appData = env['APPDATA'] ?? join(home, 'AppData', 'Roaming')
    return [
      join(home, '.local', 'bin'),
      join(home, '.cargo', 'bin'),
      join(localAppData, 'Microsoft', 'WinGet', 'Links'),
      join(localAppData, 'Programs', 'uv'),
      join(home, 'scoop', 'shims'),
      join(appData, 'Python', 'Scripts'),
      join(env['ProgramFiles'] ?? 'C:\\Program Files', 'uv'),
      join(env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'uv'),
    ]
  }
  const paths = [join(home, '.local', 'bin'), join(home, '.cargo', 'bin')]
  if (process.platform === 'darwin') paths.push('/opt/homebrew/bin', '/usr/local/bin')
  else paths.push('/usr/local/bin', '/usr/bin', '/snap/bin')
  return paths
}

/**
 * Locate the uv executable.
 *
 * The plugin resolves uv itself instead of depending on a package that ships a
 * prebuilt binary: such packages install through a postinstall script, which the
 * plugin manager's package manager refuses to run by default. An explicit path
 * wins; otherwise PATH and the platform's installer directories are searched, so
 * a Connector starts without the user configuring anything.
 */
export async function resolveUv(config: ResolvedConfig, settings: ConnectorSettings): Promise<string | null> {
  const command = settings.uvPath || config.uvPath
  const names = process.platform === 'win32' && !command.toLowerCase().endsWith('.exe') ? [command, `${command}.exe`] : [command]
  const home = userInfo().homedir
  const searchPaths = [
    ...(process.env['PATH'] ?? process.env['Path'] ?? '').split(delimiter).filter(Boolean),
    ...installationDirectories(home),
  ]
  const candidates = isAbsolute(command) ? [command] : searchPaths.flatMap(path => names.map(name => join(path, name)))
  for (const candidate of new Set(candidates)) {
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch { /* Try the next candidate. */ }
  }
  return null
}

export function canOpenFolders(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32' || Boolean(process.env['DISPLAY'] || process.env['WAYLAND_DISPLAY'])
}

/** Called only for a Host-owned directory selected by the user, never a client-supplied path. */
export async function openFolder(path: string): Promise<void> {
  if (!canOpenFolders()) throw new Error('当前环境不支持打开本机目录。')
  await mkdir(path, { recursive: true, mode: 0o700 })
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open'
  try { await promisify(execFile)(command, [path], { timeout: 5_000, windowsHide: true }) }
  catch { throw new Error('无法打开目录，请检查本机文件管理器是否可用。') }
}
