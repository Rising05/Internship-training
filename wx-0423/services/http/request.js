const { getAuthSession } = require('../../utils/storage')
const { baseURL, timeout, imageUploadPath } = require('./config')

function buildUrl(path) {
  if (!baseURL) {
    throw new Error('services/http/config.js baseURL is empty')
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

function request(options) {
  const {
    url,
    method = 'GET',
    data,
    header = {},
  } = options

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(url),
      method,
      data,
      timeout,
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
        reject(error)
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
        reject(error)
      },
    })
  })
}

function isRemoteFilePath(filePath = '') {
  return /^(https?:)?\/\//.test(filePath)
}

function extractUploadedUrl(payload = {}) {
  return payload.url || payload.fileUrl || (payload.data && payload.data.url) || ''
}

async function uploadImages(filePaths = []) {
  const result = []

  for (const filePath of filePaths) {
    if (isRemoteFilePath(filePath)) {
      result.push(filePath)
      continue
    }

    const uploaded = await uploadFile(filePath)
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
