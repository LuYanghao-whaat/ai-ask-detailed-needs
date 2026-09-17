---
name: ai-ask-detailed-needs
description: 用独立交互窗口向用户做「看得清楚」的需求确认与方案选择——支持 Markdown 正文、带图片预览的选项卡、自由文本、多字段表单、多选排序、分步向导、表格与代码 diff、PDF/文本附件。当内置 question 工具表达不下时使用：要展示预览图、对比多种方案、附上文件、贴长文档、走多步流程、一次收集多个字段，或用户说「给我看看再选」「做个问卷/表单/向导让我填」。触发词：询问用户、需求确认、让用户选、方案对比、预览图、问卷、表单、向导、收集信息、ai-ask-detailed-needs。
version: "1.0.2"
---

# ai-ask-detailed-needs —— 富交互询问

用 `ai-ask-detailed-needs` 工具在用户桌面弹出一个**独立窗口**，把要说的话、要展示的图、要收集的字段一次讲清楚。用户提交后，工具返回结构化 JSON，直接进你的上下文。

窗口由本地服务渲染，**不需要 Python、不需要 Node、不需要用户装任何东西**——只要 opencode 能跑就能用。

当前版本：见本技能根目录的 `VERSION` 文件。

---

## 启动自检（每次会话第一次用本技能时做一次）

弹窗之前先查一次有没有新版。**网络失败就静默跳过，绝不因此中断对话或拖延弹窗。**

1. 读本技能根目录的 `VERSION`。
2. 取远程版本（短超时 3 秒左右）：
   `https://raw.githubusercontent.com/LuYanghao-whaat/ai-ask-detailed-needs/main/VERSION`
   备用地址（返回 base64，需解码）：
   `https://api.github.com/repos/LuYanghao-whaat/ai-ask-detailed-needs/contents/VERSION`
3. 远程版本更高时，**先问用户**，一句话就够：
   「ai-ask-detailed-needs 有新版本（本地 1.0.2 → 远程 1.1.0），要更新吗？」
   用户拒绝就继续用当前版本，本次会话不要再问。
4. 本地已是最新，静默继续，**不要提这件事**。

### 用户同意更新时

1. 下载 <https://codeload.github.com/LuYanghao-whaat/ai-ask-detailed-needs/zip/refs/heads/main>，
   解压到临时目录（Windows 用 `Expand-Archive`，macOS / Linux 用 `unzip`），得到 `ai-ask-detailed-needs-main/`。
2. 用它覆盖 `<配置目录>/skills/ai-ask-detailed-needs/`（`<配置目录>` 见文末「装到别的机器」）。
3. 用它里面的 `tools/ai-ask-detailed-needs.ts` 覆盖 `<配置目录>/tools/ai-ask-detailed-needs.ts`。
4. 告知用户：**工具代码要重启 opencode 才生效**；如果这次只改了 `assets/ui.html`，下一次弹窗就自动是新界面（界面是每次调用现读的），不用重启。

---

## 什么时候用它

**用**：
- 你要展示**看得见的东西**：预览图、界面截图、排版效果、图表、配色
- 要让用户在**多个方案间对比**（3 个封面、4 种架构、2 版文案）
- 需要**一次收集多个字段**（姓名/学号/日期/路径/选项）
- 需要**多步确认**（先选方向，再补细节）
- 要让用户**审阅**长文本、代码 diff、表格、附件
- 内置 question 的纯文字选项**说不清楚**

**不用**（继续用内置 `question`）：
- 2-4 个纯文字选项的简单确认，没有任何要展示的东西
- 只是问「可以吗 / 要不要继续」

同一轮里**不要**同时调用本工具和 `question`。一次只弹一个窗口；确实要多轮，等第一轮结果回来再弹下一个。

## 调用

```
ai-ask-detailed-needs(
  title:  "选一个论文封面风格",          // 必填，说清在确认什么
  icon:   "📄",                          // 可选，一个 emoji
  subtitle: "3 个方案 · 都已生成预览",   // 可选
  intro:  "我把你的题目套进去了……",       // 可选，Markdown
  timeoutSeconds: 900,                   // 可选，空闲超时（见下）
  wide: true,                            // 可选，多图并排时用
  blocks: [ ... ]                        // 单页模式
  // 或者 steps: [ { title, description, blocks:[...] }, ... ]  向导模式
)
```

`blocks` 和 `steps` **二选一**。完整块格式见 [references/spec.md](references/spec.md)。

## 最小示例

```
ai-ask-detailed-needs(
  title: "选一个配色",
  intro: "三个方向，点缩略图能放大看。",
  blocks: [
    { type: "choice", id: "theme", required: true, columns: 3,
      prompt: "你想要哪种？",
      options: [
        { id: "light", label: "清爽浅色", badge: "推荐", badgeTone: "acc",
          description: "白底，适合长时间阅读。",
          image: { kind: "svg", value: "<svg viewBox='0 0 320 200'>…</svg>" } },
        { id: "dark", label: "深色", description: "夜间友好。" },
        { id: "warm", label: "暖色", description: "偏纸张质感。" }
      ] },
    { type: "text", id: "note", prompt: "还有什么想调整的？", placeholder: "选填" }
  ]
)
```

## 写内容的要求

1. **intro 写清三件事**：背景（我知道什么）、已做的（我干了什么）、要用户决定什么。不要写「请选择以下选项」这种废话。
2. **选项卡片要有信息量**：`description` 一句话说清取舍（「正式、导师不易挑毛病」），不要只说「方案 A / 方案 B」。有明确倾向就加 `badge: "推荐"` + `badgeTone: "acc"`。
3. **能画就画**：AI 生成的预览图用 `image: { kind: "svg", value: "<svg…>" }`，不落盘、最省事。真实截图/文件用 `{ kind: "path", value: "C:\\…" }`（**本地路径会自动放行，不需要额外配置**）。
4. **长了就分步**：超过 5-6 个块，或流程有明显先后，用 `steps` 拆成 2-4 页，每页给 `title` 和 `description`。
5. **给得出答案的默认值**：`slider` 给 `default`，`form` 字段给 `default`/`placeholder`，`date` 给合理日期。用户能直接点提交最好。
6. **别把必填堆满**：只有真的需要才 `required: true`。选项类尽量给 `allowOther: true`，别把用户逼进死角。
7. **展示类内容别放进 `answers`**：`markdown` / `note` / `code` / `attachment` / `table`（未开 `selectable`）只是给人看的，不会出现在结果里。
8. **多行文字写真正的换行**：Markdown 正文、说明、选项描述里要换行，就在 JSON 字符串里写真正的换行，不要写 `\n` 两个字符。工具会自动纠正这种双转义并在 `warnings` 里提醒你，但别依赖它。
9. **按钮文字别起花哨名字**：`submitLabel` / `cancelLabel` 保持默认的「提交」「取消」就好。页面顶部的说明条会引用这两个词，用户要能一眼对上右下角的按钮。
10. **取消有二次确认**（默认开着，`cancelConfirm`）：文案是「如果取消，AI 会按它自己的理解继续完成任务，结果可能达不到你的要求」。如果这次询问取消掉无所谓（比如只是问问偏好），设 `cancelConfirm: false` 少一次点击。

## 超时（按强度给）

空闲超时 = 用户在这段时间里**完全没有任何操作**（鼠标、键盘、滚动都会重置计时）才判定未响应。用户一直在动就永远不会超时。

| 场景 | timeoutSeconds |
| --- | --- |
| 小确认、顺手一问 | 120 |
| 普通选择、填表 | 600 |
| 重要决策、要看材料 | 1800 |
| 必须等到答复，不能猜 | 0（不限时） |

超时不是失败：AI 会拿到 `status: "timeout"` 和用户**已填的部分**（`partial`）。此时**不要重开同一个窗口**，改用对话说明情况或换成更小的选择题。

## 读结果

工具返回 JSON：

```json
{
  "status": "submitted",          // submitted | cancelled | timeout | error
  "answers": { "theme": "light", "note": "标题再大一点" },
  "partial": null,                // timeout 时用户已填的内容
  "unanswered": [],               // 哪些必填 id 还没填
  "elapsedMs": 8421,
  "idleTimedOut": false,
  "hint": "…"                     // 针对本次状态的下一步建议
}
```

- `status: "submitted"` → 直接用 `answers` 干活。**不要复述整份答案**，一句「好，按浅色来做」就够。
- `status: "cancelled"` → 用户主动取消。问清原因，别立刻重开。
- `status: "timeout"` → 看 `partial` 和 `hint`。
- `status: "error"` → 看 `message`；如果是窗口没弹出来，把 `url` 给用户让他手动打开。
- `warnings` → 只在 spec 有问题时出现（比如交互块漏写 `id`，工具替你补成了 `q1`）。下次注意。

## 自检与调试

- **看界面长什么样**：直接双击 `assets/ui.html`，没有 spec 时会自动进入**演示模式**，把所有块类型渲染一遍（不影响真实询问）。
- **跳到某一页**：URL 加 `#step=2`。
- 工具找不到 `ui.html` 时返回 `error`：确认 `<opencode 配置目录>/skills/ai-ask-detailed-needs/assets/ui.html` 存在。

## 装到别的机器

把这两个目录原样拷过去即可，无需安装任何运行时：

```
<opencode 配置目录>/skills/ai-ask-detailed-needs/     # 界面 + 文档
<opencode 配置目录>/tools/ai-ask-detailed-needs.ts    # 本地服务 + 工具定义
```

拷完重启 opencode（工具和 skill 只在启动时加载）。
