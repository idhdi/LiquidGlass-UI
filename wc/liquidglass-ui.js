/* ============================================================
   LiquidGlass UI — Web Components
   ------------------------------------------------------------
   把 LiquidGlass-UI 的组件封装为原生 Custom Elements。
   特性：
   - Shadow DOM 隔离：组件样式自包含，不污染全局
   - 属性驱动：variant / size / value 等通过 HTML 属性控制
   - 事件驱动：input / change / click 事件透传
   - 零依赖：无需框架，原生浏览器支持
   ============================================================ */

(function () {
  'use strict';

  /* ---------- 共享样式（tokens + glass + components） ---------- */
  var LG_CSS = `/* ============================================================
   LiquidGlass UI — 设计令牌 (Design Tokens)
   ------------------------------------------------------------
   定位：水感液态玻璃组件库。
   - 玻璃：高透明 + 彩色泛光，非中性克制（区别于 Apple 系）
   - 水感：水滴、雨滴、波纹作为组件签名动效
   - 场景：数据面板、汇报页、产品演示
   ============================================================ */

:host, :root {
  /* ---------- 玻璃材质 ---------- */
  --lg-glass-bg: rgba(255, 255, 255, 0.12);
  --lg-glass-bg-strong: rgba(255, 255, 255, 0.22);
  --lg-glass-bg-soft: rgba(255, 255, 255, 0.06);
  --lg-glass-border: rgba(255, 255, 255, 0.35);
  --lg-glass-highlight: rgba(255, 255, 255, 0.6);
  --lg-glass-shadow: rgba(0, 0, 0, 0.25);
  --lg-blur: blur(20px) saturate(180%);

  /* ---------- 颜色 ---------- */
  --lg-text: #ffffff;
  --lg-text-secondary: rgba(255, 255, 255, 0.72);
  --lg-text-muted: rgba(255, 255, 255, 0.5);
  --lg-accent: #5ec8ff;            /* 主强调色（青） */
  --lg-accent-2: #7873f5;          /* 次强调色（紫） */
  --lg-success: #4ade80;
  --lg-warning: #fbbf24;
  --lg-danger: #ff6b81;

  /* ---------- 渐变背景（页面场景层） ---------- */
  --lg-scene:
    linear-gradient(120deg, #ff6ec4, #7873f5, #4ade80, #38bdf8);
  --lg-scene-size: 300% 300%;

  /* ---------- 圆角 / 间距 / 动效 ---------- */
  --lg-radius: 20px;
  --lg-radius-sm: 12px;
  --lg-radius-pill: 999px;
  --lg-space-1: 4px;
  --lg-space-2: 8px;
  --lg-space-3: 12px;
  --lg-space-4: 16px;
  --lg-space-5: 24px;
  --lg-space-6: 32px;
  --lg-ease: cubic-bezier(0.34, 1.56, 0.64, 1);   /* 弹跳 */
  --lg-ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --lg-duration: 0.3s;
  --lg-duration-fast: 0.15s;

  /* ---------- 字体 ---------- */
  --lg-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
    "Microsoft YaHei", Roboto, sans-serif;
  --lg-font-mono: ui-monospace, "Cascadia Code", Consolas, monospace;
}

/* ============================================================
   LiquidGlass UI — 玻璃基础材质 (Glass Foundation)
   ------------------------------------------------------------
   页面场景 + 玻璃面板核心 + 水珠装饰层。
   所有组件都基于 .lg-glass 派生。
   ============================================================ */

/* ---------- 页面场景 ---------- */
.lg-scene {
  min-height: 100vh;
  background: var(--lg-scene);
  background-size: var(--lg-scene-size);
  animation: lg-scene-shift 18s ease infinite;
  padding: 40px 20px 100px;
  color: var(--lg-text);
  font-family: var(--lg-font);
  box-sizing: border-box;
}
.lg-scene *,
.lg-scene *::before,
.lg-scene *::after { box-sizing: border-box; }

@keyframes lg-scene-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* ---------- 玻璃面板核心 ---------- */
.lg-glass {
  position: relative;
  background: var(--lg-glass-bg);
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);
  border: 1px solid var(--lg-glass-border);
  border-radius: var(--lg-radius);
  box-shadow:
    0 8px 32px var(--lg-glass-shadow),
    0 0 26px rgba(255,255,255,0.08),
    0 0 70px rgba(94,200,255,0.07),
    inset 0 1px 1px var(--lg-glass-highlight),
    inset 0 -1px 1px rgba(0,0,0,0.05);
  overflow: hidden;
}

/* 顶部斜向液面高光 */
.lg-glass::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 40%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 2;
}

/* 旋转光斑（液态光泽） */
.lg-glass::after {
  content: "";
  position: absolute;
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
  background: radial-gradient(circle at center, rgba(255,255,255,0.25), rgba(255,255,255,0.05) 40%, transparent 70%);
  mix-blend-mode: soft-light;
  pointer-events: none;
  animation: lg-sheen 14s ease-in-out infinite;
  z-index: 1;
}
@keyframes lg-sheen {
  0%   { transform: translate(-30%, -30%) rotate(0deg); opacity: 0.8; }
  50%  { transform: translate(30%, 30%) rotate(180deg); opacity: 0.4; }
  100% { transform: translate(-30%, -30%) rotate(360deg); opacity: 0.8; }
}

/* ---------- 水珠装饰层（凝结水珠） ---------- */
.lg-droplets {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  overflow: hidden;
  border-radius: inherit;
}
.lg-droplet {
  position: absolute;
  left: var(--x, 10%);
  top: var(--y, 10%);
  width: var(--s, 12px);
  height: calc(var(--s, 12px) * 1.18);
  border-radius: 62% 38% 55% 45% / 68% 62% 38% 32%;
  background:
    radial-gradient(circle at 30% 22%, rgba(255,255,255,0.5), rgba(255,255,255,0.12) 20%, transparent 45%),
    radial-gradient(circle at 68% 85%, rgba(255,255,255,0.16) 0%, transparent 35%),
    radial-gradient(circle at 46% 46%, rgba(200,225,255,0.08), rgba(170,200,240,0.04) 55%, rgba(140,175,225,0.06) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.16),
    inset 0 -3px 5px rgba(255,255,255,0.18),
    0 2px 3px rgba(0,0,0,0.14);
  opacity: 0.9;
  animation: lg-droplet-pulse var(--dur, 5s) ease-in-out infinite;
  animation-delay: var(--d, 0s);
  will-change: opacity;
}
@keyframes lg-droplet-pulse {
  0%, 100% { opacity: 0.75; }
  50%      { opacity: 1; }
}

/* ---------- 通用布局辅助 ---------- */
.lg-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lg-space-4);
  align-items: center;
}
.lg-col {
  display: flex;
  flex-direction: column;
  gap: var(--lg-space-3);
}
.lg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--lg-space-4);
}
.lg-section-title {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--lg-text-secondary);
  margin: 40px 0 14px;
  font-weight: 600;
}
.lg-h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 6px;
  text-shadow: 0 1px 8px rgba(0,0,0,0.2);
}
.lg-sub {
  color: var(--lg-text-secondary);
  font-size: 15px;
  margin: 0 0 40px;
}

/* ============================================================
   LiquidGlass UI — 组件库 (Components)
   ------------------------------------------------------------
   每个组件基于 .lg-glass 或独立玻璃样式，风格统一：
   半透明、彩色泛光、弹跳缓动、水感交互。
   ============================================================ */

/* ============================================================
   1. Button 按钮
   ============================================================ */
.lg-btn {
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 600;
  padding: 12px 22px;
  border-radius: var(--lg-radius-pill);
  border: 1px solid var(--lg-glass-border);
  cursor: pointer;
  color: var(--lg-text);
  background: var(--lg-glass-bg);
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15), inset 0 1px 1px var(--lg-glass-highlight);
  transition: transform var(--lg-duration-fast) var(--lg-ease),
              background 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
}
.lg-btn:hover { background: var(--lg-glass-bg-strong); transform: translateY(-2px); }
.lg-btn:active { transform: translateY(0) scale(0.97); }
.lg-btn:focus-visible { outline: 2px solid var(--lg-accent); outline-offset: 3px; }

.lg-btn--primary {
  background: linear-gradient(135deg, rgba(94,200,255,0.85), rgba(120,115,245,0.85));
  border-color: rgba(255,255,255,0.5);
  box-shadow: 0 4px 16px rgba(94,200,255,0.25);
}
.lg-btn--primary:hover {
  background: linear-gradient(135deg, rgba(94,200,255,1), rgba(120,115,245,1));
  box-shadow: 0 6px 24px rgba(94,200,255,0.4);
}
.lg-btn--primary::after {           /* 流光扫过 */
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(115deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%);
  transform: translateX(-100%) skewX(-15deg);
  transition: transform 0.5s ease;
  pointer-events: none;
}
.lg-btn--primary:hover::after { transform: translateX(100%) skewX(-15deg); }

.lg-btn--success { background: linear-gradient(135deg, rgba(74,222,128,0.85), rgba(94,200,255,0.75)); }
.lg-btn--warning { background: linear-gradient(135deg, rgba(251,191,36,0.85), rgba(255,110,180,0.7)); }
.lg-btn--danger  { background: linear-gradient(135deg, rgba(255,107,129,0.9), rgba(120,115,245,0.75)); }
.lg-btn--ghost   { background: transparent; backdrop-filter: none; box-shadow: none; }

.lg-btn--sm { padding: 8px 14px; font-size: 13px; }
.lg-btn--lg { padding: 15px 30px; font-size: 16px; }
.lg-btn--block { display: block; width: 100%; }
.lg-btn:disabled { opacity: 0.42; cursor: not-allowed; }

/* ============================================================
   2. Input 输入框
   ============================================================ */
.lg-field { display: flex; flex-direction: column; gap: 6px; }
.lg-field > label {
  font-size: 13px;
  font-weight: 600;
  color: var(--lg-text-secondary);
  letter-spacing: 0.02em;
}
.lg-input {
  font-family: inherit;
  font-size: 14.5px;
  color: var(--lg-text);
  padding: 12px 16px;
  border-radius: var(--lg-radius-sm);
  border: 1px solid var(--lg-glass-border);
  background: var(--lg-glass-bg-soft);
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  outline: none;
}
.lg-input::placeholder { color: var(--lg-text-muted); }
.lg-input:focus {
  border-color: rgba(94,200,255,0.7);
  background: var(--lg-glass-bg);
  box-shadow: 0 0 0 3px rgba(94,200,255,0.2), inset 0 1px 1px rgba(255,255,255,0.15);
}
.lg-input--sm { padding: 8px 12px; font-size: 13px; }
.lg-input--error { border-color: rgba(255,107,129,0.7); }
.lg-input--error:focus { box-shadow: 0 0 0 3px rgba(255,107,129,0.2); }
.lg-hint { font-size: 12px; color: var(--lg-text-muted); }
.lg-hint--error { color: var(--lg-danger); }

/* ============================================================
   3. Select 下拉选择（原生，套玻璃壳）
   ============================================================ */
.lg-select {
  font-family: inherit;
  font-size: 14.5px;
  color: var(--lg-text);
  padding: 12px 38px 12px 16px;
  border-radius: var(--lg-radius-sm);
  border: 1px solid var(--lg-glass-border);
  background:
    linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.6) 50%) calc(100% - 20px) 50% / 8px 8px no-repeat,
    linear-gradient(135deg, rgba(255,255,255,0.6) 50%, transparent 50%) calc(100% - 14px) 50% / 8px 8px no-repeat,
    var(--lg-glass-bg-soft);
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.lg-select:focus { border-color: rgba(94,200,255,0.7); box-shadow: 0 0 0 3px rgba(94,200,255,0.2); }
.lg-select option { color: #1d1d1f; background: #f5f5f7; }

/* ============================================================
   4. Checkbox 复选框 / 5. Radio 单选框
   ============================================================ */
.lg-check,
.lg-radio {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--lg-text);
  user-select: none;
}
.lg-check input,
.lg-radio input { position: absolute; opacity: 0; width: 0; height: 0; }
.lg-check .box,
.lg-radio .box {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1px solid var(--lg-glass-border);
  background: var(--lg-glass-bg-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s var(--lg-ease);
  position: relative;
}
.lg-radio .box { border-radius: 50%; }
.lg-check .box::after,
.lg-radio .box::after {
  content: "";
  width: 11px;
  height: 6px;
  border-left: 2.5px solid #fff;
  border-bottom: 2.5px solid #fff;
  transform: rotate(-45deg) scale(0);
  transition: transform 0.2s var(--lg-ease);
}
.lg-radio .box::after {
  width: 8px;
  height: 8px;
  border: 0;
  border-radius: 50%;
  background: #fff;
  transform: scale(0);
}
.lg-check input:checked + .box,
.lg-radio input:checked + .box {
  background: linear-gradient(135deg, rgba(94,200,255,0.9), rgba(120,115,245,0.9));
  border-color: transparent;
  box-shadow: 0 0 12px rgba(94,200,255,0.4);
}
.lg-check input:checked + .box::after,
.lg-radio input:checked + .box::after { transform: rotate(-45deg) scale(1); }
.lg-radio input:checked + .box::after { transform: scale(1); }
.lg-check input:focus-visible + .box,
.lg-radio input:focus-visible + .box { outline: 2px solid var(--lg-accent); outline-offset: 2px; }

/* ============================================================
   6. Switch 开关
   ============================================================ */
.lg-switch {
  width: 46px;
  height: 26px;
  border-radius: var(--lg-radius-pill);
  background: rgba(255,255,255,0.2);
  border: 1px solid var(--lg-glass-border);
  position: relative;
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
}
.lg-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  transition: left 0.4s var(--lg-ease);
}
.lg-switch.on { background: rgba(94,200,255,0.7); }
.lg-switch.on::after { left: 22px; }
.lg-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}
.lg-switch-row + .lg-switch-row { border-top: 1px solid rgba(255,255,255,0.15); }
.lg-switch-row span { font-size: 14.5px; }

/* ============================================================
   7. Tabs 标签页
   ============================================================ */
.lg-tabs {
  display: flex;
  gap: 4px;
  padding: 6px;
  border-radius: var(--lg-radius-pill);
  background: var(--lg-glass-bg-soft);
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);
  border: 1px solid var(--lg-glass-border);
  width: fit-content;
}
.lg-tab {
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--lg-text-secondary);
  padding: 8px 18px;
  border-radius: var(--lg-radius-pill);
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: all 0.25s var(--lg-ease);
}
.lg-tab:hover { color: var(--lg-text); }
.lg-tab.active {
  color: var(--lg-text);
  background: linear-gradient(135deg, rgba(94,200,255,0.7), rgba(120,115,245,0.7));
  box-shadow: 0 2px 12px rgba(94,200,255,0.3);
}

/* ============================================================
   8. Badge 徽章
   ============================================================ */
.lg-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--lg-radius-pill);
  background: var(--lg-glass-bg);
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);
  border: 1px solid var(--lg-glass-border);
  color: var(--lg-text);
  white-space: nowrap;
}
.lg-badge--accent  { background: rgba(94,200,255,0.45); }
.lg-badge--success { background: rgba(74,222,128,0.4); }
.lg-badge--warning { background: rgba(251,191,36,0.4); }
.lg-badge--danger  { background: rgba(255,107,129,0.45); }
.lg-badge--dot::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* ============================================================
   9. Stat 指标卡
   ============================================================ */
.lg-stat {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lg-stat__label {
  font-size: 13px;
  color: var(--lg-text-secondary);
  font-weight: 500;
}
.lg-stat__value {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.lg-stat__delta {
  font-size: 12.5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lg-stat__delta--up { color: var(--lg-success); }
.lg-stat__delta--down { color: var(--lg-danger); }

/* ============================================================
   10. Card 卡片（内容容器）
   ============================================================ */
.lg-card {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.lg-card:hover {
  transform: translateY(-6px);
  box-shadow:
    0 16px 40px rgba(0,0,0,0.3),
    0 0 30px rgba(94,200,255,0.25),
    0 0 80px rgba(94,200,255,0.12),
    inset 0 1px 1px var(--lg-glass-highlight);
}
.lg-card__title { font-size: 16px; font-weight: 600; margin: 0; }
.lg-card__desc { font-size: 13.5px; color: var(--lg-text-secondary); line-height: 1.5; margin: 0; }

/* ============================================================
   11. Progress 进度条
   ============================================================ */
.lg-progress {
  height: 8px;
  border-radius: var(--lg-radius-pill);
  background: rgba(255,255,255,0.15);
  border: 1px solid var(--lg-glass-border);
  overflow: hidden;
  position: relative;
}
.lg-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(94,200,255,0.9), rgba(120,115,245,0.9));
  box-shadow: 0 0 12px rgba(94,200,255,0.5);
  transition: width 0.6s var(--lg-ease-smooth);
  position: relative;
  overflow: hidden;
}
.lg-progress__bar::after {            /* 流光 */
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
  transform: translateX(-100%);
  animation: lg-progress-sheen 2.2s ease-in-out infinite;
}
@keyframes lg-progress-sheen {
  0%   { transform: translateX(-100%); }
  60%, 100% { transform: translateX(100%); }
}
.lg-progress--sm { height: 5px; }
.lg-progress--lg { height: 12px; }

/* ============================================================
   12. Slider 滑块
   ============================================================ */
.lg-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: var(--lg-radius-pill);
  background: rgba(255,255,255,0.18);
  border: 1px solid var(--lg-glass-border);
  outline: none;
}
.lg-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(94,200,255,1), rgba(120,115,245,1));
  box-shadow: 0 0 12px rgba(94,200,255,0.6), 0 2px 6px rgba(0,0,0,0.25);
  cursor: pointer;
  transition: transform 0.15s var(--lg-ease);
}
.lg-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
.lg-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 0;
  background: linear-gradient(135deg, rgba(94,200,255,1), rgba(120,115,245,1));
  box-shadow: 0 0 12px rgba(94,200,255,0.6);
  cursor: pointer;
}

/* ============================================================
   13. Dropdown 下拉菜单
   ============================================================ */
.lg-dropdown { position: relative; display: inline-block; }
.lg-dropdown__menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 180px;
  padding: 6px;
  border-radius: var(--lg-radius-sm);
  background: rgba(30, 40, 60, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--lg-glass-border);
  box-shadow: 0 12px 32px rgba(0,0,0,0.3);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px) scale(0.98);
  transition: all 0.2s var(--lg-ease);
  z-index: 50;
}
.lg-dropdown.open .lg-dropdown__menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
}
.lg-dropdown__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: var(--lg-text);
  font-size: 13.5px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}
.lg-dropdown__item:hover { background: rgba(255,255,255,0.12); }
.lg-dropdown__item--danger { color: var(--lg-danger); }

/* ============================================================
   14. Navbar 导航栏
   ============================================================ */
.lg-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  margin-bottom: 50px;
}
.lg-navbar__brand {
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.01em;
  position: relative;
  z-index: 4;
}
.lg-navbar__nav { display: flex; gap: 6px; position: relative; z-index: 4; }
.lg-navbar__link {
  color: var(--lg-text-secondary);
  text-decoration: none;
  font-size: 14px;
  padding: 8px 14px;
  border-radius: var(--lg-radius-pill);
  transition: all 0.25s ease;
  position: relative;
}
.lg-navbar__link::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  width: 0;
  height: 2px;
  border-radius: 2px;
  background: #fff;
  transform: translateX(-50%);
  transition: width 0.3s var(--lg-ease);
}
.lg-navbar__link:hover::after,
.lg-navbar__link.active::after { width: 60%; }
.lg-navbar__link:hover,
.lg-navbar__link.active { color: var(--lg-text); }

/* ============================================================
   15. Toast 提示
   ============================================================ */
.lg-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: var(--lg-radius-sm);
  background: rgba(30, 40, 60, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--lg-glass-border);
  box-shadow: 0 12px 32px rgba(0,0,0,0.3);
  font-size: 13.5px;
  animation: lg-toast-in 0.35s var(--lg-ease);
  width: fit-content;
}
@keyframes lg-toast-in {
  0%   { opacity: 0; transform: translateY(12px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.lg-toast__icon { font-size: 16px; }
.lg-toast--success .lg-toast__icon { color: var(--lg-success); }
.lg-toast--warning .lg-toast__icon { color: var(--lg-warning); }
.lg-toast--danger  .lg-toast__icon { color: var(--lg-danger); }

/* ---------- 无障碍：减少动画 ---------- */
@media (prefers-reduced-motion: reduce) {
  .lg-scene,
  .lg-glass::after,
  .lg-droplet,
  .lg-progress__bar::after { animation: none !important; }
  .lg-btn, .lg-glass, .lg-card { transition-duration: 0.01ms !important; }
}
`;

  /* ============================================================
     <lg-button>  按钮
     属性: variant="primary|success|warning|danger|ghost"
           size="sm|lg|block"   disabled
     用法: <lg-button variant="primary">点击</lg-button>
     ============================================================ */
  class LgButton extends HTMLElement {
    connectedCallback() {
      const cls = ['lg-btn'];
      const v = this.getAttribute('variant');
      if (v && v !== 'default') cls.push('lg-btn--' + v);
      const s = this.getAttribute('size');
      if (s) cls.push('lg-btn--' + s);
      if (this.hasAttribute('block')) cls.push('lg-btn--block');
      const disabled = this.hasAttribute('disabled');

      const btn = document.createElement('button');
      btn.className = cls.join(' ');
      if (disabled) btn.disabled = true;
      btn.innerHTML = '<slot></slot>';

      this.attachShadow({ mode: 'open' }).innerHTML = '<style>' + LG_CSS + '</style>';
      this.shadowRoot.appendChild(btn);

      btn.addEventListener('click', () => {
        if (disabled) return;
        this.dispatchEvent(new CustomEvent('lg-click', { bubbles: true, composed: true }));
      });
    }
  }

  /* ============================================================
     <lg-card>  卡片容器（玻璃 + 内容插槽）
     用法: <lg-card><h3>标题</h3><p>内容</p></lg-card>
     ============================================================ */
  class LgCard extends HTMLElement {
    connectedCallback() {
      const sh = this.attachShadow({ mode: 'open' });
      sh.innerHTML =
        '<style>' + LG_CSS + '</style>' +
        '<div class="lg-glass lg-card" style="height:100%;">' +
        '<span class="lg-droplets" aria-hidden="true">' +
        '  <span class="lg-droplet" style="--x:8%;--y:16%;--s:9px;--d:0s"></span>' +
        '  <span class="lg-droplet" style="--x:28%;--y:72%;--s:7px;--d:1.6s"></span>' +
        '  <span class="lg-droplet" style="--x:82%;--y:26%;--s:8px;--d:2.8s"></span>' +
        '</span>' +
        '<div class="lg-card__body" style="position:relative;z-index:4;"><slot></slot></div>' +
        '</div>';
    }
  }

  /* ============================================================
     <lg-input>  输入框
     属性: type="text|email|password"  value  placeholder  error
     事件: 输入时派发 lg-input
     ============================================================ */
  class LgInput extends HTMLElement {
    connectedCallback() {
      const cls = ['lg-input'];
      if (this.hasAttribute('error')) cls.push('lg-input--error');
      const input = document.createElement('input');
      input.className = cls.join(' ');
      input.type = this.getAttribute('type') || 'text';
      input.value = this.getAttribute('value') || '';
      input.placeholder = this.getAttribute('placeholder') || '';
      if (this.hasAttribute('disabled')) input.disabled = true;

      this.attachShadow({ mode: 'open' }).innerHTML = '<style>' + LG_CSS + '</style>';
      this.shadowRoot.appendChild(input);

      input.addEventListener('input', () => {
        this.dispatchEvent(new CustomEvent('lg-input', { detail: { value: input.value }, bubbles: true, composed: true }));
      });
    }
    setValue(v) {
      const i = this.shadowRoot && this.shadowRoot.querySelector('input');
      if (i) i.value = v;
    }
    getValue() {
      const i = this.shadowRoot && this.shadowRoot.querySelector('input');
      return i ? i.value : '';
    }
  }

  /* ============================================================
     <lg-select>  下拉选择
     用法: <lg-select><option>…</option></lg-select>
     ============================================================ */
  class LgSelect extends HTMLElement {
    connectedCallback() {
      const slotted = this.innerHTML;
      const sel = document.createElement('select');
      sel.className = 'lg-select';
      sel.innerHTML = slotted;
      this.attachShadow({ mode: 'open' }).innerHTML = '<style>' + LG_CSS + '</style>';
      this.shadowRoot.appendChild(sel);
      sel.addEventListener('change', () => {
        this.dispatchEvent(new CustomEvent('lg-change', { detail: { value: sel.value }, bubbles: true, composed: true }));
      });
    }
  }

  /* ============================================================
     <lg-switch>  开关
     属性: checked | on
     用法: <lg-switch checked>消息通知</lg-switch>
     ============================================================ */
  class LgSwitch extends HTMLElement {
    connectedCallback() {
      const on = this.hasAttribute('checked') || this.hasAttribute('on');
      const row = document.createElement('div');
      row.className = 'lg-switch-row';
      const label = document.createElement('span');
      label.style.cssText = 'position:relative;z-index:4;';
      label.innerHTML = '<slot></slot>';
      const sw = document.createElement('div');
      sw.className = 'lg-switch' + (on ? ' on' : '');
      row.appendChild(label);
      row.appendChild(sw);

      this.attachShadow({ mode: 'open' }).innerHTML = '<style>' + LG_CSS + '</style>';
      this.shadowRoot.appendChild(row);

      sw.addEventListener('click', () => {
        sw.classList.toggle('on');
        this.dispatchEvent(new CustomEvent('lg-toggle', { detail: { on: sw.classList.contains('on') }, bubbles: true, composed: true }));
      });
    }
    checked() {
      const sw = this.shadowRoot && this.shadowRoot.querySelector('.lg-switch');
      return sw ? sw.classList.contains('on') : false;
    }
  }

  /* ============================================================
     <lg-badge>  徽章
     属性: variant="accent|success|warning|danger"  dot
     ============================================================ */
  class LgBadge extends HTMLElement {
    connectedCallback() {
      const cls = ['lg-badge'];
      const v = this.getAttribute('variant');
      if (v) cls.push('lg-badge--' + v);
      if (this.hasAttribute('dot')) cls.push('lg-badge--dot');
      const badge = document.createElement('span');
      badge.className = cls.join(' ');
      badge.innerHTML = '<slot></slot>';
      this.attachShadow({ mode: 'open' }).innerHTML = '<style>' + LG_CSS + '</style>';
      this.shadowRoot.appendChild(badge);
    }
  }

  /* ============================================================
     <lg-stat>  指标卡
     属性: label  value  delta  trend="up|down"
     ============================================================ */
  class LgStat extends HTMLElement {
    connectedCallback() {
      const trend = this.getAttribute('trend');
      const arrow = trend === 'down' ? '▼' : '▲';
      const trendCls = trend === 'down' ? 'lg-stat__delta--down' : 'lg-stat__delta--up';
      const delta = this.getAttribute('delta');
      const sh = this.attachShadow({ mode: 'open' });
      sh.innerHTML =
        '<style>' + LG_CSS + '</style>' +
        '<div class="lg-glass lg-stat">' +
        '<span class="lg-stat__label">' + (this.getAttribute('label') || '') + '</span>' +
        '<span class="lg-stat__value">' + (this.getAttribute('value') || '') + '</span>' +
        (delta ? '<span class="lg-stat__delta ' + trendCls + '">' + arrow + ' ' + delta + '</span>' : '') +
        '</div>';
    }
  }

  /* ============================================================
     <lg-progress>  进度条
     属性: value="0-100"  size="sm|lg"
     ============================================================ */
  class LgProgress extends HTMLElement {
    connectedCallback() {
      const v = Math.max(0, Math.min(100, parseFloat(this.getAttribute('value')) || 0));
      const cls = ['lg-progress'];
      const s = this.getAttribute('size');
      if (s) cls.push('lg-progress--' + s);
      const wrap = document.createElement('div');
      wrap.className = cls.join(' ');
      const bar = document.createElement('div');
      bar.className = 'lg-progress__bar';
      bar.style.width = v + '%';
      wrap.appendChild(bar);
      this.attachShadow({ mode: 'open' }).innerHTML = '<style>' + LG_CSS + '</style>';
      this.shadowRoot.appendChild(wrap);
    }
    setValue(v) {
      const b = this.shadowRoot && this.shadowRoot.querySelector('.lg-progress__bar');
      if (b) b.style.width = Math.max(0, Math.min(100, +v)) + '%';
    }
  }

  /* ============================================================
     <lg-tabs> + <lg-tab>  标签页
     <lg-tab>面板一</lg-tab><lg-tab>面板二</lg-tab>
     ============================================================ */
  class LgTabs extends HTMLElement {
    connectedCallback() {
      const self = this;
      const sh = this.attachShadow({ mode: 'open' });
      sh.innerHTML = '<style>' + LG_CSS + '</style><div class="lg-tabs"><slot></slot></div>';
      this.addEventListener('lg-tab-select', function (e) {
        Array.prototype.forEach.call(self.children, function (c) {
          if (c.tagName === 'LG-TAB') c.deactivate();
        });
        const target = e.target;
        if (target.tagName === 'LG-TAB') target.activate();
      });
    }
  }

  class LgTab extends HTMLElement {
    connectedCallback() {
      const btn = document.createElement('button');
      btn.className = 'lg-tab';
      btn.innerHTML = '<slot></slot>';
      this.attachShadow({ mode: 'open' }).innerHTML = '<style>' + LG_CSS + '</style>';
      this.shadowRoot.appendChild(btn);
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('lg-tab-select', { bubbles: true, composed: true }));
      });
    }
    activate() {
      const btn = this.shadowRoot && this.shadowRoot.querySelector('.lg-tab');
      if (btn) btn.classList.add('active');
    }
    deactivate() {
      const btn = this.shadowRoot && this.shadowRoot.querySelector('.lg-tab');
      if (btn) btn.classList.remove('active');
    }
  }

  /* ============================================================
     <lg-toast>  提示
     属性: type="success|warning|danger"  icon
     ============================================================ */
  class LgToast extends HTMLElement {
    connectedCallback() {
      const icons = { success: '✓', warning: '⚠', danger: '✕' };
      const type = this.getAttribute('type') || 'success';
      const icon = this.getAttribute('icon') || icons[type] || '•';
      const sh = this.attachShadow({ mode: 'open' });
      sh.innerHTML =
        '<style>' + LG_CSS + '</style>' +
        '<div class="lg-toast lg-toast--' + type + '">' +
        '<span class="lg-toast__icon">' + icon + '</span><span><slot></slot></span></div>';
    }
  }

  /* ============================================================
     注册所有组件
     ============================================================ */
  const components = {
    'lg-button': LgButton,
    'lg-card': LgCard,
    'lg-input': LgInput,
    'lg-select': LgSelect,
    'lg-switch': LgSwitch,
    'lg-badge': LgBadge,
    'lg-stat': LgStat,
    'lg-progress': LgProgress,
    'lg-tabs': LgTabs,
    'lg-tab': LgTab,
    'lg-toast': LgToast
  };

  Object.keys(components).forEach(function (name) {
    if (!customElements.get(name)) {
      customElements.define(name, components[name]);
    }
  });

  window.LiquidGlassUI = {
    version: '0.1.0',
    components: components,
    css: LG_CSS
  };
})();
