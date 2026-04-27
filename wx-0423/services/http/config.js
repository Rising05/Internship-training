const DEFAULT_TIMEOUT = 8000
const DEFAULT_SUBMIT_TIMEOUT = 20000
const DEFAULT_AUTH_TIMEOUT = 15000
const DEFAULT_UPLOAD_PATH = '/uploads/images'
const DEFAULT_CLOUD_ENV = 'cloud1-d0gu2xnyn6f49940b'
const DEFAULT_CLOUD_UPLOAD_PREFIX = 'xingcang/products'

const HTTP_PROFILES = {
  'local-file': {
    baseURL: 'http://127.0.0.1:4000',
    cloudEnv: DEFAULT_CLOUD_ENV,
    useCloudUpload: false,
    cloudUploadPrefix: DEFAULT_CLOUD_UPLOAD_PREFIX,
  },
  'local-cloudbase': {
    baseURL: 'http://127.0.0.1:4000',
    cloudEnv: DEFAULT_CLOUD_ENV,
    useCloudUpload: true,
    cloudUploadPrefix: DEFAULT_CLOUD_UPLOAD_PREFIX,
  },
  'prod-cloudbase': {
    baseURL: 'https://replace-before-release.example.com',
    cloudEnv: DEFAULT_CLOUD_ENV,
    useCloudUpload: true,
    cloudUploadPrefix: DEFAULT_CLOUD_UPLOAD_PREFIX,
  },
}

function detectProfileFromMiniappRuntime() {
  try {
    if (typeof wx !== 'undefined' && wx.getAccountInfoSync) {
      const accountInfo = wx.getAccountInfoSync()
      const envVersion = accountInfo
        && accountInfo.miniProgram
        && accountInfo.miniProgram.envVersion

      if (envVersion === 'release') {
        return 'prod-cloudbase'
      }
    }
  } catch (error) {
    // Ignore miniapp runtime detection failures and fall back to local development defaults.
  }

  return 'local-file'
}

function resolveActiveProfile() {
  const runtimeProfile = (typeof process !== 'undefined' && process.env && process.env.MINIAPP_HTTP_PROFILE)
    || detectProfileFromMiniappRuntime()
  return HTTP_PROFILES[runtimeProfile] ? runtimeProfile : 'local-file'
}

const activeProfile = resolveActiveProfile()
const selectedProfile = HTTP_PROFILES[activeProfile]

module.exports = {
  activeProfile,
  availableProfiles: Object.keys(HTTP_PROFILES),
  timeout: DEFAULT_TIMEOUT,
  submitTimeout: DEFAULT_SUBMIT_TIMEOUT,
  authTimeout: DEFAULT_AUTH_TIMEOUT,
  imageUploadPath: DEFAULT_UPLOAD_PATH,
  ...selectedProfile,
}
