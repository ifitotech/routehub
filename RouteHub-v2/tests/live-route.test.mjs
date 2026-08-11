import test from 'node:test'
import assert from 'node:assert/strict'
import {formatLocationAge} from '../lib/live-route.ts'

test('live location age is human-readable and does not invent movement',()=>{
  const now=Date.parse('2026-08-11T12:00:00.000Z')
  assert.equal(formatLocationAge('2026-08-11T11:59:45.000Z',now),'Updated just now')
  assert.equal(formatLocationAge('2026-08-11T11:58:00.000Z',now),'Updated 2 min ago')
  assert.equal(formatLocationAge(null,now),'Location unavailable')
})

test('ended or invalid timestamps are never presented as fresh',()=>{
  const now=Date.parse('2026-08-11T12:00:00.000Z')
  assert.equal(formatLocationAge('not-a-date',now),'Location unavailable')
  assert.equal(formatLocationAge('2026-08-11T10:00:00.000Z',now),'Updated 2 hr ago')
})
