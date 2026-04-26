const { getAuthSession } = require('../../utils/storage')
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

function buildRequestError(message, responseData) {
  const error = new Error(message)
  error.responseData = responseData
  return error
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
    wx.request({
      url: buildUrl(url),
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

        reject(buildRequestError(
          (responseData && responseData.message) || `Request failed with status ${statusCode}`,
          responseData
        ))
      },
      fail(error) {
        reject(buildRequestError(
          extractErrorMessage(error, 'Request failed'),
          error && error.responseData
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
    wx.uploadFile({
      url: buildUrl(url),
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

        reject(buildRequestError(
          (responseData && responseData.message) || `Upload failed with status ${response.statusCode}`,
          responseData
        ))
      },
      fail(error) {
        reject(buildRequestError(
          extractErrorMessage(error, 'Upload failed'),
          error && error.responseData
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
          error
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
