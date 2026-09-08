// Isolated, local-only UI fixture. Never part of the RouteHub app router.
import env from '@next/env'
import {fileURLToPath} from 'node:url'
env.loadEnvConfig(fileURLToPath(new URL('../../..',import.meta.url)))
export default {experimental:{externalDir:true}}
