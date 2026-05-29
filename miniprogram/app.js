App({
  globalData: {
    apiBaseUrl: "https://ai-review-reply-assistant.onrender.com",
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
