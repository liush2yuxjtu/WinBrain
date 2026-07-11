import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parse } from 'dotenv'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const appDirectory = path.resolve(scriptDirectory, '..')
const envFile = path.resolve(appDirectory, process.env.UAT_ENV_FILE || '.env.uat')
const command = process.argv[2] || 'bootstrap'

if (!existsSync(envFile)) {
  throw new Error(`UAT environment file not found: ${envFile}. Copy .env.uat.example to .env.uat first.`)
}

const fileEnvironment = parse(readFileSync(envFile))
const environment = { ...fileEnvironment, ...process.env }

function required(name) {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is required in ${envFile}`)
  return value
}

const postgresDatabase = required('UAT_POSTGRES_DB')
const postgresUser = required('UAT_POSTGRES_USER')
const postgresPassword = required('UAT_POSTGRES_PASSWORD')
const postgresPort = required('UAT_POSTGRES_PORT')
const mysqlPort = required('UAT_MYSQL_PORT')

for (const [name, value] of [['UAT_POSTGRES_PORT', postgresPort], ['UAT_MYSQL_PORT', mysqlPort]]) {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${name} must be a valid TCP port`)
  }
}

required('UAT_MYSQL_ROOT_PASSWORD')
required('UAT_MYSQL_DATABASE')
required('UAT_MYSQL_READONLY_USER')
required('UAT_MYSQL_READONLY_PASSWORD')

const databaseUrl = `postgresql://${encodeURIComponent(postgresUser)}:${encodeURIComponent(postgresPassword)}@127.0.0.1:${postgresPort}/${encodeURIComponent(postgresDatabase)}?schema=public`
const runtimeEnvironment = {
  ...environment,
  DATABASE_URL: databaseUrl,
  SKILL_STORE_DRIVER: 'database',
  UAT_MYSQL_HOST: '127.0.0.1'
}
const composeArguments = ['compose', '--env-file', envFile, '-f', 'docker-compose.uat.yml']

function spawn(executable, args, options = {}) {
  return spawnSync(executable, args, {
    cwd: appDirectory,
    env: runtimeEnvironment,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  })
}

function failureReason(result) {
  return result.status !== null ? `status ${result.status}` : `signal ${result.signal || 'unknown'}`
}

function run(executable, args, options = {}) {
  const result = spawn(executable, args, options)
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${executable} ${args.join(' ')} failed with ${failureReason(result)}`)
  }
}

function runBestEffort(executable, args, options = {}) {
  const result = spawn(executable, args, options)
  if (result.error) {
    console.error(`[uat-db] diagnostic command failed to start: ${result.error.message}`)
    return false
  }
  if (result.status !== 0) {
    console.error(`[uat-db] diagnostic command failed with ${failureReason(result)}: ${executable} ${args.join(' ')}`)
    return false
  }
  return true
}

function compose(...args) {
  run('docker', [...composeArguments, ...args])
}

function composeBestEffort(...args) {
  return runBestEffort('docker', [...composeArguments, ...args])
}

function diagnose(label) {
  console.error(`[uat-db] diagnostics after ${label}`)
  composeBestEffort('ps', '--all')
  composeBestEffort('logs', '--no-color', '--tail', '200')
}

function destroyBestEffort() {
  composeBestEffort('down', '--volumes', '--remove-orphans')
}

function up() {
  compose('up', '-d', '--wait', '--wait-timeout', '180')
  console.log(`UAT databases are healthy: PostgreSQL ${postgresDatabase} on 127.0.0.1:${postgresPort}; MySQL on 127.0.0.1:${mysqlPort}.`)
}

function migrate() {
  run('npm', ['run', 'db:migrate:deploy'])
}

function seed() {
  run(process.execPath, ['scripts/seed-uat.mjs'])
}

function verify() {
  run(process.execPath, ['scripts/verify-uat-database.mjs'])
}

function bootstrapAttempt(attempt, totalAttempts) {
  console.log(`[uat-db] bootstrap attempt ${attempt}/${totalAttempts}: start services`)
  up()
  console.log(`[uat-db] bootstrap attempt ${attempt}/${totalAttempts}: apply migrations`)
  migrate()
  console.log(`[uat-db] bootstrap attempt ${attempt}/${totalAttempts}: seed fixtures`)
  seed()
  console.log(`[uat-db] bootstrap attempt ${attempt}/${totalAttempts}: verify fixtures and grants`)
  verify()
}

function bootstrap() {
  const totalAttempts = 2
  let lastError

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      bootstrapAttempt(attempt, totalAttempts)
      return
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[uat-db] bootstrap attempt ${attempt}/${totalAttempts} failed: ${message}`)
      diagnose(`bootstrap attempt ${attempt}`)

      if (attempt < totalAttempts) {
        console.warn('[uat-db] removing disposable containers and volumes before one clean retry')
        destroyBestEffort()
      }
    }
  }

  throw lastError
}

switch (command) {
  case 'up':
    up()
    break
  case 'migrate':
    migrate()
    break
  case 'seed':
    seed()
    break
  case 'verify':
    verify()
    break
  case 'status':
    compose('ps')
    verify()
    break
  case 'down':
    compose('down', '--remove-orphans')
    break
  case 'destroy':
    compose('down', '--volumes', '--remove-orphans')
    break
  case 'reset':
    compose('down', '--volumes', '--remove-orphans')
    bootstrap()
    break
  case 'bootstrap':
    bootstrap()
    break
  default:
    throw new Error(`Unknown UAT database command: ${command}`)
}
