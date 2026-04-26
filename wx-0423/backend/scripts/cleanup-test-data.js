const { readDb, writeDb } = require('../src/database')
const { cleanupTestDataSnapshot } = require('../src/test-data')

async function cleanup() {
  const current = await readDb()
  const result = cleanupTestDataSnapshot(current)
  await writeDb(result.snapshot)
  console.log(JSON.stringify({
    deletedProducts: result.deletedProducts,
    deletedMessages: result.deletedMessages,
  }, null, 2))
}

cleanup()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
