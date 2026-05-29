import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

const port = 19087;
const baseUrl = `http://127.0.0.1:${port}`;

let serverProcess;

async function startServer() {
  if (serverProcess) return;

  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: import.meta.dirname,
    env: {
      ...process.env,
      PORT: String(port),
      AI_API_KEY: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("server start timeout")), 5000);
    serverProcess.stdout.on("data", (chunk) => {
      if (chunk.toString().includes(`localhost:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.once("error", reject);
    serverProcess.once("exit", (code) => {
      reject(new Error(`server exited early with ${code}`));
    });
  });
}

async function post(path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  return { response, body };
}

test.after(async () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
});

test("generate-safe returns analysis and selectable safe replies", async () => {
  await startServer();

  const { response, body } = await post("/api/generate-safe", {
    industry: "外卖餐饮",
    reviewText: "等了一个多小时才送到，汤都洒了，客服没人理。"
  });

  assert.equal(response.status, 200);
  assert.equal(typeof body.analysis.issueType, "string");
  assert.equal(typeof body.analysis.anger, "number");
  assert.equal(typeof body.replies["诚恳道歉"].professional, "string");
  assert.equal(typeof body.replies["问题解释"].friendly, "string");
  assert.equal(typeof body.replies["安抚用户"].firm, "string");
  assert.doesNotMatch(body.replies["诚恳道歉"].professional, /退款|重做|补送|优惠券|代金券|折扣/);
});

test("add-compensation returns a final reply that includes selected compensation", async () => {
  await startServer();

  const { response, body } = await post("/api/add-compensation", {
    originalReply: "您好，看到您反馈配送等待太久、汤品洒漏，我们已经记录并会复盘出餐和打包流程。",
    compensationType: "专人跟进"
  });

  assert.equal(response.status, 200);
  assert.equal(typeof body.finalReply, "string");
  assert.match(body.finalReply, /专人|跟进/);
});
