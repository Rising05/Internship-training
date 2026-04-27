const baseURL = "https://api-hmugo-web.itheima.net/api/public/v1"
const request = (url,data={},method="GET")=>{
  return new Promise((resolve,reject)=>{
    wx.request({
      url: baseURL + url, 
      method,
      data,
      header: {
        'content-type': 'application/json' // 默认值
      },
      success:res=> resolve(res.data),
      fail:err=> reject(err)
    })
  })
}
module.exports = request