const { activeProvider } = require('./config')

const providerLoaders = {
  mock: () => require('./mock/provider'),
  http: () => require('./http/provider'),
}

const loadProvider = providerLoaders[activeProvider] || providerLoaders.mock

module.exports = loadProvider()
