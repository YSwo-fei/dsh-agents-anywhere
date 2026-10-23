import type { Context } from '@deepseek-ai/cordis'
import { OnboardingService } from './rpc/service.js'
import { Config } from './config.js'
import { DshRuntimeService } from './dsh-runtime/index.js'
import { preferIpv4 } from './net/family.js'

export { Config } from './config.js'

export const name = 'agents-anywhere-bridge-next'

export function apply(ctx: Context, config: Config): void {
  // The server is reached over HTTPS from this Host process; on fake-ip VPN stacks the IPv6
  // address that DNS answers with is unroutable, so ask Node for IPv4 first unless told otherwise.
  if (config.preferIpv4 !== false) preferIpv4()
  ctx.plugin(DshRuntimeService, config)
  ctx.plugin(OnboardingService, config)
}
