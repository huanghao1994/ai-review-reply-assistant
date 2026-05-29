# Render 临时部署流程

Render 会给后端分配一个 HTTPS 域名，形如：

```text
https://ai-review-reply-server.onrender.com
```

这个地址可以临时作为微信小程序的 `request 合法域名` 使用。

## 1. 准备 GitHub 仓库

把当前项目上传到 GitHub。Render 需要从 GitHub 仓库拉取代码。

## 2. 创建 Render Web Service

1. 打开 `https://render.com/`
2. 登录或注册账号
3. 点击 `New +`
4. 选择 `Web Service`
5. 连接 GitHub 仓库
6. Root Directory 填：

```text
server
```

7. Runtime 选择：

```text
Node
```

8. Build Command 留空，或填：

```bash
npm install
```

9. Start Command 填：

```bash
npm start
```

## 3. 配置环境变量

在 Render 的 Environment 里添加：

```bash
PORT=8787
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=你的 DeepSeek Key
AI_MODEL=deepseek-chat
```

如果暂时没有 `AI_API_KEY`，后端会返回内置模板结果，但正式体验建议填真实模型 Key。

## 4. 部署后验证

部署完成后访问：

```text
https://你的-render域名/api/health
```

正常返回：

```json
{"ok":true,"model":"deepseek-chat"}
```

再测试生成接口：

```bash
curl -fsSL https://你的-render域名/api/generate \
  --json '{"industry":"外卖餐饮","tone":"诚恳道歉","reviewText":"等了一个多小时才送到，菜都凉了，客服也没人回复。"}'
```

## 5. 切换小程序接口

部署成功后，把 `miniprogram/app.js` 里的：

```js
apiBaseUrl: "http://localhost:8787"
```

改成：

```js
apiBaseUrl: "https://你的-render域名"
```

如果只是开发者工具预览，`urlCheck` 可以继续保持 `false`。

如果要提交微信审核，需要在微信公众平台把这个 Render 域名加入 `request 合法域名`。如果微信后台不接受未备案域名，就需要改用已备案域名或腾讯云方案。
