Page({
  data: {
    result: null,
    replyCards: []
  },

  onShow() {
    const result = wx.getStorageSync("lastResult");
    if (!result) {
      wx.navigateBack();
      return;
    }

    this.setData({
      result,
      replyCards: [
        { key: "publicReply", title: "公开平台回复", text: result.publicReply },
        { key: "privateMessage", title: "私信安抚话术", text: result.privateMessage },
        { key: "firmReply", title: "克制解释版本", text: result.firmReply }
      ]
    });
  },

  copyText(event) {
    wx.setClipboardData({
      data: event.currentTarget.dataset.text,
      success() {
        wx.showToast({ title: "已复制" });
      }
    });
  },

  goHome() {
    wx.switchTab({ url: "/pages/index/index" });
  }
});
