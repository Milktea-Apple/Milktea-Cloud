import { createHash, randomBytes } from "node:crypto";

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:3210";
const PASSWORD = "smoke-pass-123";
let checks = 0;

function check(condition, label, detail = "") {
  checks += 1;
  if (!condition) {
    console.error(`\n✗ ${label}${detail ? `\n  ${detail}` : ""}`);
    process.exit(1);
  }
  console.log(`✓ ${label}`);
}

class Client {
  constructor() {
    this.cookies = new Map();
  }

  store(response) {
    const cookies = response.headers.getSetCookie?.() || [];
    for (const cookie of cookies) {
      const [pair, ...attrs] = cookie.split(";");
      const index = pair.indexOf("=");
      if (index < 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const expired = attrs.some((attr) => /max-age=0/i.test(attr.trim()));
      if (expired || !value) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async request(method, path, options = {}) {
    const headers = { Origin: BASE, ...(options.headers || {}) };
    if (this.cookies.size > 0) {
      headers.Cookie = [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    }
    let body = options.body;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(120000),
    });
    this.store(response);
    return response;
  }

  async json(method, path, options) {
    const response = await this.request(method, path, options);
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { response, data, status: response.status };
  }
}

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function uploadFile(client, { name, buffer, parentId = null, resume = false }) {
  const clientKey = `${name}|${buffer.length}|${Date.now()}`;
  const init = await client.json("POST", "/api/uploads", {
    json: { name, size: buffer.length, parentId, clientKey },
  });
  check(init.status === 200, `初始化上传 ${name}`, JSON.stringify(init.data));
  const { id, chunkSize, totalChunks } = init.data;
  let startChunk = 0;
  if (resume) {
    const first = buffer.subarray(0, Math.min(chunkSize, buffer.length));
    const put = await client.request("PUT", `/api/uploads/${id}/chunks/0`, {
      body: first,
      headers: { "Content-Type": "application/octet-stream" },
    });
    check(put.status === 200, "上传第一个分片");
    const again = await client.json("POST", "/api/uploads", {
      json: { name, size: buffer.length, parentId, clientKey },
    });
    check(again.data.resumed === true, "同一文件重新选择后恢复上传会话");
    check(again.data.received.includes(0), "恢复响应包含已上传分片");
    startChunk = 1;
  }
  for (let index = startChunk; index < totalChunks; index += 1) {
    const chunk = buffer.subarray(index * chunkSize, Math.min(buffer.length, (index + 1) * chunkSize));
    const put = await client.request("PUT", `/api/uploads/${id}/chunks/${index}`, {
      body: chunk,
      headers: { "Content-Type": "application/octet-stream" },
    });
    if (put.status !== 200) {
      const detail = await put.text();
      check(false, `上传分片 ${index}`, detail);
    }
  }
  const complete = await client.json("POST", `/api/uploads/${id}/complete`);
  check(complete.status === 201, `完成上传 ${name}`, JSON.stringify(complete.data));
  return complete.data.file;
}

async function main() {
  console.log(`\nMilktea Cloud smoke test → ${BASE}\n`);

  const landing = await fetch(BASE);
  const landingHtml = await landing.text();
  check(landing.status === 200, "首页可访问");
  check(landingHtml.includes("Milktea Cloud"), "首页包含品牌名");

  const anonymous = new Client();
  const meAnon = await anonymous.json("GET", "/api/me");
  check(meAnon.status === 401, "未登录访问 /api/me 返回 401");

  const suffix = Date.now().toString(36);
  const userA = `smoke_a_${suffix}`;
  const userB = `smoke_b_${suffix}`;
  const clientA = new Client();
  const clientB = new Client();

  const registerA = await clientA.json("POST", "/api/auth/register", {
    json: { username: userA, password: PASSWORD, displayName: "测试甲" },
  });
  check(registerA.status === 201, "注册账号 A", JSON.stringify(registerA.data));
  check(typeof registerA.data?.user?.isAdmin === "boolean", "账号 A 返回角色信息");
  const meA = await clientA.json("GET", "/api/me");
  check(meA.status === 200 && meA.data.user.username === userA, "账号 A 会话有效");

  const registerB = await clientB.json("POST", "/api/auth/register", {
    json: { username: userB, password: PASSWORD, displayName: "测试乙" },
  });
  check(registerB.status === 201, "注册账号 B");
  check(registerB.data?.user?.isAdmin === false, "第二个账号不是站长");

  const folder = await clientA.json("POST", "/api/files/folder", {
    json: { name: "测试文件夹", parentId: null },
  });
  check(folder.status === 201, "创建文件夹", JSON.stringify(folder.data));
  const folderId = folder.data.folder.id;

  const subfolder = await clientA.json("POST", "/api/files/folder", {
    json: { name: "子文件夹", parentId: folderId },
  });
  check(subfolder.status === 201, "创建子文件夹");
  const subfolderId = subfolder.data.folder.id;

  const badMove = await clientA.json("PATCH", `/api/files/${folderId}`, {
    json: { parentId: subfolderId },
  });
  check(badMove.status === 400, "不能把文件夹移动到自己的子目录");

  const payload = randomBytes(20 * 1024 * 1024 + 123);
  const file = await uploadFile(clientA, {
    name: "大文件.bin",
    buffer: payload,
    parentId: folderId,
    resume: true,
  });
  check(file.size === payload.length, "上传文件大小正确");

  const empty = await uploadFile(clientA, { name: "空文件.txt", buffer: Buffer.alloc(0), parentId: folderId });
  check(empty.size === 0, "空文件上传成功");

  const listed = await clientA.json("GET", `/api/files?parent=${folderId}`);
  check(listed.status === 200, "列出文件夹");
  check(listed.data.entries.some((entry) => entry.id === file.id), "列表包含上传的文件");
  check(listed.data.entries.some((entry) => entry.id === empty.id), "列表包含空文件");

  const full = await clientA.request("GET", `/api/files/${file.id}/download`);
  const fullBuffer = Buffer.from(await full.arrayBuffer());
  check(full.status === 200, "完整下载状态 200");
  check(full.headers.get("accept-ranges") === "bytes", "下载响应声明 Accept-Ranges");
  check(fullBuffer.length === payload.length && sha(fullBuffer) === sha(payload), "完整下载内容一致");

  const ranged = await clientA.request("GET", `/api/files/${file.id}/download`, {
    headers: { Range: "bytes=100-1099" },
  });
  const rangedBuffer = Buffer.from(await ranged.arrayBuffer());
  check(ranged.status === 206, "Range 请求返回 206");
  check(ranged.headers.get("content-range") === `bytes 100-1099/${payload.length}`, "Content-Range 正确");
  check(rangedBuffer.length === 1000 && rangedBuffer.equals(payload.subarray(100, 1100)), "Range 内容正确");

  const suffixRange = await clientA.request("GET", `/api/files/${file.id}/download`, {
    headers: { Range: "bytes=-500" },
  });
  const suffixBuffer = Buffer.from(await suffixRange.arrayBuffer());
  check(suffixRange.status === 206 && suffixBuffer.equals(payload.subarray(-500)), "后缀 Range 正确");

  const badRange = await clientA.request("GET", `/api/files/${file.id}/download`, {
    headers: { Range: "bytes=99999999999-" },
  });
  check(badRange.status === 416, "越界 Range 返回 416");

  const head = await clientA.request("HEAD", `/api/files/${file.id}/download`);
  check(
    head.status === 200 && head.headers.get("content-length") === String(payload.length),
    "HEAD 返回正确长度",
  );

  const search = await clientA.json("GET", "/api/files/search?q=大文件");
  check(search.status === 200 && search.data.entries.some((entry) => entry.id === file.id), "搜索文件名");

  const renamed = await clientA.json("PATCH", `/api/files/${file.id}`, { json: { name: "重命名.bin" } });
  check(renamed.status === 200 && renamed.data.file.name === "重命名.bin", "重命名文件");

  const moved = await clientA.json("PATCH", `/api/files/${file.id}`, { json: { parentId: subfolderId } });
  check(moved.status === 200 && moved.data.file.parentId === subfolderId, "移动文件到子文件夹");

  const shared = await clientA.json("POST", "/api/shares", {
    json: { fileId: file.id, password: "4821", expiresInDays: 7 },
  });
  check(shared.status === 201, "创建带提取码的分享", JSON.stringify(shared.data));
  const share = shared.data.share;
  check(share.token.length >= 16 && share.hasPassword === true, "分享 token 与提取码标记正确");

  const publicPage = await fetch(`${BASE}/s/${share.token}`);
  check(publicPage.status === 200, "公开分享页可访问");

  const publicMetaLocked = await fetch(`${BASE}/api/share/${share.token}`);
  const lockedMeta = await publicMetaLocked.json();
  check(lockedMeta.requiresPassword === true && lockedMeta.unlocked === false, "未解锁时公开元信息正确");

  const lockedDownload = await fetch(`${BASE}/api/share/${share.token}/download`);
  check(lockedDownload.status === 401, "未解锁下载返回 401");

  const wrong = await fetch(`${BASE}/api/share/${share.token}/unlock`, {
    method: "POST",
    headers: { Origin: BASE, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "0000" }),
  });
  check(wrong.status === 403, "错误提取码返回 403");

  const publicClient = new Client();
  const unlocked = await publicClient.json("POST", `/api/share/${share.token}/unlock`, {
    json: { password: "4821" },
  });
  check(unlocked.status === 200 && unlocked.data.unlocked === true, "正确提取码解锁分享");

  const publicDownload = await publicClient.request("GET", `/api/share/${share.token}/download`);
  const publicBuffer = Buffer.from(await publicDownload.arrayBuffer());
  check(
    publicDownload.status === 200 && sha(publicBuffer) === sha(payload),
    "公开下载内容一致",
  );

  const publicRange = await publicClient.request("GET", `/api/share/${share.token}/download`, {
    headers: { Range: "bytes=2000-2999" },
  });
  const publicRangeBuffer = Buffer.from(await publicRange.arrayBuffer());
  check(
    publicRange.status === 206 && publicRangeBuffer.equals(payload.subarray(2000, 3000)),
    "公开下载支持 Range",
  );

  const publicMeta = await publicClient.json("GET", `/api/share/${share.token}`);
  check(publicMeta.data.unlocked === true, "解锁 Cookie 生效");

  const openShare = await clientA.json("POST", "/api/shares", { json: { fileId: empty.id } });
  check(openShare.status === 201 && openShare.data.share.hasPassword === false, "创建无提取码分享");

  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle cx="10" cy="10" r="9"/></svg>',
  );
  const svgFile = await uploadFile(clientA, { name: "危险.svg", buffer: svg, parentId: folderId });
  const svgInline = await clientA.request("GET", `/api/files/${svgFile.id}/download?inline=1`);
  check(
    svgInline.headers.get("content-disposition")?.startsWith("attachment") === true,
    "SVG 即使请求内联也强制下载",
  );
  check(
    svgInline.headers.get("content-security-policy")?.includes("sandbox") === true,
    "SVG 响应带 sandbox CSP",
  );

  const searchB = await clientB.json("GET", "/api/files/search?q=重命名");
  check(searchB.data.entries.length === 0, "账号 B 搜不到账号 A 的文件");
  const listB = await clientB.json("GET", `/api/files?parent=${folderId}`);
  check(listB.status === 404, "账号 B 无法列出账号 A 的文件夹");
  const stealDownload = await clientB.request("GET", `/api/files/${file.id}/download`);
  check(stealDownload.status === 404, "账号 B 无法下载账号 A 的文件");
  const stealRename = await clientB.json("PATCH", `/api/files/${file.id}`, { json: { name: "偷走.bin" } });
  check(stealRename.status === 404, "账号 B 无法重命名账号 A 的文件");
  const stealShare = await clientB.json("POST", "/api/shares", { json: { fileId: file.id } });
  check(stealShare.status === 404, "账号 B 无法分享账号 A 的文件");

  const trash = await clientA.json("DELETE", `/api/files/${file.id}`);
  check(trash.status === 200, "删除文件到回收站");
  const trashList = await clientA.json("GET", "/api/trash");
  check(trashList.data.entries.some((entry) => entry.id === file.id), "回收站包含已删除文件");

  const shareOfTrash = await fetch(`${BASE}/api/share/${share.token}`);
  check(shareOfTrash.status === 404, "已删除文件的分享不可访问");

  const restored = await clientA.json("POST", `/api/trash/${file.id}`);
  check(restored.status === 200 && restored.data.file.name === "重命名.bin", "从回收站恢复文件");
  const afterRestore = await clientA.json("GET", `/api/files?parent=${subfolderId}`);
  check(afterRestore.data.entries.some((entry) => entry.id === file.id), "恢复后文件回到原文件夹");

  const shareAlive = await fetch(`${BASE}/api/share/${share.token}`);
  check(shareAlive.status === 200, "恢复后原分享链接重新生效");

  const revoke = await clientA.json("DELETE", `/api/shares/${openShare.data.share.id}`);
  check(revoke.status === 200, "取消分享");
  const revokedMeta = await fetch(`${BASE}/api/share/${openShare.data.share.token}`);
  check(revokedMeta.status === 404, "取消后分享链接失效");

  const cleanName = await clientA.json("POST", "/api/files/folder", {
    json: { name: "../越界/名称", parentId: null },
  });
  check(cleanName.status === 201, "危险名称仍可安全创建");
  check(!cleanName.data.folder.name.includes("/") && !cleanName.data.folder.name.includes(".."), "文件名过滤路径分隔符");

  const duplicate = await clientA.json("POST", "/api/files/folder", {
    json: { name: "测试文件夹", parentId: null },
  });
  check(
    duplicate.data.folder.name.startsWith("测试文件夹 (") && duplicate.data.folder.name !== "测试文件夹",
    "同名文件夹自动加序号",
  );

  const trashFolder = await clientA.json("DELETE", `/api/files/${folderId}`);
  check(trashFolder.status === 200, "删除整个文件夹到回收站");
  const emptied = await clientA.json("DELETE", "/api/trash");
  check(emptied.status === 200 && emptied.data.count > 0, "清空回收站并释放文件");
  const trashAfterEmpty = await clientA.json("GET", "/api/trash");
  check(trashAfterEmpty.data.entries.length === 0, "清空后回收站为空");
  const purgedDownload = await clientA.request("GET", `/api/files/${file.id}/download`);
  check(purgedDownload.status === 404, "彻底删除后文件不可下载");
  const purgedShare = await fetch(`${BASE}/api/share/${share.token}`);
  check(purgedShare.status === 404, "彻底删除后分享级联失效");

  const pwWrong = await clientB.json("POST", "/api/me/password", {
    json: { currentPassword: "wrong-password", newPassword: "new-pass-456" },
  });
  check(pwWrong.status === 403, "错误当前密码无法修改密码");
  const pwChange = await clientB.json("POST", "/api/me/password", {
    json: { currentPassword: PASSWORD, newPassword: "new-pass-456" },
  });
  check(pwChange.status === 200, "修改密码成功");
  const meB = await clientB.json("GET", "/api/me");
  check(meB.status === 200, "修改密码后当前会话仍有效");

  const loginOld = await new Client().json("POST", "/api/auth/login", {
    json: { username: userB, password: PASSWORD },
  });
  check(loginOld.status === 401, "旧密码无法登录");
  const loginNew = await new Client().json("POST", "/api/auth/login", {
    json: { username: userB, password: "new-pass-456" },
  });
  check(loginNew.status === 200, "新密码可以登录");

  const logout = await clientA.json("POST", "/api/auth/logout");
  check(logout.status === 200, "退出登录");
  const meAfter = await clientA.json("GET", "/api/me");
  check(meAfter.status === 401, "退出后会话失效");

  console.log(`\n全部通过：${checks} 项检查。\n`);
}

main().catch((error) => {
  console.error("\nSmoke test crashed:", error);
  process.exit(1);
});
