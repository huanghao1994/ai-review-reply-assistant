Page({
  data: {
    history: []
  },

  onShow() {
    this.setData({ history: wx.getStorageSync("history") || [] });
  },

  openItem(event) {
    const item = this.data.history[event.currentTarget.dataset.index];
    wx.setStorageSync("lastResult", item.result);
    wx.navigateTo({ url: "/pages/result/result" });
  }
});
