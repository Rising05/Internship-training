const { activeProvider } = require('./config')

const providers = {
  mock: require('./mock/provider'),
}

const provider = providers[activeProvider] || providers.mock

module.exports = provider
