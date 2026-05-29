Page({
  data: {
    apiBaseUrl: "",
    usage: { total: 0 }
  },

  onShow() {
    const app = getApp();
    this.setData({
      apiBaseUrl: app.globalData.apiBaseUrl,
      usage: wx.getStorageSync("usage") || { total: 0 }
    });
  },

  onApiInput(event) {
    this.setData({ apiBaseUrl: event.detail.value });
  },

  save() {
    const apiBaseUrl = this.data.apiBaseUrl.trim().replace(/\/$/, "");
    if (!apiBaseUrl.startsWith("https://") && !apiBaseUrl.startsWith("http://localhost")) {
      wx.showToast({ title: "请填写 HTTPS 地址", icon: "none" });
      return;
    }

    getApp().globalData.apiBaseUrl = apiBaseUrl;
    wx.setStorageSync("settings", { apiBaseUrl });
    wx.showToast({ title: "已保存" });
  },

  clearHistory() {
    wx.removeStorageSync("history");
    wx.showToast({ title: "已清空" });
  }
});
