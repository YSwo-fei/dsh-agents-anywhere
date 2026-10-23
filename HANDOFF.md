# 进度存档（2026-10-22 深夜，休眠前）

## 目标（用户指令，按顺序）
1. 把已安装的官方远程控制插件删掉，换成我们自己的插件版。
2. 路径（uv 等）不要手填，交给插件自己检测。
3. 先在本机做插件测试。
4. （之后）上传 GitHub。

## 当前状态

### 已完成
- **旧插件已卸载**：`dsh plugin --profile desktop remove @agents-anywhere/dsh-bridge-next` 退出码 0。
  - `E:\dsh-data\.dsh\profiles\desktop\package.json` 的 `dsh.profile.bundles` 已无该包（末项现为 `dsh-plugin-bilibili`）。
  - `node_modules\@agents-anywhere`、`node_modules\@dataiku` 均已消失。
- **源码已恢复**：上一轮构建目录 `Agents-Anywhere-src\...\dsh-bridge-next` 被清空（17:12），已从工作区 `Agents-Anywhere-main.zip` 重新解出 → `E:\DSH CODE\_aa_recover\`（95 个源文件 / 574 KB）。
- **新插件仓库骨架**：`E:\DSH CODE\dsh-agents-anywhere\`（src、scripts、locale、tests、docs、cordis.patch.yml、tsconfig*、tsdown.config.ts、.yarnrc.yml、yarn.lock）。
- **依赖安装成功**：`corepack yarn install` 退出码 0（需在仓库内存在 `yarn.lock`，否则 yarn 认为它属于上层 `E:\DSH CODE` 项目而报 `Usage Error: ... doesn't seem to be part of the project declared in E:\DSH CODE`）。
- **typecheck 通过**：`corepack yarn typecheck` 退出码 0（改动后）。

### 已落地的 4 处改造
- `src/host/connector/environment.ts`：`resolveUv(config, settings)` 重写——**去掉 `@dataiku/uv`**，改为 显式 uvPath → PATH → 平台安装目录（win: `%USERPROFILE%\.local\bin`、`%LOCALAPPDATA%\Microsoft\WinGet\Links`、`%LOCALAPPDATA%\Programs\uv`、`scoop\shims`、`%APPDATA%\Python\Scripts`、`Program Files\uv`；mac: `/opt/homebrew/bin`、`/usr/local/bin`；linux: `/usr/local/bin`、`/usr/bin`、`/snap/bin`）。这叫「插件自己检测」。
- `src/host/storage/files.ts`：`acquireManagerLock` 里 lease 服务器 `createServer(socket => { socket.on('error', () => undefined); socket.end(\`${token}\n\`) })`——修掉裸 TCP 探测触发未捕获 `ECONNRESET` 导致整个 DSH 进程崩溃的问题（实测复现过）。
- `src/host/dsh-runtime/bridge-service.ts`：`const BRIDGE_VERSION = packageVersion('../package.json')`（原为硬编码 `@agents-anywhere/dsh-bridge-next/package.json`）。
- `src/client/plugin-settings.tsx`：`const PACKAGE = 'dsh-plugin-agents-anywhere'`。
- 文案：`src/client/locales.ts:248` 与 `src/client/features/onboarding/settings-panel.tsx:98` 由「留空使用内置 uv」改为「留空自动检测 uv」。
- `package.json`：name `dsh-plugin-agents-anywhere`、version `2.1.1`、`dependencies` 去掉 `@dataiku/uv`（剩 clsx / lucide-react / meshcall / qrcode）、补 repository/homepage/bugs/keywords/contributors（署名上游 anywhere-labs/Agents-Anywhere，MIT）。

## 下一步（续做顺序）
1. `cd "E:\DSH CODE\dsh-agents-anywhere"; corepack yarn build`（= clean + tsdown + bundle-connector），然后 `corepack yarn check:build`。
2. 验证产物：`lib/index.js`、`lib/client.js`、`lib/bundled-connector/` 是否存在；`node -e "import('./lib/index.js')"` 应导出 `Config, apply, name`。
3. `npm pack --ignore-scripts` → tarball，然后 `dsh plugin --profile desktop add file:<tgz>`（此版本已无 postinstall 依赖，理论上不再需要 `allowBuilds`；此前为 `@dataiku/uv` 加的 `allowBuilds: '@dataiku/uv': true` 仍在 `E:\dsh-data\.dsh\profiles\desktop\pnpm-workspace.yaml`，可留可删）。
4. 检查 `profiles/desktop/package.json` 的 `dsh.profile.bundles` 是否自动追加 `dsh-plugin-agents-anywhere`（上一版 `add` 因 pnpm 报错未追加，这次应自动写入；若没有要手工补）。
5. 本机测试：用 `dsh --profile <临时profile> --from-default-profile web --dump-config` 合成配置确认插件条目，再 `--port 0 --no-open` 起 web 验证 client bundle 200、manager 锁文件生成、日志 `onboarding.stage idle`；测完删临时 profile。
6. GitHub 上传：**缺凭据**——无 `GITHUB_TOKEN`、无 gh CLI、无 credential helper；本机 git https 还坏（`fatal: failed to load library 'libcurl-4.dll'`）。工作区 `E:\DSH CODE\gh_push.mjs` 可走 REST API 推送（用法 `node gh_push.mjs <owner/repo> <本地目录> <分支> [commit-msg 文件]`，需 `GITHUB_TOKEN`）。用户身份 `feiyuai` / 3553264347@qq.com，仓库名待定 `dsh-agents-anywhere`。

## 尚未完成/注意
- 插件尚未 build、尚未打包安装、尚未本机跑通、尚未建 git 仓库（无 `.git`）、README/LICENSE 未写。
- 用户环境网络：github/api.github.com 需代理 `http://127.0.0.1:7897`；npm registry 直连可用（yarn install 未走代理也成功）。
- 状态目录沿用 `~/.agents-anywhere/dsh-bridge-next`（与旧版一致，便于复用已初始化的 connector-venv）；旧版遗留状态另在 `C:\Users\lenovo\.agents-anywhere.old`。

## 2026-10-23 本轮收尾（v2.1.5）

- **已装进本机 desktop profile**：`dsh plugin --profile desktop add file:E:/dsh-data/.dsh/plugins/dsh-plugin-agents-anywhere-2.1.5.tgz`，`dsh.profile.bundles` 末尾为 `dsh-plugin-agents-anywhere`，profile 内只保留本插件（官方 `@agents-anywhere/dsh-bridge-next` 已卸载）。
- **新增修复：manager 锁失败后自愈**（`src/host/onboarding/manager.ts` 的 `initialize()`）。上游把首次 `load()` 的 Promise 缓存住，一旦状态目录被另一个 DSH 实例短暂占用（`ManagerLockHeldError`），这个 reject 的 Promise 会永久缓存，之后每次请求都只报错，只能重启 DSH。现在失败即清空缓存，下一次请求重新尝试。
- **新增：`onboarding.stage` 日志带 message**，面板错误与 `logs/onboarding.jsonl` 能对照。
- **回归测试** `tests/unit/manager-lock-recovery.test.ts`：A 实例持锁 → B 实例 initialize 连续两次都拒绝 → A dispose → B 再 initialize 成功。去掉修复后该用例必失败（已验证）。
- 验证命令（全部通过）：`corepack yarn typecheck`、`yarn build`、`yarn check:build`、`yarn tsx --test tests/unit/manager-lock-recovery.test.ts`。全量 `yarn test` 仍有 Windows 环境性失败（symlink EPERM、`DSH_INTERACTION_RUNTIME_ROOT`、连接器集成测试需要 PostgreSQL），与本插件逻辑无关。
- 本机真实启动验证：用 desktop profile 的克隆 profile 独立 boot 过一次，插件 manager 正常加载并写入状态目录；克隆 profile 与测试状态目录已删除。
- 待办：重启 DSH 后在侧边栏扫码绑定设备做端到端连接验证；上传 GitHub 需要 `GITHUB_TOKEN`。
