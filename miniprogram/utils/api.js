function getApiBaseUrl() {
  const app = getApp();
  return (app.globalData.apiBaseUrl || "").replace(/\/$/, "");
}

function request(path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${getApiBaseUrl()}${path}`,
      method: "POST",
      data,
      timeout: 45000,
      header: {
        "content-type": "application/json"
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(new Error((res.data && res.data.error) || "服务暂时不可用"));
      },
      fail(error) {
        reject(new Error(error.errMsg || "网络请求失败"));
      }
    });
  });
}

module.exports = {
  generateReply(payload) {
    return request("/api/generate", payload);
  },

  generateSafeReply(payload) {
    return request("/api/generate-safe", payload);
  },

  addCompensation(payload) {
    return request("/api/add-compensation", payload);
  }
};
