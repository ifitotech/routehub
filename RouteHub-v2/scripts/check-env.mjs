import fs from 'node:fs'
const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY']
const envFile=fs.existsSync('.env.local')?fs.readFileSync('.env.local','utf8'):''
for(const line of envFile.split(/\r?\n/)){const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].replace(/^['"]|['"]$/g,'')}
const missing=required.filter(key=>!process.env[key]);if(missing.length){console.error(`Missing environment variables: ${missing.join(', ')}`);process.exit(1)}console.log('Supabase environment is configured.')
