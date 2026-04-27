const { getAuthSession } = require('../../utils/storage')
const { clearAuthState, requireLogin } = require('../../utils/auth')
const {
  activeProfile,
  baseURL,
  timeout,
  imageUploadPath,
  cloudEnv,
  useCloudUpload,
  cloudUploadPrefix,
} = require('./config')

function buildUrl(path) {
  if (!baseURL) {
    throw new Error(`services/http/config.js baseURL is empty for profile ${activeProfile}`)
  }

  const normalizedBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBaseURL}${normalizedPath}`
}

function buildHeaders(extraHeaders = {}) {
  const session = getAuthSession()
  const headers = Object.keys({
    'content-type': 'application/json',
    ...extraHeaders,
  }).reduce((result, key) => {
    const value = ({
      'content-type': 'application/json',
      ...extraHeaders,
    })[key]
    if (value !== undefined && value !== null) {
      result[key] = value
    }
    return result
  }, {})

  if (session && session.openid) {
    headers['X-Openid'] = session.openid
  }

  return headers
}

function buildRequestError(message, responseData, metadata = {}) {
  const context = [metadata.method, metadata.url].filter(Boolean).join(' ')
  const error = new Error(context ? `${context} ${message}` : message)
  error.responseData = responseData
  error.request = metadata
  error.isAuthError = !!(responseData && responseData.code === 'AUTH_REQUIRED')
  return error
}

function handleAuthRequired(responseData) {
  clearAuthState()
  requireLogin({
    targetType: 'back',
    reason: (responseData && responseData.message) || '登录状态已失效，请重新登录',
  })
}

function extractErrorMessage(error, fallback = 'Request failed') {
  if (!error) {
    return fallback
  }

  if (typeof error === 'string') {
    return error
  }

  return error.message
    || error.errMsg
    || (error.responseData && error.responseData.message)
    || fallback
}

function request(options) {
  const {
    url,
    method = 'GET',
    data,
    header = {},
    timeout: requestTimeout = timeout,
  } = options

  return new Promise((resolve, reject) => {
    const requestUrl = buildUrl(url)
    wx.request({
      url: requestUrl,
      method,
      data,
      timeout: requestTimeout,
      header: buildHeaders(header),
      success(response) {
        const { statusCode, data: responseData } = response
        if (statusCode >= 200 && statusCode < 300) {
          resolve(responseData)
          return
        }

        if (statusCode === 401 && responseData && responseData.code === 'AUTH_REQUIRED') {
          handleAuthRequired(responseData)
        }

        reject(buildRequestError(
          (responseData && responseData.message) || `Request failed with status ${statusCode}`,
          responseData,
          { method, url: requestUrl }
        ))
      },
      fail(error) {
        reject(buildRequestError(
          extractErrorMessage(error, 'Request failed'),
          error && error.responseData,
          { method, url: requestUrl }
        ))
      },
    })
  })
}

function uploadFile(filePath, options = {}) {
  const {
    url = imageUploadPath,
    name = 'file',
    formData = {},
    header = {},
  } = options

  return new Promise((resolve, reject) => {
    const requestUrl = buildUrl(url)
    wx.uploadFile({
      url: requestUrl,
      filePath,
      name,
      formData,
      timeout,
      header: buildHeaders({
        ...header,
        'content-type': undefined,
      }),
      success(response) {
        let responseData = response.data

        if (typeof responseData === 'string') {
          try {
            responseData = JSON.parse(responseData)
          } catch (error) {
            reject(new Error('Upload response is not valid JSON'))
            return
          }
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(responseData)
          return
        }

        if (response.statusCode === 401 && responseData && responseData.code === 'AUTH_REQUIRED') {
          handleAuthRequired(responseData)
        }

        reject(buildRequestError(
          (responseData && responseData.message) || `Upload failed with status ${response.statusCode}`,
          responseData,
          { method: 'UPLOAD', url: requestUrl }
        ))
      },
      fail(error) {
        reject(buildRequestError(
          extractErrorMessage(error, 'Upload failed'),
          error && error.responseData,
          { method: 'UPLOAD', url: requestUrl }
        ))
      },
    })
  })
}

function isCloudTempFilePath(filePath = '') {
  return /^https?:\/\/tmp\//.test(filePath)
}

function isRemoteFilePath(filePath = '') {
  if (isCloudTempFilePath(filePath)) {
    return false
  }

  return /^(https?:)?\/\//.test(filePath) || /^cloud:\/\//.test(filePath)
}

function extractUploadedUrl(payload = {}) {
  return payload.url || payload.fileUrl || (payload.data && payload.data.url) || ''
}

function buildCloudPath(filePath) {
  const extensionMatch = String(filePath || '').match(/\.[^.\\/]+$/)
  const extension = extensionMatch ? extensionMatch[0] : '.jpg'
  return `${cloudUploadPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
}

function uploadFileToCloud(filePath) {
  return new Promise((resolve, reject) => {
    if (!cloudEnv) {
      reject(new Error(`services/http/config.js cloudEnv is empty for profile ${activeProfile}`))
      return
    }

    if (!wx.cloud || !wx.cloud.uploadFile) {
      reject(new Error('wx.cloud is not available in the current miniapp runtime'))
      return
    }

    wx.cloud.uploadFile({
      cloudPath: buildCloudPath(filePath),
      filePath,
      success(response) {
        resolve({
          url: response.fileID,
          fileId: response.fileID,
        })
      },
      fail(error) {
        reject(buildRequestError(
          extractErrorMessage(error, 'Cloud upload failed'),
          error,
          { method: 'CLOUD_UPLOAD', url: cloudEnv }
        ))
      },
    })
  })
}

async function uploadImages(filePaths = []) {
  const result = []

  for (const filePath of filePaths) {
    if (isRemoteFilePath(filePath)) {
      result.push(filePath)
      continue
    }

    const uploaded = useCloudUpload
      ? await uploadFileToCloud(filePath)
      : await uploadFile(filePath)
    const uploadedUrl = extractUploadedUrl(uploaded)

    if (!uploadedUrl) {
      throw new Error('Upload response is missing file url')
    }

    result.push(uploadedUrl)
  }

  return result
}

module.exports = {
  request,
  uploadFile,
  uploadImages,
}
