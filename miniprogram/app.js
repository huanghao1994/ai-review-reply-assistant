App({
  globalData: {
    apiBaseUrl: "http://localhost:8787",
    trialLimit: 5
  },

  onLaunch() {
    const settings = wx.getStorageSync("settings");
    if (settings && settings.apiBaseUrl) {
      this.globalData.apiBaseUrl = settings.apiBaseUrl;
    }

    const usage = wx.getStorageSync("usage");
    if (!usage) {
      wx.setStorageSync("usage", { total: 0 });
    }
  }
});
