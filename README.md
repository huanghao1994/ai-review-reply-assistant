# AI 店铺差评回复助手

这是一个微信小程序 MVP，面向外卖餐饮、本地生活商家，用 AI 生成差评公开回复、私信安抚话术和内部整改建议。

## 目录

- `miniprogram/`：微信小程序前端
- `server/`：Node.js 后端 API
- `docs/launch-checklist.md`：上线检查清单

## 本地运行后端

```bash
cd server
cp .env.example .env
npm start
```

默认地址是 `http://localhost:8787`。

如果没有设置 `AI_API_KEY`，后端会返回内置模板结果，方便先测试小程序流程。

## AI 模型配置

后端支持 OpenAI-compatible API：

```bash
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=sk-your-key
AI_MODEL=deepseek-chat
```

也可以替换成其他兼容 `/v1/chat/completions` 的模型服务。

## 小程序开发预览

1. 打开微信开发者工具。
2. 导入 `miniprogram/` 目录。
3. 如果还没有正式 AppID，可以先使用测试号或游客模式预览。
4. 进入小程序「设置」页，把后端接口地址改成你的测试地址。

微信小程序真机请求正式后端时，需要使用 HTTPS，并在微信公众平台配置 request 合法域名。

## 临时部署

临时 HTTPS 后端推荐先用 Render，配置文件在 `render.yaml`，具体步骤见：

- `docs/render-deploy.md`

## 当前 MVP 功能

- 输入差评内容
- 选择店铺行业
- 选择回复风格
- 生成公开回复、私信安抚、克制解释版本
- 识别差评原因和优先级
- 给商家处理建议
- 本机历史记录
- 后端接口地址配置

## 后续付费功能建议

- 免费次数限制改为服务端控制
- 微信登录和用户表
- 次数包和会员
- 品牌话术库
- 多店铺管理
- 批量差评导入
- 员工账号和团队版
