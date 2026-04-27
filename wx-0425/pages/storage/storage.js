// pages/storage/storage.js
/*
 wx.setStorageSync() : 设置存储
 wx.getStorageSync() : 获得存储
 wx.removeStorageSync() : 清除某一个键的存储
 wx.clearStorageSync():清除所有
*/
Page({

  /**
   * 页面的初始数据
   */
  data: {
      userifo:{},
      token:''
  },
  setS(){
    this.setData({
      userInfo:{name:"张三",avator:"avatar.jpg"}
    })
    wx.setStorageSync('userInfo',this.data.userInfo)
    wx.setStorageSync('token',Date.now())
  },
  getS(){
    this.setData({
      userInfo : wx.getStorageSync('userInfo'),
      token: wx.getStorageSync('token')
    })
    console.log(this.data.userInfo)
    console.log(this.data.token)
  },
  removeS(){
    wx.removeStorageSync('token')
  },
  clearS(){
    wx.clearStorageSync()
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