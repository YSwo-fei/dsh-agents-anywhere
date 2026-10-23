# 多版本适配（DSH 版本兼容）

插件不开自己的 DSH 副本，它跑在宿主 DSH 进程里，调用宿主注册的服务和事件。所以“适配多个 DSH 版本”= **只依赖最小的必需面 + 其余全部降级 + 版本变化时给出可读的诊断**，而不是给每个版本发一个包。

## 版本范围（peerDependencies）

| 依赖 | 范围 | 说明 |
| --- | --- | --- |
| `@deepseek-ai/cordis` | `>=4.0.0 <6` | 4.x 全系（含 4.0.4/4.0.5），5.x 视为兼容；6 起需重测 |
| `@deepseek-ai/dsh-typert-protocol` | `>=0.2.0-rc.1 <0.4.0-0` | RPC 协议生成物；跨大版本必须重生成 |
| `@deepseek-ai/dsh-session` / `dsh-session-title` | `>=0.2.0-rc.1 <0.4.0-0` | 会话对象与标题折叠 |
| `@deepseek-ai/schemastery` | `>=3.18.0 <4` | 配置 schema |
| `react` | `>=18.3.1 <20` | 客户端由宿主提供 |

已实测：**DSH Desktop 0.2.1-rc.2**（Windows，Electron）。启用 `check:compat` 后可以对任意新版本先做静态核对再升级。

## 必需 vs 可选

| 服务 | 缺失时 |
| --- | --- |
| `sessions`、`sessionQuery`、`workspaceRegistry` | **必需**。缺失时插件不激活，并写一条 `compat.blocked` 日志点名缺哪个服务（不再静默） |
| `agents` | 会话状态列消失，其余可用 |
| `sessionController` | 降级为**只读**：能看会话，不能发消息/中断 |
| `attachments`、`fileUploads` | 附件能力关闭 |
| `llm`、`permissionPresets`、`agentPresets` | 对应的模型/权限/模式选择关闭，面板显示不可选 |
| `commands` | DSH 命令列表关闭 |
| `sessionProjections` | 模型选择回退到读会话日志 |
| `questions` | 不再展示用户提问/审批 |

降级判定都在运行时通过 `ctx.get(name) !== undefined` 完成，再由 `capabilities.ts` 上报给手机端，所以旧版本上你能看到“哪些按钮为什么灰”。

## 版本变化时会得到什么

1. **日志**：`compat.probe` 记录宿主版本与可用服务；缺必需服务时 `compat.blocked` 明确写“当前 DSH 未提供 X 服务，请升级或降级插件”。
2. **状态文件**：`<stateRoot>/compat.json` 留一份机器可读快照，报 issue 时直接附上。
3. **可读错误**：服务在运行时消失（不只是启动时）会变成 `DSH_SERVICE_UNAVAILABLE`，而不是 `TypeError: Cannot read properties of undefined`。
4. **标题折叠容错**：`dsh-session-title` 的导出契约变化时标题退化为“无标题”，不影响会话读取。

## 自检命令

```bash
yarn check:compat                     # 探测默认路径（./node_modules、Desktop 的 app.asar、$DSH_CHECKOUT）
yarn check:compat /path/to/dsh/node_modules
```

输出逐项对齐必需/可选服务与事件，缺必需项时退出码 1。它只读 `.d.ts`，不启动 DSH，所以可以在升级前对候选版本先跑一遍。

## 为什么装完必须重启 DSH

插件是**宿主侧 bundle**，DSH 在进程启动时加载 profile 的 bundles 列表，`dsh plugin` 只负责 pnpm 装包，没有热重载入口（`dsh plugin --help` 就是转发给 pnpm）。所以任何插件升级（包括这个多版本改造）都要重启 DSH 一次才生效——这与版本适配无关，是加载时机决定的。
