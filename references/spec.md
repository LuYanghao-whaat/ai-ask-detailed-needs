# spec 完整参考

`ai-ask-detailed-needs` 的入参就是 spec。所有字段除特别标注外都可省略。

## 顶层字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 窗口标题，一句话说清在确认什么。**必填** |
| `subtitle` | string | 标题下一行小字 |
| `icon` | string | 标题左侧图标，一个 emoji 或 1-2 个字符 |
| `intro` | string | 顶部说明，Markdown。写清背景 / 已做 / 要决定什么 |
| `blocks` | Block[] | 单页模式的块数组，与 `steps` 二选一 |
| `steps` | Step[] | 向导模式，与 `blocks` 二选一 |
| `timeoutSeconds` | number | 空闲超时秒数，默认 900；`0` = 不限时 |
| `submitLabel` | string | 提交按钮文字，默认「提交」 |
| `cancelLabel` | string | 取消按钮文字，默认「取消」 |
| `nextLabel` / `prevLabel` | string | 向导按钮文字 |
| `allowCancel` | boolean | 默认 `true`；`false` 时不显示取消 |
| `howto` | boolean | 默认 `true`：页面顶部显示「这是 AI 在向你提问」的说明条。用户点 ✕ 关掉后会记住（localStorage），以后不再出现；设 `false` 则从不显示 |
| `theme` | `"auto"\|"light"\|"dark"` | 默认 `auto`（跟随系统） |
| `wide` | boolean | 用更宽的三栏布局，适合多图并排 |
| `density` | `"comfortable"\|"compact"` | 默认 `comfortable` |
| `windowMode` | `"auto"\|"app"\|"browser"` | 默认 `auto`：有 Edge/Chrome 用无边框窗口，否则默认浏览器 |
| `assets` | string[] | 额外的本地路径白名单（块里出现的本地路径会自动放行，通常不用填） |

`Step` = `{ id?, title, description?, blocks: Block[] }`

## 通用字段（所有块）

| 字段 | 说明 |
| --- | --- |
| `type` | **必填**，见下表 |
| `id` | 交互块建议给：结果 JSON 的 key。展示块可省 |
| `prompt` / `title` | 块标题 |
| `description` | 块说明（纯文本） |
| `card` | `false` 时去掉白底卡片 |

## 块类型

### `markdown` —— 正文

```js
{ type: "markdown", id: "spec", title: "格式要求",
  content: "## 二级标题\n\n支持 **加粗**、`行内代码`、[链接](https://x.com)、列表、表格、引用、围栏代码块。" }
```

额外：`collapsible: true` + `collapsed: true` + `summary: "展开看细节"` 可折叠。

### `note` —— 提示条

```js
{ type: "note", tone: "warn", title: "注意", content: "换封面不影响正文排版。" }
```

`tone`: `info` | `ok` | `warn` | `danger`（`success`/`error` 也接受）。`content` 支持 Markdown。

### `choice` —— 选项卡（**最常用**）

```js
{ type: "choice", id: "cover", required: true, columns: 3,
  prompt: "你想要哪种封面？",
  description: "点缩略图可放大",
  multiple: false,          // true = 多选
  min: 1, max: 3,           // 多选时的数量约束
  detailLabel: "看排版细节", // 每个选项的「查看详情」按钮文字
  allowOther: true,          // 允许补充说明
  otherLabel: "都不满意，我说说我的想法",
  otherPlaceholder: "补充说明",
  layout: "row",             // "row" = 图左文右的横排卡片
  options: [
    { id: "A", label: "极简居中",
      description: "留白多，导师最不容易挑毛病。",  // 支持 Markdown
      detail: "展开后的详细说明（Markdown）",
      image: { kind: "svg", value: "<svg…>" },     // 缩略图，见「图源」
      badge: "推荐", badgeTone: "acc",              // acc|ok|warn|danger
      disabled: false }
  ] }
```

- `columns`: 1 | 2 | 3。不给时：有图默认 2，无图默认 1。
- 选项多且都有图 → 配 `wide: true` 更舒服。
- 结果：单选 → 选项 id 字符串；多选 → id 数组；勾了补充说明 → `{ selected, other }`。

### `text` —— 自由文本

```js
{ type: "text", id: "extra", prompt: "还有什么要交代的？",
  placeholder: "例如：导师要求题目里必须出现……",
  multiline: true, rows: 4, default: "", required: false, maxLength: 500 }
```

`multiline: false` 渲染成单行输入。结果：字符串。

### `form` —— 多字段表单

```js
{ type: "form", id: "meta", columns: 2, required: true,
  prompt: "封面信息", description: "带 * 的必填",
  fields: [
    { id: "name", label: "姓名", type: "text", required: true, placeholder: "张三" },
    { id: "major", label: "专业", type: "select", required: true,
      options: ["计算机科学与技术", "软件工程"] },   // 或 [{value,label}]
    { id: "date", label: "提交日期", type: "date", default: "2026-06-01" },
    { id: "output", label: "导出目录", type: "path", default: "C:\\Users\\me\\Desktop",
      width: "full", help: "生成的文件放在这里" },
    { id: "watermark", label: "加「草稿」水印", type: "checkbox", help: "定稿前建议开着" }
  ] }
```

- `type`: `text` | `textarea` | `number` | `select` | `multiselect` | `date` | `time` | `checkbox` | `switch` | `path` | `color` | `password`
- `width: "full"` 占满一行；`columns: 2` 时默认半行。
- 结果：`{ 字段id: 值 }`，`checkbox` 为布尔，`number` 为数字，`multiselect` 为数组。

### `ranking` —— 拖动排序

```js
{ type: "ranking", id: "priority", prompt: "你最在意哪一点？",
  description: "拖动调整，第 1 项最重要。",
  hintText: "拖动调整优先级。",     // hintText:false 可关掉提示
  items: [ { id: "formal", label: "正式、不出错", description: "宁可平淡", image: {…} } ] }
```

结果：id 数组，按用户排序。

### `slider` —— 数值

```js
{ type: "slider", id: "fontScale", prompt: "标题放大多少？",
  min: 0, max: 40, step: 5, default: 10, unit: "%",
  marks: [{ label: "标准" }, { label: "+20%" }, { label: "+40%" }] }
```

结果：数字。

### `table` —— 表格

```js
{ type: "table", id: "files", prompt: "导出清单",
  selectable: "multi",          // "none"(默认，纯展示) | "single" | "multi"
  defaultSelected: [0, 1],
  compact: true,
  columns: [ { key: "file", label: "文件", mono: true },
             { key: "size", label: "大小", align: "num" },
             { key: "note", label: "说明", markdown: true } ],
  rows: [ { file: "cover.pdf", size: "184 KB", note: "封面单页" } ] }
```

- `align`: `left` | `num` | `center`；`mono` 用等宽字体，`markdown` 按 Markdown 渲染。
- 结果：`selectable: "multi"` → 行号数组；`"single"` → 行号或 null；`"none"` → 不进结果。

### `code` —— 代码 / diff

```js
{ type: "code", id: "patch", prompt: "将要写入的页眉",
  filename: "header.tex", language: "latex", diff: true,
  content: "-\\fancyhead[L]{旧}\n+\\fancyhead[L]{新}" }
```

`diff: true` 时以 `+` / `-` 开头的行为绿/红。右上角有复制按钮。纯展示，不进结果。

### `attachment` —— 附件预览

```js
{ type: "attachment", prompt: "参考附件", columns: 2,
  items: [
    { name: "截图.png", kind: "image", src: { kind: "path", value: "C:\\…\\a.png" }, description: "当前效果" },
    { name: "规范.txt", kind: "text", content: "直接内联的文本内容" },
    { name: "论文.pdf", kind: "pdf", src: { kind: "path", value: "C:\\…\\a.pdf" } },
    { name: "main.py", kind: "code", language: "python", src: { kind: "path", value: "C:\\…\\main.py" } }
  ] }
```

- `kind`: `image` | `pdf` | `text` | `code` | `file`。省略时按扩展名猜。
- `image` 可点开大图；`pdf` 内嵌预览；`text`/`code` 内联显示（`language` 控制高亮）。
- 用 `src` 指向文件，或用 `content` 直接内联内容。
- 纯展示，不进结果。

### `html` —— 内联 HTML / SVG

```js
{ type: "html", card: true, content: "<div>…</div>" }
```

`<script>` 和 `on*` 事件会被剥掉，可以放心塞 SVG。

### `divider` —— 分隔线

```js
{ type: "divider" }
```

## 图源（`image` / `src`）

四种写法，`kind` 省略时自动判断：

| 写法 | 用途 |
| --- | --- |
| `{ kind: "svg", value: "<svg …>…</svg>" }` | **AI 现画的预览图，首选**：不落盘、最省事 |
| `{ kind: "path", value: "C:\\…\\a.png" }` | 本地真实文件（截图、生成结果）。路径会自动放行 |
| `{ kind: "url", value: "https://…" }` | 网络图片 |
| `{ kind: "inline", value: "data:image/png;base64,…" }` | base64 内联 |

也可以直接写字符串：`image: "C:\\…\\a.png"`、`image: "https://…"`、`image: "<svg…>"`，工具会自动识别。

## 结果映射

| 块 | `answers[id]` |
| --- | --- |
| `choice` 单选 | `"optionId"` |
| `choice` 多选 | `["a","b"]` |
| `choice` 勾了补充说明 | `{ "selected": <上面之一>, "other": "文字" }` |
| `text` | 字符串 |
| `form` | `{ fieldId: 值 }` |
| `ranking` | id 数组（按用户排序） |
| `slider` | 数字 |
| `table`（可选） | 行号数组 / 单个行号 |
| 展示类块 | 不出现 |

`unanswered` 列出必填但没填的 `id`（`timeout` 时按 `partial` 计算）。

## 常用配方

**三方案对比（带预览图）**：`wide: true` + `choice{columns:3}` + 每个选项 `image: svg` + `detail` 放细节 + `allowOther: true`。

**审批/填表**：`form` 一次收齐（姓名、日期、路径、开关），`text` 兜底补充说明。

**审阅改动**：`code{diff:true}` 展示 diff + `table{selectable:"multi"}` 让用户勾选接受哪些 + `choice` 决定整体走向。

**多步向导**：`steps` 2-4 页，每页 3-5 个块。最后一页才放 `form` 这类重活；每页 `description` 写清这页在问什么。
