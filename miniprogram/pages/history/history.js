Page({
  data: {
    history: []
  },

  onShow() {
    const history = (wx.getStorageSync("history") || []).map((item) => {
      const result = item.result || {};
      return {
        ...item,
        issueLabel: result.analysis ? result.analysis.issueType : result.reason || "已处理",
        previewText: result.replies
          ? result.replies["诚恳道歉"].professional
          : result.publicReply || ""
      };
    });
    this.setData({ history });
  },

  openItem(event) {
    const item = this.data.history[event.currentTarget.dataset.index];
    wx.setStorageSync("lastResult", item.result);
    wx.navigateTo({ url: "/pages/result/result" });
  }
});
