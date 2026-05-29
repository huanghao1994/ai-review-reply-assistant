const api = require("../../utils/api");

Page({
  data: {
    industries: ["外卖餐饮", "奶茶饮品", "民宿酒店", "美甲美业", "宠物门店", "教培机构"],
    tones: ["专业克制", "亲切自然", "强硬克制"],
    industry: "外卖餐饮",
    tone: "专业克制",
    reviewText: "",
    loading: false
  },

  selectIndustry(event) {
    this.setData({ industry: event.currentTarget.dataset.value });
  },

  selectTone(event) {
    this.setData({ tone: event.currentTarget.dataset.value });
  },

  onReviewInput(event) {
    this.setData({ reviewText: event.detail.value });
  },

  async submit() {
    const reviewText = this.data.reviewText.trim();
    if (reviewText.length < 6) {
      wx.showToast({ title: "请输入完整差评", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    try {
      const result = await api.generateSafeReply({
        industry: this.data.industry,
        reviewText
      });

      const usage = wx.getStorageSync("usage") || { total: 0 };
      wx.setStorageSync("usage", { total: usage.total + 1 });
      wx.setStorageSync("lastResult", result);

      const history = wx.getStorageSync("history") || [];
      history.unshift({
        id: Date.now(),
        industry: this.data.industry,
        tone: this.data.tone,
        reviewText,
        mode: "safe",
        result,
        createdAt: new Date().toISOString()
      });
      wx.setStorageSync("history", history.slice(0, 50));

      wx.navigateTo({ url: "/pages/result/result" });
    } catch (error) {
      wx.showToast({ title: error.message || "生成失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  }
});
