function buildIdolDisplayName(idolType, idolGroup, idolMember, idolValue, explicitDisplay) {
  if (explicitDisplay) {
    return explicitDisplay
  }

  if (idolType === 'solo') {
    return idolValue || idolGroup || idolMember || ''
  }

  if (idolMember) {
    return idolGroup ? `${idolGroup} · ${idolMember}` : idolMember
  }

  return idolGroup || idolValue || ''
}

function normalizeIdolPayload(source = {}) {
  const rawType = source.idolType === 'solo' ? 'solo' : 'group'

  if (rawType === 'solo') {
    const idolDisplayName = buildIdolDisplayName(
      'solo',
      '',
      '',
      source.idol || source.idolDisplayName || source.idolGroup || '',
      source.idolDisplayName
    )

    return {
      ...source,
      idolType: 'solo',
      idolGroup: '',
      idolMember: '',
      idolDisplayName,
      idol: idolDisplayName,
    }
  }

  const idolGroup = source.idolGroup || source.idol || ''
  const idolMember = source.idolMember || ''
  const idolDisplayName = buildIdolDisplayName(
    'group',
    idolGroup,
    idolMember,
    source.idol,
    source.idolDisplayName
  )

  return {
    ...source,
    idolType: 'group',
    idolGroup,
    idolMember,
    idolDisplayName,
    idol: idolDisplayName,
  }
}

function getMemberOptions(memberDirectory = {}, idolGroup = '') {
  if (!idolGroup || !memberDirectory[idolGroup]) {
    return []
  }

  return memberDirectory[idolGroup]
}

function inferRegionTab(idolDirectory = {}, typeTab = 'group', value = '') {
  const normalized = (value || '').trim().toLowerCase()
  if (!normalized || !idolDirectory[typeTab]) {
    return 'kpop'
  }

  const regions = Object.keys(idolDirectory[typeTab])
  for (const region of regions) {
    const list = idolDirectory[typeTab][region] || []
    if (list.some((item) => item.toLowerCase() === normalized)) {
      return region
    }
  }

  return 'kpop'
}

module.exports = {
  normalizeIdolPayload,
  getMemberOptions,
  inferRegionTab,
}
