// pages/picker/picker.js
Page({
  data: {
     array:['美国', '中国', '巴西', '日本'],
     index:0,
     time:'12:00',
     date:'2026-04-25',
     region: ['广东省', '广州市', '海珠区']
  },
  bindPikerChange(e){
     this.setData({
      index:e.detail.value
     })
  },
  bindTimeChange(e){
    this.setData({
     time:e.detail.value
    })
 },
 bindDateChange(e){
  this.setData({
   date:e.detail.value
  })
},
bindRegionChange(e){
  console.log(e.detail.value)
  this.setData({
    region:e.detail.value
   })
},
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})