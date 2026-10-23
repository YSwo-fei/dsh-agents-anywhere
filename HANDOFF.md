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

## 2026-10-23 15:40（v2.1.6）连接失败根因：IPv6 fake-ip

- 面板报「无法连接服务器，请检查地址和网络后重试」，logs/onboarding.jsonl 里对应一条 rror + 该 message（日志带 message 的改动生效）。
- 根因：本机 DNS 对 web.agents-anywhere.com 同时返回 198.18.0.32（fake-ip，可用）与 2001:2::1f（不可达）。Node 默认 erbatim 顺序优先 IPv6 → etch 抛 TypeError: fetch failed (ECONNRESET)；curl 走 IPv4 正常（200，1.5s），Python connector 也会自动回退 IPv4（TLS 0.11s 成功）。
- 修复：src/host/net/family.ts 的 preferIpv4()，在 src/host/index.ts 的 pply() 里调用 dns.setDefaultResultOrder('ipv4first')，配置项 preferIpv4（默认 true）可关。
- 验证：
ode -e "fetch(...)" 默认顺序 → ECONNRESET；equire('dns').setDefaultResultOrder('ipv4first') 后 → 200，386ms。新增 	ests/unit/resolver-family.test.ts。
- 已装：dsh-plugin-agents-anywhere-2.1.6.tgz（desktop profile），**需重启 DSH 生效**。

## 2026-10-23 16:07 —— 2.1.6 实测通过，仓库已上传

- 2.1.6 修掉的两处：连接失败的真因是 Node 默认 verbatim 解析在 fake-ip VPN 上拿到不可路由的 IPv6（ECONNRESET）；apply() 现在默认 \setDefaultResultOrder('ipv4first')\，配置项 \preferIpv4: false\ 可关掉。另有 manager 锁死实例自愈、manager 端口 socket 未捕获异常导致 Host 崩溃两处修复。
- 隔离实测（克隆 state 目录 + 克隆 profile，未动桌面实例）：idle → authorizing → pairing（登录成功）→ starting → \connector.control_connected\ → \connector.state_changed {"running":true}\，uv 自动检测到 PATH 上的 uv，venv 装 55 包后 connector 以 python 运行。测试残留已清理。
- GitHub: https://github.com/YSwo-fei/dsh-agents-anywhere
- 桌面实例仍是 2.1.5 进程（bundle 只在启动时加载），重启后生效。

## 2026-10-23 17:50 —— 2.2.0：多版本适配

- 新增 `src/host/compat.ts`：探测宿主已注册的服务（必需/可选）、写 `<stateRoot>/compat.json`、缺必需服务时 `compat.blocked` 明确点名；`watchServiceReadiness` 覆盖 Cordis「依赖缺失导致插件静默不加载」这种无报错情形。
- `foldSessionTitle` 调用包了容错，标题折叠契约变化时只丢标题，不影响会话读取。
- peerDependencies 放宽：cordis `>=4.0.0 <6`、dsh-typert-protocol / dsh-session / dsh-session-title `>=0.2.0-rc.1 <0.4.0-0`、schemastery `>=3.18.0 <4`、react `>=18.3.1 <20`。
- `scripts/check-compat.ts` + `yarn check:compat`：只读 .d.ts，静态对齐服务与事件；已对 Desktop 0.2.1-rc.2 跑通全绿。
- 实测（隔离 profile + 复制 state）：2.2.0 启动后 `connector.state_changed {"running":true}`；`compat.json` 正确报出 headless 环境下 `sessionController`/`questions` 缺失。
- 操作事实：`dsh.cmd` 的 CLI 进程实际是 `DeepSeek Harness.exe`（`ELECTRON_RUN_AS_NODE=1`），按 `node.exe` 过滤杀不掉；清理测试实例要按命令行含 profile 名匹配。
- 已知现象：无网页端接管时，onboarding 等设备上线最多 120s，超时后连接器会退出并报错（属预期）。
