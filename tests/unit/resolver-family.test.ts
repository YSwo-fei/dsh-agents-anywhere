import assert from 'node:assert/strict'
import { getDefaultResultOrder, setDefaultResultOrder } from 'node:dns'
import { test } from 'node:test'

import { preferIpv4 } from '../../src/host/net/family.js'

test('preferIpv4 asks the resolver for IPv4 first and keeps IPv6 as the fallback', () => {
  const previous = getDefaultResultOrder()
  try {
    preferIpv4()
    assert.equal(getDefaultResultOrder(), 'ipv4first')
  } finally {
    setDefaultResultOrder(previous)
  }
})
