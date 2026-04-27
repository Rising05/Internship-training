// pages/srcoll/srcoll.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    top:0
  },
  scroll(e){
     console.log(e.detail.scrollTop)
     this.setData({
      top: e.detail.scrollTop
     })
  },
  backTop(){
    this.setData({
      top: 0
    })
    // 提示框接口 api
    wx.showToast({
      icon:"none",
      title:"返回到头了"
    })
  },
  upper(){
    console.log('触发到顶事件')
  },
  lower(){
    console.log('触发触底事件')
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