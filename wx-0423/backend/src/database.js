const fs = require('node:fs')
const path = require('node:path')
const { buildInitialDb } = require('./seed')

const DB_FILE = path.join(__dirname, '..', 'data', 'runtime-db.json')

function ensureDbFile() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(buildInitialDb(), null, 2))
  }
}

function readDb() {
  ensureDbFile()
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
}

function writeDb(data) {
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

function withDb(mutator) {
  const current = readDb()
  const next = mutator(current)
  if (next) {
    return writeDb(next)
  }
  return current
}

function resetDb() {
  return writeDb(buildInitialDb())
}

module.exports = {
  DB_FILE,
  ensureDbFile,
  readDb,
  writeDb,
  withDb,
  resetDb,
}
