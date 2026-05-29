# 上线检查清单

## 你需要准备的资料

1. 微信小程序账号和 AppID。
2. 小程序名称、头像、简介、服务类目。
3. 已备案域名，用于后端 HTTPS API。
4. AI 模型 API Key，例如 DeepSeek、通义、豆包或 OpenAI-compatible 服务。
5. 如果要收费，需要微信支付商户号和小程序支付权限。
6. 隐私政策和用户协议。

## 部署后端

可选平台：

- 腾讯云轻量服务器
- 腾讯云 CloudBase
- 阿里云 ECS
- Vercel/Render/Railway 等 Node 托管平台

最低要求：

- Node.js 18+
- HTTPS 域名
- 配置环境变量：`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`

部署后检查：

```bash
curl https://your-domain.com/api/health
```

返回类似：

```json
{"ok":true,"model":"deepseek-chat"}
```

## 配置微信小程序

1. 微信公众平台进入小程序后台。
2. 在「开发管理」查看 AppID。
3. 在「开发管理 / 开发设置 / 服务器域名」添加 request 合法域名。
4. 把 `miniprogram/project.config.json` 里的 `appid` 改成正式 AppID。
5. 把 `miniprogram/app.js` 里的 `apiBaseUrl` 改成正式 HTTPS 后端域名。
6. 使用微信开发者工具导入 `miniprogram/`。
7. 预览并真机测试。
8. 上传代码。
9. 在微信公众平台提交审核。
10. 审核通过后发布。

## 审核注意事项

- 页面和说明不要写“删除差评”“保证改好评”“刷好评”。
- 明确产品是“回复建议工具”，不是代替平台客服或法律意见。
- 对用户输入的评论内容做隐私提示。
- 不生成辱骂、威胁、骚扰、诱导交易外沟通的内容。
- 如果接入支付，必须展示清晰的套餐权益和退款/售后说明。

## 第一版建议类目

优先尝试：

- 工具
- 商家经营工具
- 企业服务

具体可用类目以微信公众平台后台可选类目为准。
