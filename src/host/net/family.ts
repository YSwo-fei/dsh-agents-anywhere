import { setDefaultResultOrder } from 'node:dns'

/**
 * Prefer IPv4 addresses when a host name resolves to both families.
 *
 * Some VPN and proxy stacks on Windows run a TUN adapter with fake-ip DNS: every public name
 * resolves to both a routable IPv4 address and a made-up IPv6 one. Node resolves "verbatim" and
 * tries the IPv6 address first, so every request to the server dies with ECONNRESET while curl and
 * browsers (which arrive over IPv4) work fine. Preferring IPv4 keeps IPv6 as the fallback for hosts
 * that publish no A record, so nothing is lost where IPv6 actually works.
 */
export function preferIpv4(): void {
  try {
    setDefaultResultOrder('ipv4first')
  } catch {
    // Older runtimes without the option keep Node's own order; nothing else to do here.
  }
}
