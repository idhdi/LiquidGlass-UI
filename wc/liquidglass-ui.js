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

/* 旋转光斑（液态光泽）—— 双层：大光晕 + 小光点交错流动 */
.lg-glass::after {
  content: "";
  position: absolute;
  width: 220%;
  height: 220%;
  top: -60%;
  left: -60%;
  background:
    radial-gradient(circle at 30% 35%, rgba(255,255,255,0.30), rgba(255,255,255,0.06) 38%, transparent 62%),
    radial-gradient(circle at 70% 65%, rgba(160,210,255,0.18), transparent 45%);
  mix-blend-mode: soft-light;
  pointer-events: none;
  animation: lg-sheen 11s ease-in-out infinite;
  z-index: 1;
}
@keyframes lg-sheen {
  0%   { transform: translate(-25%, -25%) rotate(0deg); opacity: 0.9; }
  50%  { transform: translate(25%, 25%) rotate(160deg); opacity: 0.45; }
  100% { transform: translate(-25%, -25%) rotate(320deg); opacity: 0.9; }
}

/* 液态增强 1：顶部斜向流光（模拟液体表面反光流动） */
.lg-glass .lg-liquid-flow {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 1;
  background: linear-gradient(115deg,
    transparent 0%, transparent 30%,
    rgba(255,255,255,0.10) 42%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.10) 58%,
    transparent 70%, transparent 100%);
  background-size: 250% 100%;
  animation: lg-liquid-sweep 6s ease-in-out infinite;
}
@keyframes lg-liquid-sweep {
  0%   { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}

/* 液态增强 2：边缘水波纹（内圈细波纹，模拟水在玻璃边缘荡漾） */
.lg-glass .lg-ripple-edge {
  content: "";
  position: absolute;
  inset: 4px;
  border-radius: inherit;
  pointer-events: none;
  z-index: 1;
  border: 1px solid rgba(255,255,255,0.10);
  animation: lg-edge-pulse 5s ease-in-out infinite;
}
@keyframes lg-edge-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%      { opacity: 0.7; transform: scale(0.995); }
}

/* ===== 组件互动增强 (Interaction) ===== */
/* 悬停：流光加速 + 波纹放大 + 水珠聚拢（transform 交给 tilt 引擎） */
.lg-glass.lg-card:hover .lg-liquid-flow { animation-duration: 2.6s; }
.lg-glass.lg-card:hover .lg-ripple-edge { animation-duration: 2.4s; transform: scale(0.998); }
.lg-glass.lg-card:hover .lg-droplet {
  transform: scale(1.35);
  opacity: 1;
}
.lg-card .lg-droplet { transition: transform 0.35s var(--lg-ease), opacity 0.35s ease; }

/* 指标卡互动：悬停泛光（transform 交给 tilt 引擎） */
.lg-glass.lg-stat:hover {
  box-shadow:
    0 16px 40px rgba(0,0,0,0.3),
    0 0 30px rgba(94,200,255,0.22),
    0 0 70px rgba(94,200,255,0.10),
    inset 0 1px 1px var(--lg-glass-highlight);
}
.lg-stat { transition: transform 0.18s ease-out, box-shadow 0.3s ease; }

/* ===== 组件比例收缩 (Scale) =====
   通过 --lg-scale 变量控制主要组件整体缩放，
   配合 transform-origin 保持中心缩放。 */
.lg-card, .lg-stat {
  transform: scale(var(--lg-scale, 1));
  transform-origin: center;
}

/* ===== 鼠标互动 1：高光跟随 (Spotlight) =====
   玻璃上的"反光点"跟随光标移动 —— 像玻璃在追光 */
.lg-spotlight {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 2;
  background: radial-gradient(
    circle 220px at var(--sx, 50%) var(--sy, 50%),
    rgba(255,255,255,0.28) 0%,
    rgba(255,255,255,0.10) 35%,
    rgba(255,255,255,0) 70%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}
.lg-card:hover .lg-spotlight,
.lg-stat:hover .lg-spotlight { opacity: 1; }

/* ===== 鼠标互动 2：透视倾斜 (Tilt) =====
   鼠标靠近时玻璃微微"歪向"光标 —— perspective + rotateX/Y */
.lg-card, .lg-stat {
  perspective: 900px;
  will-change: transform;
  transition: transform 0.18s ease-out, box-shadow 0.3s ease;
}
.lg-tilt {
  transform:
    scale(var(--lg-scale, 1))
    rotateX(var(--rx, 0deg))
    rotateY(var(--ry, 0deg));
}
.lg-tilt-pressed {
  transform:
    scale(calc(var(--lg-scale, 1) * 0.97))
    rotateX(var(--rx, 0deg))
    rotateY(var(--ry, 0deg));
}

/* ===== 鼠标互动 3：点击涟漪 (Ripple) ===== */
.lg-ripple {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.75);
  box-shadow: 0 0 12px rgba(255,255,255,0.4), inset 0 0 6px rgba(255,255,255,0.3);
  pointer-events: none;
  z-index: 6;
  opacity: 0;
  animation: lg-ripple-expand 0.85s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
@keyframes lg-ripple-expand {
  0%   { transform: scale(0.3); opacity: 0.95; }
  100% { transform: scale(14); opacity: 0; }
}

/* ===== 鼠标互动 4：按压凹陷 (Press) =====
   按下时玻璃微微"凹进去" —— 内阴影加深 + 缩小 */
.lg-card, .lg-stat {
  box-shadow:
    0 8px 32px var(--lg-glass-shadow),
    0 0 26px rgba(255,255,255,0.08),
    inset 0 1px 1px var(--lg-glass-highlight),
    inset 0 -1px 1px rgba(0,0,0,0.05);
}
.lg-pressed {
  box-shadow:
    0 3px 12px rgba(0,0,0,0.2),
    inset 0 2px 8px rgba(0,0,0,0.22),
    inset 0 -1px 1px rgba(255,255,255,0.06);
}

/* ===== 鼠标互动 5：划出水痕 (Streak Trail) =====
   鼠标划过玻璃表面留下"擦痕/水痕"，过一会儿消退 */
.lg-streak {
  position: absolute;
  width: 4px;
  height: 60px;
  border-radius: 999px;
  pointer-events: none;
  z-index: 5;
  background: linear-gradient(to bottom,
    rgba(255,255,255,0.40),
    rgba(255,255,255,0.12) 55%,
    rgba(255,255,255,0) 100%);
  filter: blur(0.5px);
  opacity: 0;
  animation: lg-streak-fade 1.6s ease-out forwards;
}
@keyframes lg-streak-fade {
  0%   { opacity: 0.9; transform: translateY(0) scaleY(1); }
  60%  { opacity: 0.45; }
  100% { opacity: 0; transform: translateY(8px) scaleY(0.7); }
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
     共享互动引擎：高光跟随 / 透视倾斜 / 涟漪 / 按压 / 水痕
     绑定到任意玻璃容器（shadowRoot 内的 .lg-glass 元素）
     ============================================================ */
  function attachGlassInteractions(host, rootEl) {
    if (!rootEl) return;

    /* --- ② 透视倾斜 + ① 高光跟随 --- */
    rootEl.addEventListener('pointermove', function (e) {
      const rect = rootEl.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;   // 0..1
      const py = (e.clientY - rect.top) / rect.height;

      // 高光位置（百分比）
      rootEl.style.setProperty('--sx', (px * 100).toFixed(1) + '%');
      rootEl.style.setProperty('--sy', (py * 100).toFixed(1) + '%');

      // 透视倾斜：中心为 0，边缘最大 ±6deg
      rootEl.style.setProperty('--ry', ((px - 0.5) * 12).toFixed(2) + 'deg');
      rootEl.style.setProperty('--rx', ((0.5 - py) * 12).toFixed(2) + 'deg');
      rootEl.classList.add('lg-tilt');
    });
    rootEl.addEventListener('pointerleave', function () {
      rootEl.classList.remove('lg-tilt', 'lg-tilt-pressed');
      rootEl.style.setProperty('--rx', '0deg');
      rootEl.style.setProperty('--ry', '0deg');
    });

    /* --- ④ 按压凹陷 --- */
    rootEl.addEventListener('pointerdown', function () {
      rootEl.classList.add('lg-tilt-pressed', 'lg-pressed');
    });
    const release = function () {
      rootEl.classList.remove('lg-tilt-pressed', 'lg-pressed');
      rootEl.classList.add('lg-tilt');
    };
    rootEl.addEventListener('pointerup', release);
    rootEl.addEventListener('pointerleave', release);

    /* --- ③ 点击涟漪 --- */
    rootEl.addEventListener('pointerdown', function (e) {
      const rect = rootEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const r = document.createElement('span');
      r.className = 'lg-ripple';
      r.style.left = x + 'px';
      r.style.top = y + 'px';
      rootEl.appendChild(r);
      setTimeout(function () { r.remove(); }, 900);
    });

    /* --- ⑤ 划出水痕（节流：每 120ms 一条） --- */
    let lastStreak = 0;
    rootEl.addEventListener('pointermove', function (e) {
      const now = Date.now();
      if (now - lastStreak < 120) return;
      lastStreak = now;
      const rect = rootEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const st = document.createElement('span');
      st.className = 'lg-streak';
      st.style.left = (x - 2) + 'px';
      st.style.top = (y - 30) + 'px';
      st.style.transform = 'rotate(' + ((Math.random() - 0.5) * 10) + 'deg)';
      rootEl.appendChild(st);
      setTimeout(function () { st.remove(); }, 1700);
    });
  }

  /* ============================================================
     <lg-card>  卡片容器（玻璃 + 内容插槽，液态增强 + 鼠标互动）
     属性: scale="0.8-1.2"  按比例收缩
     用法: <lg-card><h3>标题</h3><p>内容</p></lg-card>
     ============================================================ */
  class LgCard extends HTMLElement {
    static get observedAttributes() { return ['scale']; }
    connectedCallback() {
      const sh = this.attachShadow({ mode: 'open' });
      const s = parseFloat(this.getAttribute('scale') || '1');
      sh.innerHTML =
        '<style>' + LG_CSS + '</style>' +
        '<div class="lg-glass lg-card" style="height:100%;--lg-scale:' + s + ';">' +
        '<span class="lg-spotlight" aria-hidden="true"></span>' +
        '<span class="lg-liquid-flow" aria-hidden="true"></span>' +
        '<span class="lg-ripple-edge" aria-hidden="true"></span>' +
        '<span class="lg-droplets" aria-hidden="true">' +
        '  <span class="lg-droplet" style="--x:6%;--y:14%;--s:9px;--d:0s"></span>' +
        '  <span class="lg-droplet" style="--x:22%;--y:64%;--s:7px;--d:1.1s"></span>' +
        '  <span class="lg-droplet" style="--x:38%;--y:28%;--s:11px;--d:2.3s"></span>' +
        '  <span class="lg-droplet" style="--x:56%;--y:76%;--s:6px;--d:0.7s"></span>' +
        '  <span class="lg-droplet" style="--x:74%;--y:20%;--s:8px;--d:3.2s"></span>' +
        '  <span class="lg-droplet" style="--x:90%;--y:58%;--s:10px;--d:1.8s"></span>' +
        '</span>' +
        '<div class="lg-card__body" style="position:relative;z-index:4;"><slot></slot></div>' +
        '</div>';
      attachGlassInteractions(this, sh.querySelector('.lg-card'));
    }
    attributeChangedCallback(name, oldV, newV) {
      if (name === 'scale' && this.shadowRoot) {
        const el = this.shadowRoot.querySelector('.lg-card');
        if (el) el.style.setProperty('--lg-scale', parseFloat(newV || '1'));
      }
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
     属性: label  value  delta  trend="up|down"  scale="0.8-1.2"
     ============================================================ */
  class LgStat extends HTMLElement {
    static get observedAttributes() { return ['scale']; }
    connectedCallback() {
      const trend = this.getAttribute('trend');
      const arrow = trend === 'down' ? '▼' : '▲';
      const trendCls = trend === 'down' ? 'lg-stat__delta--down' : 'lg-stat__delta--up';
      const delta = this.getAttribute('delta');
      const s = parseFloat(this.getAttribute('scale') || '1');
      const sh = this.attachShadow({ mode: 'open' });
      sh.innerHTML =
        '<style>' + LG_CSS + '</style>' +
        '<div class="lg-glass lg-stat" style="--lg-scale:' + s + ';">' +
        '<span class="lg-spotlight" aria-hidden="true"></span>' +
        '<span class="lg-liquid-flow" aria-hidden="true"></span>' +
        '<span class="lg-ripple-edge" aria-hidden="true"></span>' +
        '<span class="lg-stat__label">' + (this.getAttribute('label') || '') + '</span>' +
        '<span class="lg-stat__value">' + (this.getAttribute('value') || '') + '</span>' +
        (delta ? '<span class="lg-stat__delta ' + trendCls + '">' + arrow + ' ' + delta + '</span>' : '') +
        '</div>';
      attachGlassInteractions(this, sh.querySelector('.lg-stat'));
    }
    attributeChangedCallback(name, oldV, newV) {
      if (name === 'scale' && this.shadowRoot) {
        const el = this.shadowRoot.querySelector('.lg-stat');
        if (el) el.style.setProperty('--lg-scale', parseFloat(newV || '1'));
      }
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
     增强层：雨滴 / 全局光栅 / 控制面板
     ============================================================ */

  /* ---------- 追加样式 ---------- */
  LG_CSS += `
/* ===== 雨滴装饰层 (Rain) ===== */
.lg-rain {
  position: absolute; inset: 0;
  pointer-events: none; z-index: 6;
  overflow: hidden; border-radius: inherit;
}
/* 全局模式：覆盖整个视口，雨滴落在所有组件之上 */
.lg-rain.lg-rain--global {
  position: fixed;
  inset: 0;
  z-index: 998;                 /* 高于内容(4)与水滴层，低于滑落层(999) */
  border-radius: 0;
}
.lg-rain.off { display: none; }

/* 凝结水珠 */
.lg-rain .lg-droplets { position: absolute; inset: 0; z-index: 3; }
.lg-rain .lg-droplet { position: absolute; }

/* 滑落雨滴：从顶部滑落，带拖尾 */
.lg-rain .drip {
  position: absolute; top: -14%;
  left: var(--rx, 50%);
  width: var(--rw, 9px);
  height: calc(var(--rw, 9px) * 1.6);
  border-radius: 50% 50% 48% 52% / 62% 62% 38% 38%;
  background:
    radial-gradient(circle at 32% 20%, rgba(255,255,255,0.5), rgba(255,255,255,0.12) 20%, transparent 45%),
    radial-gradient(circle at 68% 85%, rgba(255,255,255,0.16), transparent 35%),
    radial-gradient(circle at 45% 45%, rgba(200,225,255,0.08), rgba(170,200,240,0.04) 55%, rgba(140,175,225,0.06) 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), inset 0 -3px 5px rgba(255,255,255,0.18), 0 2px 3px rgba(0,0,0,0.14);
  opacity: 0;
  animation: rainFall var(--rdur, 5s) cubic-bezier(0.45, 0, 0.8, 1) infinite;
  animation-delay: var(--rdelay, 0s);
}
.lg-rain .drip::after {
  content: "";
  position: absolute; top: 60%; left: 40%;
  width: 12%; height: 70%;
  border-radius: 999px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(255,255,255,0.06));
  filter: blur(0.4px);
}
@keyframes rainFall {
  0%   { top: -14%; transform: scale(0.8, 1); opacity: 0; }
  8%   { opacity: 0.9; }
  82%  { top: 102%; transform: scale(1, 1.3); opacity: 0.65; }
  100% { top: 106%; transform: scale(1, 1.3); opacity: 0; }
}

/* 四边溅水（快速雨滴砸落） */
.lg-rain .dropper { position: absolute; width: 0; height: 0; }
.lg-rain .dropper.d-top    { top: 0; left: var(--drp-x, 30%); }
.lg-rain .dropper.d-bottom { bottom: 0; left: var(--drp-x, 30%); }
.lg-rain .dropper.d-left   { top: var(--drp-y, 40%); left: 0; }
.lg-rain .dropper.d-right  { top: var(--drp-y, 40%); right: 0; }
.lg-rain .drop {
  position: absolute; width: 8px; height: 11px;
  border-radius: 50% 50% 48% 52% / 62% 62% 38% 38%;
  background: radial-gradient(circle at 32% 20%, rgba(255,255,255,0.6), rgba(255,255,255,0.14) 40%, transparent 72%);
  box-shadow: inset 0 -2px 3px rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.12);
  opacity: 0;
  animation-duration: var(--drp-dur, 2s);
  animation-timing-function: cubic-bezier(0.45, 0, 0.8, 1);
  animation-iteration-count: infinite;
  animation-delay: var(--drp-delay, 0s);
}
.lg-rain .dropper.d-top .drop,
.lg-rain .dropper.d-bottom .drop { top: -30px; left: -4px; animation-name: dropFallV; }
.lg-rain .dropper.d-left .drop,
.lg-rain .dropper.d-right .drop { top: -5px; left: -30px; animation-name: dropFallH; }
@keyframes dropFallV {
  0%   { transform: translateY(0); opacity: 0; }
  10%  { opacity: 0.9; }
  70%  { transform: translateY(26px); opacity: 0.9; }
  76%  { transform: translateY(30px) scale(1.45, 0.55); opacity: 0.85; }
  84%  { transform: translateY(30px) scale(1.45, 0.5); opacity: 0; }
  100% { transform: translateY(30px) scale(1.45, 0.5); opacity: 0; }
}
@keyframes dropFallH {
  0%   { transform: translateX(0); opacity: 0; }
  10%  { opacity: 0.9; }
  70%  { transform: translateX(26px); opacity: 0.9; }
  76%  { transform: translateX(30px) scale(0.55, 1.45); opacity: 0.85; }
  84%  { transform: translateX(30px) scale(0.55, 1.45); opacity: 0; }
  100% { transform: translateX(30px) scale(0.55, 1.45); opacity: 0; }
}
.lg-rain .sp {
  position: absolute; width: var(--sp-s, 6px);
  height: calc(var(--sp-s, 6px) * 1.4);
  border-radius: 62% 38% 55% 45% / 68% 62% 38% 32%;
  background: radial-gradient(circle at 30% 22%, rgba(255,255,255,0.75), rgba(255,255,255,0.2) 45%, transparent 75%);
  box-shadow: inset 0 -1px 2px rgba(255,255,255,0.3);
  opacity: 0;
  animation: spBurst var(--drp-dur, 2s) ease-out infinite;
  animation-delay: var(--drp-delay, 0s);
}
.lg-rain .dropper.d-top .sp    { top: 22px; left: 0; }
.lg-rain .dropper.d-bottom .sp { bottom: 22px; left: 0; }
.lg-rain .dropper.d-left .sp   { top: 0; left: 22px; }
.lg-rain .dropper.d-right .sp  { top: 0; right: 22px; }
@keyframes spBurst {
  0%, 70% { transform: translate(0, 0) scale(1); opacity: 0; }
  74%     { opacity: 0.9; }
  90%     { transform: translate(var(--sp-fx, 12px), var(--sp-fy, -26px)) scale(0.4); opacity: 0.45; }
  100%    { transform: translate(calc(var(--sp-fx, 12px) * 1.6), calc(var(--sp-fy, -26px) * 1.35)) scale(0.12); opacity: 0; }
}
@keyframes gratingFlow {
  0%   { background-position: 0 0; }
  100% { background-position: var(--g-period, 120px) 0; }
}

/* ===== 全局整齐光栅 (Grating) =====
   固定在背景层：铺满全屏、位于场景渐变之上、内容之下，
   透过半透明玻璃组件可见，形成"玻璃上的衍射光栅"。 */
.lg-grating {
  position: fixed; inset: 0;
  pointer-events: none; z-index: -1;
  mix-blend-mode: screen;
  opacity: var(--g-opacity, 0.45);
  transition: opacity 0.4s ease;
}
.lg-grating.off { opacity: 0; }

/* ===== 控制面板 (Controls) — 右侧固定侧边栏 ===== */
.lg-controls {
  position: fixed; top: 50%; right: 14px;
  transform: translateY(-50%);
  z-index: 1000;
  width: 224px;
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 4px;
}
.lg-controls__title {
  font-size: 11px; color: rgba(255,255,255,0.6);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 6px;
}
.lg-controls__row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 5px 0;
}
.lg-controls__row + .lg-controls__row { border-top: 1px solid rgba(255,255,255,0.12); }
.lg-controls__row span { font-size: 13px; }
.lg-controls__slider {
  flex: 1;
  -webkit-appearance: none; appearance: none;
  height: 5px; border-radius: 999px;
  background: rgba(255,255,255,0.2);
  border: 1px solid var(--lg-glass-border);
  outline: none;
}
.lg-controls__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 15px; height: 15px; border-radius: 50%;
  background: linear-gradient(135deg, #5ec8ff, #7873f5);
  box-shadow: 0 0 10px rgba(94,200,255,0.6);
  cursor: pointer;
}
.lg-controls__slider::-moz-range-thumb {
  width: 15px; height: 15px; border: 0; border-radius: 50%;
  background: linear-gradient(135deg, #5ec8ff, #7873f5);
  box-shadow: 0 0 10px rgba(94,200,255,0.6);
  cursor: pointer;
}
.lg-controls__value {
  font-size: 11px; color: rgba(255,255,255,0.6);
  min-width: 30px; text-align: right; font-variant-numeric: tabular-nums;
}
`;

  /* ============================================================
     <lg-rain>  雨滴装饰层
     属性: density="3-6"（滑落雨滴数）  global（全局覆盖整个视口）
     用法: <lg-rain density="4"></lg-rain>  （放在容器内）
           <lg-rain global density="6"></lg-rain>  （全局雨滴）
     ============================================================ */
  class LgRain extends HTMLElement {
    connectedCallback() {
      const sh = this.attachShadow({ mode: 'open' });
      const density = Math.max(2, Math.min(8, parseInt(this.getAttribute('density'), 10) || 4));
      const isGlobal = this.hasAttribute('global');
      let html = '<style>' + LG_CSS + '</style><div class="lg-rain' + (isGlobal ? ' lg-rain--global' : '') + '">';

      // 凝结水珠
      html += '<span class="lg-droplets" aria-hidden="true">';
      for (let i = 0; i < 6; i++) {
        html += '<span class="lg-droplet" style="--x:' + (5 + Math.random() * 90).toFixed(0) +
          '%;--y:' + (8 + Math.random() * 80).toFixed(0) +
          '%;--s:' + (6 + Math.random() * 6).toFixed(1) + 'px;--d:' + (Math.random() * 4).toFixed(1) + 's"></span>';
      }
      html += '</span>';

      // 四边溅水
      ['top', 'bottom', 'left', 'right'].forEach(function (edge, ei) {
        html += '<span class="dropper d-' + edge + '" style="--drp-x:' + (15 + Math.random() * 70).toFixed(0) +
          '%;--drp-y:' + (20 + Math.random() * 60).toFixed(0) +
          '%;--drp-delay:' + (ei * 0.6 + Math.random() * 0.5).toFixed(1) +
          's;--drp-dur:' + (1.8 + Math.random() * 1.2).toFixed(1) + 's">' +
          '<i class="drop"></i>' +
          '<i class="sp" style="--sp-s:5px;--sp-fx:14px;--sp-fy:-24px"></i>' +
          '<i class="sp" style="--sp-s:6px;--sp-fx:-16px;--sp-fy:-18px"></i>' +
          '<i class="sp" style="--sp-s:5px;--sp-fx:20px;--sp-fy:-10px"></i>' +
          '</span>';
      });

      // 滑落雨滴
      for (let i = 0; i < density; i++) {
        html += '<span class="drip" style="--rx:' + (8 + i * (80 / density) + Math.random() * 6).toFixed(0) +
          '%;--rw:' + (7 + Math.random() * 6).toFixed(1) +
          'px;--rdur:' + (4 + Math.random() * 4).toFixed(1) +
          's;--rdelay:' + (i * 0.9 + Math.random() * 0.6).toFixed(1) + 's"></span>';
      }
      html += '</div>';
      sh.innerHTML = html;
    }
    setDensity(n) { /* 简化：动态调整由 re-render 完成 */ }
  }

  /* ============================================================
     <lg-grating>  整齐排布光栅（静态）
     属性: count（色带数）  base（色带宽度与间距，均 = base）
           colors="c1,c2,..."  opacity
     用法: <lg-grating count="8" base="7" opacity="0.45"></lg-grating>
     ============================================================ */
  class LgGrating extends HTMLElement {
    connectedCallback() {
      const sh = this.attachShadow({ mode: 'open' });
      sh.innerHTML = '<style>' + LG_CSS + '</style><div class="lg-grating" id="g"></div>';
      this._el = sh.querySelector('#g');
      this._apply();
    }
    _apply() {
      const n = parseInt(this.getAttribute('count') || '8', 10);
      const base = parseFloat(this.getAttribute('base') || '7');
      const op = parseFloat(this.getAttribute('opacity') || '0.45');
      const dir = this.getAttribute('direction') || 'slant';   // slant=斜向 vertical=竖向
      const colors = (this.getAttribute('colors') ||
        '#ff5c7a,#ffa000,#ffeb00,#3cdc78,#28a0ff,#9646ff').split(',');

      // 整齐排布：每条色带宽度 = base，间距 = base，完全均匀
      let stops = [];
      let pos = 0;
      for (let i = 0; i < n; i++) {
        const w = base;
        stops.push(colors[i % colors.length] + ' ' + pos + 'px ' + (pos + w) + 'px');
        pos += w + base;
      }
      // 方向：斜向 115deg / 竖向 90deg（竖向即竖列条纹）
      const angle = dir === 'vertical' ? 90 : 115;
      this._el.style.background = 'linear-gradient(' + angle + 'deg, ' + stops.join(', ') + ')';
      // 静态光栅：无流动动画
      this._el.style.animation = 'none';
      this._el.style.setProperty('--g-opacity', op);
    }
    setDirection(d) { this.setAttribute('direction', d); this._apply(); }
    setOpacity(v) { this._el.style.setProperty('--g-opacity', v); }
    off() { this._el.classList.add('off'); }
    on() { this._el.classList.remove('off'); }
  }

  /* ============================================================
     <lg-controls>  全局效果控制面板（右侧侧边栏）
     派发 lg-control 事件: { detail: { key, value } }
     keys: rain / grating / droplets / spacing / opacity
           direction（斜向/竖向）  scale（组件比例）
     用法: <lg-controls></lg-controls>
     ============================================================ */
  class LgControls extends HTMLElement {
    connectedCallback() {
      const sh = this.attachShadow({ mode: 'open' });
      sh.innerHTML =
        '<style>' + LG_CSS + '</style>' +
        '<div class="lg-glass lg-controls">' +
        '<div class="lg-controls__title">◇ 效果调控</div>' +
        '<div class="lg-controls__row"><span>雨滴</span><div class="lg-switch on" data-k="rain"></div></div>' +
        '<div class="lg-controls__row"><span>光栅</span><div class="lg-switch on" data-k="grating"></div></div>' +
        '<div class="lg-controls__row"><span>凝结水珠</span><div class="lg-switch on" data-k="droplets"></div></div>' +
        '<div class="lg-controls__row"><span>光栅方向</span>' +
        '<button class="lg-btn lg-btn--sm" data-k="direction" style="min-width:74px;">斜向</button></div>' +
        '<div class="lg-controls__row"><span>光栅间距</span>' +
        '<input class="lg-controls__slider" type="range" min="3" max="20" value="7" data-k="spacing">' +
        '<span class="lg-controls__value" data-v="spacing">7</span></div>' +
        '<div class="lg-controls__row"><span>光栅透明度</span>' +
        '<input class="lg-controls__slider" type="range" min="0" max="100" value="45" data-k="opacity">' +
        '<span class="lg-controls__value" data-v="opacity">45</span></div>' +
        '<div class="lg-controls__row"><span>组件比例</span>' +
        '<input class="lg-controls__slider" type="range" min="60" max="120" value="100" data-k="scale">' +
        '<span class="lg-controls__value" data-v="scale">100</span></div>' +
        '</div>';

      const emit = (key, value) => {
        this.dispatchEvent(new CustomEvent('lg-control', { detail: { key, value }, bubbles: true, composed: true }));
      };
      sh.querySelectorAll('.lg-switch').forEach(function (sw) {
        sw.addEventListener('click', function () {
          sw.classList.toggle('on');
          emit(sw.dataset.k, sw.classList.contains('on'));
        });
      });
      // 方向切换按钮：斜向 ↔ 竖向
      const dirBtn = sh.querySelector('[data-k="direction"]');
      if (dirBtn) {
        dirBtn.addEventListener('click', function () {
          const next = dirBtn.textContent.trim() === '斜向' ? 'vertical' : 'slant';
          dirBtn.textContent = next === 'vertical' ? '竖向' : '斜向';
          emit('direction', next);
        });
      }
      sh.querySelectorAll('.lg-controls__slider').forEach(function (sl) {
        sl.addEventListener('input', function () {
          sh.querySelector('[data-v="' + sl.dataset.k + '"]').textContent = sl.value;
          emit(sl.dataset.k, parseFloat(sl.value));
        });
      });
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
    'lg-toast': LgToast,
    'lg-rain': LgRain,
    'lg-grating': LgGrating,
    'lg-controls': LgControls
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
