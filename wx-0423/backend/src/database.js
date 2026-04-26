const fs = require('node:fs')
const path = require('node:path')
const { buildInitialDb } = require('./seed')
const { readBackendConfig } = require('./config')
const {
  readCloudSnapshot,
  writeCloudSnapshot,
  repairCloudSnapshot,
} = require('./cloudbase-store')

const DB_FILE = path.join(__dirname, '..', 'data', 'runtime-db.json')

function ensureDbFile() {
  if (readBackendConfig().dataProvider !== 'file') {
    return
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(buildInitialDb(), null, 2))
  }
}

function readFileSnapshot() {
  ensureDbFile()
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
}

function writeFileSnapshot(data) {
  const nextData = {
    ...data,
    meta: {
      ...(data.meta || {}),
      updatedAt: new Date().toISOString(),
    },
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(nextData, null, 2))
  return nextData
}

async function readDb() {
  if (readBackendConfig().dataProvider === 'cloudbase') {
    return readCloudSnapshot()
  }

  return readFileSnapshot()
}

async function writeDb(data) {
  const nextData = {
    ...data,
    meta: {
      ...(data.meta || {}),
      updatedAt: new Date().toISOString(),
    },
  }

  if (readBackendConfig().dataProvider === 'cloudbase') {
    return writeCloudSnapshot(nextData, { replaceExisting: true })
  }

  return writeFileSnapshot(nextData)
}

async function withDb(mutator) {
  const current = await readDb()
  const next = mutator(current)
  if (next) {
    return writeDb(next)
  }
  return current
}

async function resetDb() {
  return writeDb(buildInitialDb())
}

async function seedCloudbase() {
  return repairCloudSnapshot()
}

async function migrateFileDbToCloudbase() {
  return writeCloudSnapshot(readFileSnapshot(), { replaceExisting: true })
}

module.exports = {
  DB_FILE,
  ensureDbFile,
  readFileSnapshot,
  readDb,
  writeDb,
  withDb,
  resetDb,
  seedCloudbase,
  migrateFileDbToCloudbase,
}
