// pages/request/request.js
// 模块的导入
const request = require('../../utils/request')
Page({
  data: {
     goodsList:[],
     swipers:[],
     indicatorDots:true, // 	indicator-dots是否显示面板指示点
     autoplay:true, // 是否自动切换
     interval:2000,  // 自动切换时间间隔
     duration:500 // 滑动动画时长   circular 是否采用衔接滑动
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.getGoodsList() // 调用商品
    this.getSwiper()
  },
  // 轮播图接口https://api-hmugo-web.itheima.net/api/public/v1/home/swiperdata
  async getSwiper(){
     const res = await request('/home/swiperdata');
     console.log(res)
     this.setData({
      swipers: res.message
     })
  },
  async getGoodsList(){
    // 商品列表接口
    // wx.request({
    //   url: 'https://api-hmugo-web.itheima.net/api/public/v1/goods/search',
    //   data: {
    //     pagenum: 1,
    //     pagesize: 10
    //   },
    //   method:'GET',
    //   header: {'content-type': 'application/json'},
    //   success :(res)=> {
    //     console.log(res.data)
    //     let list = res.data.message.goods
    //     list = list.filter(item=>{
    //       return item.goods_small_logo.length > 0
    //     })
    //     this.setData({
    //       goodsList: list
    //     })
    //   }
    // })
    const res = await request('/goods/search',{pagenum:1,pagesize:10})
    console.log(res)
    let list = res.message.goods
    list = list.filter(item=>{
        return item.goods_small_logo.length > 0
    })
    this.setData({
     goodsList: list
    })

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