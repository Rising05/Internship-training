const fs = require('node:fs')
const path = require('node:path')

const PROJECT_CONFIG_PATH = path.join(__dirname, '..', '..', 'project.config.json')
const BACKEND_ENV_PATH = path.join(__dirname, '..', '.env')

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

function readBackendConfig() {
  const fileEnv = readBackendEnvFile()

  return {
    wechat: {
      appId: process.env.WECHAT_APP_ID || fileEnv.WECHAT_APP_ID || readProjectAppId(),
      appSecret: process.env.WECHAT_APP_SECRET || fileEnv.WECHAT_APP_SECRET || '',
      loginMode: normalizeMode(process.env.WECHAT_LOGIN_MODE || fileEnv.WECHAT_LOGIN_MODE, 'auto'),
    },
  }
}

module.exports = {
  readBackendConfig,
}
