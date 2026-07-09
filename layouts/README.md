# WinBrain 布局系统

现代化的布局系统，基于旧设计优化改进。

## 📁 文件结构

```
layouts/
├── shell.css           # 主容器布局
├── sidebar.css         # 侧边栏布局
├── content.css         # 内容区域布局
├── grid.css            # 网格系统
├── responsive.css      # 响应式规则
├── layout-demo.html    # 演示页面
└── README.md           # 使用文档
```

## 🚀 快速开始

### 引入样式

```html
<!-- 按顺序引入布局样式 -->
<link rel="stylesheet" href="layouts/shell.css">
<link rel="stylesheet" href="layouts/sidebar.css">
<link rel="stylesheet" href="layouts/content.css">
<link rel="stylesheet" href="layouts/grid.css">
<link rel="stylesheet" href="layouts/responsive.css">
```

### 基础结构

```html
<div class="shell">
  <aside class="sidebar">
    <!-- 侧边栏内容 -->
  </aside>
  <main class="main">
    <section class="stage">
      <header class="topbar">
        <!-- 顶部栏 -->
      </header>
      <div class="content">
        <!-- 主内容 -->
      </div>
      <footer class="bottom-nav">
        <!-- 底部导航 -->
      </footer>
    </section>
  </main>
</div>
```

## 📦 组件说明

### Shell（主容器）

应用的顶层容器，使用 Flexbox 横向布局。

```css
.shell {
  height: 100%;
  display: flex;
  overflow: hidden;
}
```

**特性：**
- 全屏高度
- 渐变背景
- 支持侧边栏 + 主内容区域布局

### Sidebar（侧边栏）

可折叠的侧边栏导航。

```html
<aside class="sidebar" id="sidebar">
  <div class="brand">
    <img src="logo.png" alt="Logo">
    <div class="brand-title">应用名称</div>
    <button class="collapse-btn">⌜</button>
  </div>
  <nav class="nav">
    <!-- 导航项 -->
  </nav>
  <div class="footer">
    <!-- 底部区域 -->
  </div>
</aside>
```

**CSS 变量：**
- `--sidebar-width`: 234px（展开宽度）
- `--sidebar-collapsed-width`: 64px（折叠宽度）
- `--sidebar-transition`: 0.25s（过渡动画）

**折叠功能：**
```javascript
sidebar.classList.toggle('collapsed');
```

**移动端：**
- 绝对定位，默认隐藏（transform: translateX(-100%)）
- 添加 `.mobile-open` 类显示

### Content（内容区域）

主内容容器，自动居中，最大宽度限制。

```html
<div class="content">
  <!-- 内容 -->
</div>

<!-- 宽内容模式（无最大宽度限制） -->
<div class="content wide">
  <!-- 内容 -->
</div>
```

**CSS 变量：**
- `--content-max-width`: 1120px
- `--content-padding`: 24px

### Topbar（顶部栏）

Sticky 定位的顶部栏，玻璃态效果。

```html
<header class="topbar">
  <div class="top-inner">
    <nav class="crumb">
      <span>首页</span>
      <span>/</span>
      <b>当前页</b>
    </nav>
    <div class="title-row">
      <div class="title">
        <h1>页面标题</h1>
        <p>页面描述</p>
      </div>
    </div>
  </div>
</header>
```

### Grid（网格系统）

灵活的网格布局系统。

```html
<!-- 两列网格 -->
<div class="grid two">
  <div>列 1</div>
  <div>列 2</div>
</div>

<!-- 三列网格 -->
<div class="grid three">
  <div>列 1</div>
  <div>列 2</div>
  <div>列 3</div>
</div>

<!-- 自定义列数 -->
<div class="grid four">
  <div>列 1</div>
  <div>列 2</div>
  <div>列 3</div>
  <div>列 4</div>
</div>
```

**间距变体：**
```html
<div class="grid two gap-sm">  <!-- 小间距 -->
<div class="grid two gap-lg">  <!-- 大间距 -->
<div class="grid two gap-none"> <!-- 无间距 -->
```

**非对称布局：**
```html
<div class="grid thirds">         <!-- 1:2 比例 -->
<div class="grid thirds-reverse">  <!-- 2:1 比例 -->
<div class="grid sidebar-layout">  <!-- 280px + 1fr -->
<div class="grid content-sidebar">  <!-- 1fr + 320px -->
```

## 📱 响应式设计

### 断点定义

```css
--breakpoint-xs: 480px   /* 超小屏幕 */
--breakpoint-sm: 640px   /* 小屏幕 */
--breakpoint-md: 768px   /* 中等屏幕 */
--breakpoint-lg: 960px   /* 大屏幕 */
--breakpoint-xl: 1280px  /* 超大屏幕 */
```

### 响应式行为

**侧边栏：**
- `> 960px`: 固定宽度，可折叠
- `≤ 960px`: 绝对定位，默认隐藏

**网格系统：**
- `> 960px`: 多列布局
- `≤ 960px`: 单列布局

**内容区域：**
- `> 960px`: padding 24px
- `≤ 960px`: padding 16px
- `≤ 640px`: padding 12px

### 工具类

```html
<!-- 响应式隐藏 -->
<div class="hide-xs">  <!-- 在超小屏幕隐藏 -->
<div class="hide-sm">  <!-- 在小屏幕隐藏 -->
<div class="hide-md">  <!-- 在中等屏幕隐藏 -->
<div class="hide-lg">  <!-- 在大屏幕隐藏 -->

<!-- 显示（仅超大屏幕） -->
<div class="show-xl">  <!-- 仅在超大屏幕显示 -->
```

## ♿ 可访问性

### ARIA 标签

```html
<!-- 侧边栏 -->
<aside class="sidebar" aria-label="主导航">

<!-- 折叠按钮 -->
<button class="collapse-btn" 
        aria-label="折叠侧边栏" 
        aria-expanded="true">

<!-- 导航 -->
<nav class="nav" aria-label="主导航菜单">

<!-- 面包屑 -->
<nav class="crumb" aria-label="面包屑导航">
```

### 键盘导航

- 所有交互元素支持 Tab 键导航
- 按钮支持 Enter 和 Space 键激活
- 侧边栏导航项支持方向键导航

### 减少动画偏好

系统会自动检测用户的动画偏好：

```css
@media (prefers-reduced-motion: reduce) {
  /* 动画被禁用或大幅减少 */
}
```

## 🎨 自定义主题

### CSS 变量覆盖

```css
:root {
  /* 侧边栏 */
  --sidebar-width: 280px;           /* 自定义宽度 */
  --sidebar-bg: rgba(0, 0, 0, 0.9); /* 自定义背景 */
  
  /* 内容区域 */
  --content-max-width: 1280px;      /* 自定义最大宽度 */
  --content-padding: 32px;          /* 自定义内边距 */
  
  /* 网格 */
  --grid-gap: 24px;                 /* 自定义间距 */
}
```

## 🔧 浏览器支持

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

需要的 CSS 特性：
- CSS Grid
- Flexbox
- CSS Variables
- backdrop-filter

## 📝 注意事项

1. **引入顺序**：必须按照 shell → sidebar → content → grid → responsive 的顺序引入
2. **移动端侧边栏**：需要 JavaScript 配合处理 `.mobile-open` 类的切换
3. **打印样式**：已内置打印优化，侧边栏和装饰性元素会自动隐藏
4. **性能**：使用 CSS Grid 和 Flexbox，避免 JavaScript 计算

## 🚧 已知限制

1. 暗色模式尚未实现（预留了 media query）
2. 侧边栏折叠动画在某些旧版浏览器可能不流畅
3. backdrop-filter 在 Firefox 旧版本需要手动开启

## 📚 相关资源

- [CSS Grid 布局](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Grid_Layout)
- [Flexbox 布局](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Flexible_Box_Layout)
- [WCAG 2.1 可访问性指南](https://www.w3.org/WAI/WCAG21/quickref/)

## 🔄 版本历史

### v1.0.0 (2026-07-09)
- ✨ 初始版本
- 🎨 基于旧设计优化改进
- 📱 完整的响应式支持
- ♿ 可访问性优化
