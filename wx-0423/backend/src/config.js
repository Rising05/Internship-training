const fs = require('node:fs')
const path = require('node:path')

const PROJECT_CONFIG_PATH = path.join(__dirname, '..', '..', 'project.config.json')
const BACKEND_ENV_PATH = path.join(__dirname, '..', '.env')
const HTTP_CONFIG_PATH = path.join(__dirname, '..', '..', 'services', 'http', 'config.js')
const DEFAULT_CLOUDBASE_ENV_ID = 'cloud1-d0gu2xnyn6f49940b'
const ENV_PROFILES = {
  'local-file': {
    dataProvider: 'file',
    cloudbase: {
      envId: DEFAULT_CLOUDBASE_ENV_ID,
    },
  },
  'local-cloudbase': {
    dataProvider: 'cloudbase',
    cloudbase: {
      envId: DEFAULT_CLOUDBASE_ENV_ID,
    },
  },
  'prod-cloudbase': {
    dataProvider: 'cloudbase',
    cloudbase: {
      envId: DEFAULT_CLOUDBASE_ENV_ID,
    },
  },
}

function readBackendEnvFile() {
  try {
    const content = fs.readFileSync(BACKEND_ENV_PATH, 'utf8')
    return content.split(/\r?\n/).reduce((accumulator, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        return accumulator
      }

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) {
        return accumulator
      }

      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim()
      if (!key || process.env[key]) {
        return accumulator
      }

      accumulator[key] = value
      return accumulator
    }, {})
  } catch (error) {
    return {}
  }
}

function readProjectAppId() {
  try {
    const content = fs.readFileSync(PROJECT_CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(content)
    return typeof parsed.appid === 'string' ? parsed.appid.trim() : ''
  } catch (error) {
    return ''
  }
}

function normalizeMode(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized || fallback
}

function pickEnvProfile(value) {
  const normalized = normalizeMode(value, '')
  return ENV_PROFILES[normalized] ? normalized : ''
}

function readHttpCloudEnv() {
  try {
    delete require.cache[require.resolve(HTTP_CONFIG_PATH)]
    const config = require(HTTP_CONFIG_PATH)
    return typeof config.cloudEnv === 'string' ? config.cloudEnv.trim() : ''
  } catch (error) {
    return ''
  }
}

function readBackendConfig() {
  const fileEnv = readBackendEnvFile()
  const envProfile = pickEnvProfile(process.env.BACKEND_ENV_PROFILE || fileEnv.BACKEND_ENV_PROFILE)
  const preset = ENV_PROFILES[envProfile] || {}
  const dataProvider = normalizeMode(process.env.DATA_PROVIDER || fileEnv.DATA_PROVIDER || preset.dataProvider, 'file')

  return {
    envProfile: envProfile || (dataProvider === 'cloudbase' ? 'local-cloudbase' : 'local-file'),
    dataProvider,
    wechat: {
      appId: process.env.WECHAT_APP_ID || fileEnv.WECHAT_APP_ID || readProjectAppId(),
      appSecret: process.env.WECHAT_APP_SECRET || fileEnv.WECHAT_APP_SECRET || '',
      loginMode: normalizeMode(process.env.WECHAT_LOGIN_MODE || fileEnv.WECHAT_LOGIN_MODE, 'auto'),
    },
    cloudbase: {
      envId: process.env.CLOUDBASE_ENV_ID
        || fileEnv.CLOUDBASE_ENV_ID
        || (preset.cloudbase && preset.cloudbase.envId)
        || readHttpCloudEnv(),
      secretId: process.env.CLOUDBASE_SECRET_ID || fileEnv.CLOUDBASE_SECRET_ID || process.env.TENCENTCLOUD_SECRETID || '',
      secretKey: process.env.CLOUDBASE_SECRET_KEY || fileEnv.CLOUDBASE_SECRET_KEY || process.env.TENCENTCLOUD_SECRETKEY || '',
    },
  }
}

module.exports = {
  ENV_PROFILES,
  readBackendConfig,
}
