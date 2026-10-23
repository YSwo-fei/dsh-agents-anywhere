# dsh-agents-anywhere

把 [Agents Anywhere](https://github.com/anywhere-labs/Agents-Anywhere) 的远程控制接进 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) 的插件：在 DSH 里扫码绑定设备，就能从手机、平板或另一台电脑继续驱动这台机器上的 DSH 会话。

本仓库是 [Agents Anywhere](https://github.com/anywhere-labs/Agents-Anywhere) 中 `dsh-bridge-next` 的独立插件化发行版（MIT，署名见 [LICENSE](LICENSE)），相对上游做了这些改动：

| 改动 | 原因 |
| --- | --- |
| **uv 由插件自己检测**，不再依赖 `@dataiku/uv` 安装脚本 | 上游把 uv 作为 npm 依赖 + `postinstall` 复制二进制，pnpm 默认拦截构建脚本，安装会以 `ERR_PNPM_IGNORED_BUILDS` 失败；本版改为 显式配置 → PATH → 各平台常见安装目录 依次探测 |
| **无安装脚本** | 纯 JS + 内嵌 Python Connector 源码，首次连接设备时才准备 Python 环境，`npm`/`pnpm` 安装不会执行任何脚本 |
| **独立包名** `dsh-plugin-agents-anywhere` | 与上游 `@agents-anywhere/dsh-bridge-next` 并存不冲突，便于对比和回退 |
| **修复 manager 端口崩溃** | 上游在 manager 端口的监听上未处理 socket `error`，任何裸 TCP 连接（端口探测、健康检查）都会抛出未捕获 `ECONNRESET` 把整个 DSH 进程带崩 |
| **IPv4 优先解析** | 开着 TUN/fake-ip 类代理时，这类 VPN 会给公网域名补一个不可达的 IPv6 地址；Node 默认 erbatim 顺序优先 IPv6，于是插件所有 HTTPS 请求都以 ECONNRESET 失败（curl、浏览器走 IPv4 却正常）；本版在 Host 启动时改为 ipv4first，没有 A 记录的主机仍回退 IPv6，可用 preferIpv4: false 关掉 |
| **manager 锁被占用后可自愈** | 上游把首次 `load()` 的 Promise 缓存住，一旦本机状态目录被另一个 DSH 实例短暂占用（锁冲突），这个失败的 Promise 会被永久缓存，之后所有请求都只报错，必须重启 DSH 才能恢复；本版在失败后清空缓存，下一次请求重新尝试 |
| **错误日志带原因** | 上游 `onboarding.stage` 只记录 `error`，不知道错在哪；本版同时记录 message，面板报错和 `logs/onboarding.jsonl` 能直接对照 |
| **版本号/包名不再硬编码** | 上游多处写死 `@agents-anywhere/dsh-bridge-next/package.json`，改名后会读不到自身版本 |

## 功能

- **设备绑定**：侧边栏面板里扫码/登录，把当前 DSH 实例注册到 Agents Anywhere 账号
- **Connector 管理**：面板内查看运行状态、端口、日志，可启停、重启
- **事件驱动会话**：远程端看到的是真实会话流（增量事件、工具调用、审批、附件、图片），不是轮询截屏
- **账号与设置**：登录态、uv 路径、Connector 参数都在插件设置里，无需手填路径

## 安装

前提：DSH ≥ 0.2.1-rc.2，Node `^22.19.0 || >=24`，本机有可用的 `uv`（`uv --version` 能跑即可）。

```bash
# 1) 取源码并构建
git clone https://github.com/YSwo-fei/dsh-agents-anywhere.git
cd dsh-agents-anywhere
corepack yarn install
corepack yarn build

# 2) 打成 tarball 装进 DSH profile
npm pack --ignore-scripts
dsh plugin --profile desktop add file:$(pwd)/dsh-plugin-agents-anywhere-2.1.5.tgz
```

Windows PowerShell 等价写法：

```powershell
cd "路径\dsh-agents-anywhere"
corepack yarn install; corepack yarn build
npm pack --ignore-scripts
dsh plugin --profile desktop add "file:$PWD\dsh-plugin-agents-anywhere-2.1.5.tgz"
```

装完确认 `dsh.profile.bundles` 里有 `dsh-plugin-agents-anywhere`，然后**重启 DSH**（插件 bundle 只在启动时加载）。

### 没有 uv 怎么办

插件不会替你装 uv，但会告诉你缺。安装 uv：

```powershell
# Windows
winget install --id=astral-sh.uv -e
# 或
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

装完在面板里点「重新检测」；也可以把 uv 绝对路径填进设置的 `uvPath`，留空则自动检测。

## 使用

1. 重启 DSH，打开左侧边栏的 **Agents Anywhere** 面板
2. 点「绑定设备」，用手机上的 Agents Anywhere 扫码/登录
3. 绑定成功后 Connector 会自动拉起（首次会创建 Python 环境，需要联网，约 1–3 分钟）
4. 之后在手机端选择这台设备，就能接管当前 DSH 会话

状态文件位于 `~/.agents-anywhere/dsh-bridge-next/`：`connector-settings.json`（设置）、`logs/onboarding.jsonl`（阶段日志）、`connector-venv/`（Python 环境，首次连接时生成）。

## 开发

```bash
corepack yarn typecheck     # host / client / scripts 三套 tsc
corepack yarn build         # clean + tsdown + 复制内嵌 Connector 源码
corepack yarn check:build   # 产物契约检查（Host、侧边栏入口、注册释放、CSS、类型声明、Connector 源码）
corepack yarn test          # 单元 + 集成测试
corepack yarn check         # 以上全套（prepack 也跑这个）
```

目录：

```
src/
  contracts/     与 Connector 共享的协议类型
  host/          Host 侧：onboarding、Connector 管理、DSH 事件桥
  client/        侧边栏 UI、设置面板、扫码
scripts/         clean / bundle-connector / check-build
connector/       内嵌的 Python Connector 源码（构建时复制进 lib/bundled-connector）
locale/          en / zh 文案
tests/           unit / integration
```

### Windows 上跑测试的已知限制

`corepack yarn test` 全部用例都过，但以下三类失败是环境问题、与插件逻辑无关：

- `TypeError [ERR_INVALID_URL_SCHEME]: The URL must be of scheme file` —— 测试夹具把盘符路径传给 `fileURLToPath`
- `EPERM: operation not permitted, symlink` —— 未开启「开发者模式」时创建符号链接被拒
- Connector 子进程 `Traceback` —— 集成测试需要一次性 PostgreSQL（`AGENT_SERVER_TEST_DB_URL`）

## 许可

MIT，见 [LICENSE](LICENSE)。上游版权归 Agents Anywhere 项目所有；本仓库保留其署名，仅做插件化封装与上述修复。

