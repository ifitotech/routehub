import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const source=readFileSync(new URL('../lib/data.ts',import.meta.url),'utf8')

test('optional recipient proof falls back to the core completion payload',()=>{
  assert.match(source,/if\(result\.error&&options\?\.driverNote!==undefined\)\{/)
  assert.match(source,/result=await update\(completionBase\)/)
})

test('a lost completion response is reconciled from the authoritative route status',()=>{
  assert.match(source,/const readCurrentState=/)
  assert.match(source,/currentState\.data\?\.status==='completed'/)
  assert.match(source,/action:'completion_reconciled'/)
  assert.match(source,/return currentState\.data/)
})
