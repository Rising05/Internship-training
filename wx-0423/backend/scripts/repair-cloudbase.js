const { seedCloudbase } = require('../src/database')

seedCloudbase()
  .then(() => {
    console.log('CloudBase repair completed')
  })
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
