/**
 * Static compatibility probe: compares the DSH API surface this plugin consumes with the surface an
 * installed DSH implementation actually declares. It never boots DSH, so it is safe to run against a
 * fresh install, a candidate upgrade, or an Electron bundle before switching.
 *
 * Usage: node scripts/check-compat.ts [dsh-implementation-dir ...]
 * Defaults: ./node_modules, %DSH_CHECKOUT%, and the Desktop bundle when present.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { consumedEvents, consumedServices } from '../src/host/compat.ts'

const defaults = [
  join(process.cwd(), 'node_modules'),
  process.env['DSH_CHECKOUT'] ?? '',
  'D:/DSH/resources/app.asar/dsh/node_modules',
  '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules',
].filter(Boolean)

async function collectTypeFiles(root: string): Promise<string[]> {
  const found: string[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 4) return
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path, depth + 1)
      else if (entry.name.endsWith('.d.ts')) found.push(path)
    }
  }
  await walk(root, 0)
  return found
}

async function scan(roots: string[]): Promise<{ text: string; files: number; root: string } | null> {
  for (const root of roots) {
    const present = await stat(root).then(() => true, () => false)
    if (!present) continue
    const files = await collectTypeFiles(root)
    if (files.length === 0) continue
    const chunks = await Promise.all(files.map(file => readFile(file, 'utf8').catch(() => '')))
    return { text: chunks.join('\n'), files: files.length, root }
  }
  return null
}

const scanned = await scan(process.argv.slice(2).length ? process.argv.slice(2) : defaults)
if (!scanned) {
  console.error('找不到 DSH 实现目录（尝试了: ' + defaults.join(', ') + '）')
  process.exit(2)
}

/** Services arrive as `interface Context { name: Service }` augmentations; events as string literals. */
const hasService = (name: string): boolean =>
  new RegExp(`interface\\s+Context[\\s\\S]{0,4000}?\\b${name}\\s*:`, 'm').test(scanned.text) ||
  new RegExp(`\\b${name}\\s*:\\s*[A-Z]`, 'm').test(scanned.text)
const hasEvent = (name: string): boolean => scanned.text.includes(`'${name}'`) || scanned.text.includes(`"${name}"`)

const rows: { kind: string; name: string; present: boolean; note: string }[] = Object.entries(consumedServices)
  .map(([key, entry]) => ({
    kind: entry.required ? '必需服务' : '可选服务',
    name: key,
    present: hasService(key),
    note: entry.note,
  }))
for (const event of consumedEvents) rows.push({ kind: '事件', name: event, present: hasEvent(event), note: '' })

const width = Math.max(...rows.map(row => row.name.length))
console.log(`DSH 实现：${scanned.root}（${scanned.files} 个类型文件）`)
for (const row of rows) {
  console.log(`${row.present ? '✓' : '·'} ${row.kind}  ${row.name.padEnd(width)}  ${row.note}`)
}
const missingRequired = rows.filter(row => row.kind === '必需服务' && !row.present)
const missingEvents = rows.filter(row => row.kind === '事件' && !row.present)
if (missingRequired.length || missingEvents.length) {
  console.log(`\n不兼容：缺少 ${[...missingRequired, ...missingEvents].map(row => row.name).join('、')}`)
  process.exit(1)
}
console.log('\n兼容：插件消费的全部必需服务与事件都在此 DSH 版本中声明。')
