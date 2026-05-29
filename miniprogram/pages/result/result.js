const api = require("../../utils/api");

Page({
  data: {
    result: null,
    replyCards: [],
    angles: [
      { key: "诚恳道歉", name: "诚恳道歉", desc: "承认体验落差，适合大多数差评" },
      { key: "问题解释", name: "问题解释", desc: "说明核查路径，适合存在误会或流程问题" },
      { key: "安抚用户", name: "安抚用户", desc: "优先安抚情绪，适合高怒气顾客" }
    ],
    styles: [
      { key: "professional", name: "专业" },
      { key: "friendly", name: "亲切" },
      { key: "firm", name: "强硬克制" }
    ],
    compensationActions: ["专人跟进", "赠送优惠券", "重做一份", "立即退款"],
    selectedAngle: "诚恳道歉",
    selectedStyle: "professional",
    finalReply: "",
    reportBadge: "",
    compensationProcessing: false,
    compensationUpdated: false
  },

  onShow() {
    const result = wx.getStorageSync("lastResult");
    if (!result) {
      wx.navigateBack();
      return;
    }

    if (result.replies) {
      this.setData({
        result,
        reportBadge: result.analysis ? `${result.analysis.anger}%` : ""
      }, () => this.updateFinalReply());
      return;
    }

    this.setData({
      result,
      reportBadge: result.priority || "",
      finalReply: result.publicReply || "",
      replyCards: [
        { key: "publicReply", title: "公开平台回复", text: result.publicReply },
        { key: "privateMessage", title: "私信安抚话术", text: result.privateMessage },
        { key: "firmReply", title: "克制解释版本", text: result.firmReply }
      ]
    });
  },

  updateFinalReply() {
    const result = this.data.result;
    const reply = result &&
      result.replies &&
      result.replies[this.data.selectedAngle] &&
      result.replies[this.data.selectedAngle][this.data.selectedStyle];

    this.setData({ finalReply: reply || "" });
  },

  selectAngle(event) {
    this.setData({ selectedAngle: event.currentTarget.dataset.value }, () => this.updateFinalReply());
  },

  selectStyle(event) {
    this.setData({ selectedStyle: event.currentTarget.dataset.value }, () => this.updateFinalReply());
  },

  async selectCompensation(event) {
    if (this.data.compensationProcessing || !this.data.finalReply) return;

    this.setData({
      compensationProcessing: true,
      compensationUpdated: false
    });

    try {
      const result = await api.addCompensation({
        originalReply: this.data.finalReply,
        compensationType: event.currentTarget.dataset.value
      });

      this.setData({
        finalReply: result.finalReply,
        compensationProcessing: false,
        compensationUpdated: true
      });
      wx.showToast({ title: "已加入补偿" });
    } catch (error) {
      this.setData({ compensationProcessing: false });
      wx.showToast({ title: error.message || "处理失败", icon: "none" });
    }
  },

  copyText(event) {
    wx.setClipboardData({
      data: event.currentTarget.dataset.text || this.data.finalReply,
      success() {
        wx.showToast({ title: "已复制" });
      }
    });
  },

  goHome() {
    wx.switchTab({ url: "/pages/index/index" });
  }
});
