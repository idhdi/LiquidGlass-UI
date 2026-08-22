# LiquidGlass UI

**水感液态玻璃组件库** — 高透明玻璃 + 彩色泛光 + 水滴动效。

## 定位

区别于中性克制的 Apple Liquid Glass，LiquidGlass UI 主打**有机的"水感"**：

- **玻璃材质**：高透明 + 青色/紫色彩色泛光，非灰白中性
- **水感动效**：凝结水珠、流光、弹跳缓动作为组件签名交互
- **场景**：数据面板、汇报页、产品演示、动效展示

## 结构

```
LiquidGlass-UI/
├── tokens.css      # 设计令牌（颜色/玻璃/圆角/动效曲线）
├── glass.css       # 玻璃基础材质（场景背景/玻璃面板/水珠层）
├── components.css  # 15 个组件样式
├── demo.html       # 统一演示页（全部组件 + 交互）
├── package.json    # npm 发布元数据
└── wc/             # Web Components 封装
    ├── liquidglass-ui.js  # 原生 Custom Elements（单文件、零依赖）
    └── test.html          # Web Components 演示页
```

## 组件清单

| 类别 | 组件 |
|---|---|
| 导航 | Navbar |
| 按钮 | Button（primary/success/warning/danger/ghost，sm/lg/block） |
| 表单 | Input、Select、Checkbox、Radio、Switch、Slider |
| 数据 | Stat 指标卡、Progress 进度条 |
| 导航 | Tabs 标签页 |
| 反馈 | Badge 徽章、Toast 提示、Dropdown 下拉 |
| 容器 | Card、Glass 玻璃面板 |

## 使用（CSS 方式）

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="glass.css">
<link rel="stylesheet" href="components.css">
```

```html
<button class="lg-btn lg-btn--primary">主要按钮</button>
```

## Web Components（原生封装）

无需框架，引入单个 JS 即可使用 `<lg-*>` 标签：

```html
<script src="wc/liquidglass-ui.js"></script>

<lg-button variant="primary">主要按钮</lg-button>
<lg-card>...</lg-card>
<lg-input placeholder="姓名"></lg-input>
<lg-stat label="营收" value="¥86.2万" delta="+8.3%" trend="up"></lg-stat>
<lg-progress value="82" size="lg"></lg-progress>
<lg-switch checked>消息通知</lg-switch>
<lg-badge variant="success">已通过</lg-badge>
<lg-tabs><lg-tab>概览</lg-tab><lg-tab>图表</lg-tab></lg-tabs>
<lg-toast type="success">操作成功</lg-toast>
```

组件清单：`lg-button` `lg-card` `lg-input` `lg-select` `lg-switch`
`lg-badge` `lg-stat` `lg-progress` `lg-tabs` `lg-tab` `lg-toast`

特性：Shadow DOM 隔离、属性驱动、`lg-click`/`lg-toggle`/`lg-input` 等事件透传、零依赖。
预览：打开 `wc/test.html`；API 见 `window.LiquidGlassUI`。

## 在线演示

- Pages：https://idhdi.github.io/LiquidGlass-UI/
- 仓库：https://github.com/idhdi/LiquidGlass-UI

## 后续路线

- [x] 组件拆包发布（npm + Web Component）
- [ ] 参数化调参生成器（可视化导出代码）
- [ ] AI Skill 技能包（SKILL.md + 组件 JSON 元数据）
