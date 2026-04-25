const PRODUCT_IMAGE_FALLBACK = '/static/image/product-fallback.svg'

function normalizeImageList(images = []) {
  if (!Array.isArray(images)) {
    return [PRODUCT_IMAGE_FALLBACK]
  }

  const safeImages = images.filter((item) => typeof item === 'string' && item.trim())
  return safeImages.length ? safeImages : [PRODUCT_IMAGE_FALLBACK]
}

function getPrimaryImage(images = []) {
  return normalizeImageList(images)[0]
}

function withCoverImage(products = []) {
  return products.map((item) => ({
    ...item,
    coverImage: getPrimaryImage(item.images),
  }))
}

module.exports = {
  PRODUCT_IMAGE_FALLBACK,
  normalizeImageList,
  getPrimaryImage,
  withCoverImage,
}
