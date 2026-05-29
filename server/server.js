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

function buildSafePrompt({ industry, reviewText }) {
  return `
你是一个帮助本地生活商家处理差评的客服主管。请先生成不包含任何具体补偿承诺的安全回复。

约束：
1. 严禁出现：退款、重做、补送、优惠券、代金券、折扣、赔偿。
2. 不承诺删除差评，不诱导刷好评。
3. 不威胁、不辱骂、不甩锅。
4. 只表达重视、核查、安抚、解释、内部改进。
5. 输出必须是严格 JSON，不要 Markdown，不要额外解释。

商家行业：${industry}
顾客差评：${reviewText}

JSON 字段：
{
  "analysis": {
    "issueType": "问题类型，例如 配送问题/产品体验/服务态度/价格争议",
    "anger": 0到100之间的整数,
    "keywords": "核心矛盾关键词，逗号分隔"
  },
  "replies": {
    "诚恳道歉": {
      "professional": "专业克制回复，80-140字",
      "friendly": "亲切自然回复，80-140字",
      "firm": "强硬克制回复，80-140字"
    },
    "问题解释": {
      "professional": "专业克制回复，80-140字",
      "friendly": "亲切自然回复，80-140字",
      "firm": "强硬克制回复，80-140字"
    },
    "安抚用户": {
      "professional": "专业克制回复，80-140字",
      "friendly": "亲切自然回复，80-140字",
      "firm": "强硬克制回复，80-140字"
    }
  },
  "actionSuggestion": "内部复盘建议，80-160字"
}
`.trim();
}

function buildCompensationPrompt({ originalReply, compensationType }) {
  return `
你是一个专业的商家客服文本编辑。请把补偿措施自然融入原始回复，保持原始语气，不要机械追加。

约束：
1. 只输出最终回复文本，不要解释。
2. 不诱导刷好评，不承诺删除差评。
3. 语气克制，避免过度承诺。

原始回复：
${originalReply}

补偿措施：
${compensationType}
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

function detectIssue(reviewText) {
  const late = /慢|等|超时|迟|凉|配送|撒|洒|漏/.test(reviewText);
  const service = /态度|客服|服务|没人|不理|敷衍/.test(reviewText);
  const taste = /难吃|口味|咸|淡|不新鲜|坏|变质|少/.test(reviewText);
  const price = /贵|价格|不值|份量|分量/.test(reviewText);

  if (late) return { issueType: "配送问题", keywords: "配送超时,包装洒漏,餐品状态", anger: 82 };
  if (service) return { issueType: "服务态度", keywords: "客服响应,服务体验,沟通不满", anger: 76 };
  if (taste) return { issueType: "产品体验", keywords: "口味不满,品质感知,出品稳定", anger: 72 };
  if (price) return { issueType: "价格争议", keywords: "价格感知,份量预期,性价比", anger: 64 };
  return { issueType: "消费体验", keywords: "体验落差,顾客不满,门店复盘", anger: 68 };
}

function sanitizeReply(text) {
  return text.replace(/退款|重做|补送|优惠券|代金券|折扣|赔偿/g, "进一步处理");
}

function fallbackSafeReplies({ industry, reviewText }) {
  const analysis = detectIssue(reviewText);
  const base = {
    "诚恳道歉": {
      professional: `您好，看到您反馈的${analysis.issueType}，我们已经认真记录。这次体验没有达到您的预期，我们会尽快核查对应订单和门店流程，并把问题同步给相关同事复盘改进。感谢您指出具体问题。`,
      friendly: `您好，看到您的反馈我们挺重视的。这次${industry}体验让您不满意，确实需要我们好好复盘。我们会核查订单细节和门店处理流程，把该改的地方尽快改到位。`,
      firm: `感谢反馈。您提到的问题我们会按订单记录和门店流程逐项核查，如存在不到位的环节，会立即做内部复盘和流程修正，避免类似体验再次发生。`
    },
    "问题解释": {
      professional: `您好，您反馈的情况我们已经记录。我们会核查出餐、打包、交付和客服响应链路，确认问题发生在哪个环节，并据此优化后续处理标准。感谢您提供具体信息。`,
      friendly: `您好，这次体验确实不理想。我们会先把订单和门店流程核清楚，看看问题是出在出品、打包、交付还是沟通环节，再针对性调整，感谢您愿意提醒我们。`,
      firm: `已收到反馈。我们不会回避问题，也会基于事实核查订单过程。若流程中有疏漏，会明确责任环节并改进；若存在信息误差，也会保持透明沟通。`
    },
    "安抚用户": {
      professional: `您好，理解您这次的不满。遇到这种体验，任何顾客都会失望。我们已将反馈纳入优先处理，会尽快核实并推动门店改进，也欢迎您补充更多订单细节。`,
      friendly: `您好，换成我们遇到这样的体验也会不舒服。您的反馈我们已经收到了，会认真看订单和处理过程，把问题说清楚、改到位。谢谢您愿意把感受告诉我们。`,
      firm: `感谢您直接指出问题。我们重视每一次负面反馈，会尽快核实并复盘处理，不用空话搪塞，也不会回避该改进的地方。`
    }
  };

  for (const angle of Object.keys(base)) {
    for (const style of Object.keys(base[angle])) {
      base[angle][style] = sanitizeReply(base[angle][style]);
    }
  }

  return {
    analysis,
    replies: base,
    actionSuggestion: `建议先核查订单详情和门店流程，重点看${analysis.keywords}。公开回复保持克制，不主动承诺具体补偿；如需补偿，应由店长确认后再追加到回复中。`
  };
}

function fallbackCompensation({ originalReply, compensationType }) {
  const map = {
    "重做一份": "我们会在核实后尽快为您重新安排一份，确保这次问题得到实际处理。",
    "立即退款": "我们会在核实后尽快为您办理退款，让这次不好的体验有一个明确处理结果。",
    "赠送优惠券": "我们会在核实后为您补发一张优惠券，也会同步复盘这次服务流程。",
    "专人跟进": "我们会安排专人继续跟进这次反馈，把订单细节核清楚后给您明确回应。"
  };
  const addition = map[compensationType] || `我们会在核实后安排${compensationType}，并继续跟进这次反馈。`;
  return {
    finalReply: `${originalReply.replace(/[。！!]\s*$/, "。")}${addition}`
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

function validateSafeResult(result, payload) {
  const fallback = fallbackSafeReplies(payload);
  const analysis = result.analysis || fallback.analysis;
  const replies = result.replies || fallback.replies;

  for (const angle of ["诚恳道歉", "问题解释", "安抚用户"]) {
    if (!replies[angle]) replies[angle] = fallback.replies[angle];
    for (const style of ["professional", "friendly", "firm"]) {
      if (!replies[angle][style]) replies[angle][style] = fallback.replies[angle][style];
      replies[angle][style] = sanitizeReply(String(replies[angle][style]));
    }
  }

  return {
    analysis: {
      issueType: String(analysis.issueType || fallback.analysis.issueType),
      anger: Number(analysis.anger || fallback.analysis.anger),
      keywords: String(analysis.keywords || fallback.analysis.keywords)
    },
    replies,
    actionSuggestion: String(result.actionSuggestion || fallback.actionSuggestion)
  };
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

async function generateSafeWithAi(payload) {
  if (!aiApiKey) {
    return fallbackSafeReplies(payload);
  }

  const response = await fetch(`${aiBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${aiApiKey}`
    },
    body: JSON.stringify({
      model: aiModel,
      temperature: 0.55,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你只输出严格 JSON。" },
        { role: "user", content: buildSafePrompt(payload) }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI 服务调用失败：${response.status} ${detail.slice(0, 160)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return validateSafeResult(parseAiJson(content), payload);
}

async function addCompensationWithAi(payload) {
  if (!aiApiKey) {
    return fallbackCompensation(payload);
  }

  const response = await fetch(`${aiBaseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${aiApiKey}`
    },
    body: JSON.stringify({
      model: aiModel,
      temperature: 0.45,
      messages: [
        { role: "system", content: "你只输出最终回复文本。" },
        { role: "user", content: buildCompensationPrompt(payload) }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI 服务调用失败：${response.status} ${detail.slice(0, 160)}`);
  }

  const data = await response.json();
  return {
    finalReply: String(data.choices?.[0]?.message?.content || "").trim()
  };
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

function normalizeSafePayload(payload) {
  const industry = String(payload.industry || "外卖餐饮").slice(0, 30);
  const reviewText = String(payload.reviewText || "").trim().slice(0, 800);

  if (reviewText.length < 6) {
    throw new Error("差评内容太短");
  }

  return { industry, reviewText };
}

function normalizeCompensationPayload(payload) {
  const originalReply = String(payload.originalReply || "").trim().slice(0, 1000);
  const compensationType = String(payload.compensationType || "").trim().slice(0, 30);

  if (originalReply.length < 10) {
    throw new Error("原始回复太短");
  }
  if (!compensationType) {
    throw new Error("请选择补偿方式");
  }

  return { originalReply, compensationType };
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

  if (req.method === "POST" && req.url === "/api/generate-safe") {
    try {
      const body = await readBody(req);
      const payload = normalizeSafePayload(body);
      const result = await generateSafeWithAi(payload);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "生成失败" });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/add-compensation") {
    try {
      const body = await readBody(req);
      const payload = normalizeCompensationPayload(body);
      const result = await addCompensationWithAi(payload);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "补偿处理失败" });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`AI review reply server listening on http://localhost:${port}`);
});
