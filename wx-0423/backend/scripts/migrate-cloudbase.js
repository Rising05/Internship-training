const { migrateFileDbToCloudbase } = require('../src/database')

migrateFileDbToCloudbase()
  .then(() => {
    console.log('CloudBase migration completed')
  })
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
