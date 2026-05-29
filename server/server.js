import http from "node:http";
import fs from "node:fs";
import path from "node:path";

loadDotEnv();

const port = Number(process.env.PORT || 8787);
const aiBaseUrl = (process.env.AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const aiApiKey = process.env.AI_API_KEY || "";
const aiModel = process.env.AI_MODEL || "deepseek-chat";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        req.destroy();
        reject(new Error("请求内容过长"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON 格式错误"));
      }
    });
    req.on("error", reject);
  });
}

function buildPrompt({ industry, tone, reviewText }) {
  return `
你是一个帮助本地生活商家处理差评的客服主管。请根据差评生成可直接复制的回复建议。

约束：
1. 不承诺删除差评，不诱导顾客刷好评。
2. 不威胁、不辱骂、不甩锅。
3. 不承认未经确认的严重责任，只表达重视、核查和改进。
4. 回复要适合发布在公开评价区，语气自然，不要像机器人。
5. 输出必须是严格 JSON，不要 Markdown，不要额外解释。

商家行业：${industry}
回复风格：${tone}
顾客差评：${reviewText}

JSON 字段：
{
  "reason": "用 8 个字以内概括差评原因",
  "priority": "低/中/高",
  "publicReply": "公开平台回复，80-140 字",
  "privateMessage": "私信安抚话术，80-140 字",
  "firmReply": "克制解释版本，60-120 字，适合存在误会或争议时使用",
  "actionSuggestion": "给商家的处理建议，包含是否建议补偿、是否联系顾客、内部如何复盘，80-160 字"
}
`.trim();
}

function fallbackReply({ industry, tone, reviewText }) {
  const late = /慢|等|超时|迟|凉|配送/.test(reviewText);
  const service = /态度|客服|服务|没人|不理/.test(reviewText);
  const taste = /难吃|口味|咸|淡|不新鲜|坏/.test(reviewText);
  const reason = late ? "配送体验" : service ? "服务体验" : taste ? "产品体验" : "消费体验";
  const priority = late || service || taste ? "高" : "中";

  return {
    reason,
    priority,
    publicReply: `非常抱歉这次给您带来了不好的${industry}体验。您反馈的问题我们已经记录，会尽快核查对应环节，并对出品、服务和交付流程做复盘优化。感谢您愿意指出问题，也希望后续有机会把体验补回来。`,
    privateMessage: `您好，看到您的反馈我们很重视，也很抱歉让您这次消费不满意。方便的话可以把订单信息发给我们，我们会尽快核实具体情况，并根据实际问题给您一个妥善处理方案。`,
    firmReply: `感谢您的反馈。我们会认真核查本次订单和服务过程，如确有不到位的地方会及时改进。也欢迎您补充更多细节，方便我们更准确地处理问题。`,
    actionSuggestion: `建议优先联系顾客核实细节。若问题属实，可根据影响程度提供补发、优惠券或部分补偿；同时记录到门店复盘表，检查${tone}场景下的服务、出品和交付环节。`
  };
}

function parseAiJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI 返回内容不是 JSON");
    return JSON.parse(match[0]);
  }
}

async function generateWithAi(payload) {
  if (!aiApiKey) {
    return fallbackReply(payload);
  }

  const response = await fetch(`${aiBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${aiApiKey}`
    },
    body: JSON.stringify({
      model: aiModel,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "你只输出严格 JSON。"
        },
        {
          role: "user",
          content: buildPrompt(payload)
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI 服务调用失败：${response.status} ${detail.slice(0, 160)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return parseAiJson(content);
}

function normalizePayload(payload) {
  const industry = String(payload.industry || "外卖餐饮").slice(0, 30);
  const tone = String(payload.tone || "诚恳道歉").slice(0, 30);
  const reviewText = String(payload.reviewText || "").trim().slice(0, 800);

  if (reviewText.length < 6) {
    throw new Error("差评内容太短");
  }

  return { industry, tone, reviewText };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    sendJson(res, 200, { ok: true, model: aiModel });
    return;
  }

  if (req.method === "POST" && req.url === "/api/generate") {
    try {
      const body = await readBody(req);
      const payload = normalizePayload(body);
      const result = await generateWithAi(payload);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "生成失败" });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`AI review reply server listening on http://localhost:${port}`);
});
