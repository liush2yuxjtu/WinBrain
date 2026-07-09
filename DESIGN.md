# WinBrain 设计系统文档

本文档定义了 WinBrain 前端的设计令牌、组件规范和使用指南。

## 设计令牌 (Design Tokens)

所有设计令牌定义在 `styles/variables.css` 中,使用 CSS 自定义属性(CSS Variables)。

### 颜色系统

#### 主色调
- `--color-primary-500`: #6366f1 (靛蓝)
- `--color-primary-600`: #8b5cf6 (紫色)
- `--color-primary-gradient`: 主色渐变

#### 语义色
- `--color-success-500/600`: 成功/确认(绿色)
- `--color-danger-500/600`: 危险/错误(红色)
- `--color-gray-*`: 中性色阶(50-900)

#### 背景色
- `--color-bg-white`: 纯白
- `--color-bg-light`: 浅色背景
- `--bg-gradient-shell`: 壳层渐变

### 字体系统

#### 字体族
- `--font-family-base`: 系统字体栈
- `--font-family-mono`: 等宽字体

#### 字号
- `--font-size-xs`: 11px
- `--font-size-sm`: 12px  
- `--font-size-base`: 13px (默认)
- `--font-size-md`: 14px
- `--font-size-lg`: 16px
- `--font-size-xl`: 18px
- `--font-size-2xl`: 24px
- `--font-size-3xl`: 32px

#### 字重
- `--font-weight-normal`: 400
- `--font-weight-medium`: 500
- `--font-weight-semibold`: 600
- `--font-weight-bold`: 700

### 间距系统

基于 4px 网格:
- `--spacing-1`: 4px
- `--spacing-2`: 8px
- `--spacing-3`: 12px
- `--spacing-4`: 16px
- `--spacing-6`: 24px
- `--spacing-8`: 32px
- `--spacing-12`: 48px

### 圆角系统

- `--radius-sm`: 6px
- `--radius-base`: 8px
- `--radius-md`: 10px (常用)
- `--radius-lg`: 12px
- `--radius-xl`: 16px
- `--radius-full`: 9999px (圆形)

### 阴影系统

- `--shadow-sm`: 轻微阴影
- `--shadow-base`: 基础阴影
- `--shadow-md`: 中等阴影
- `--shadow-lg`: 深度阴影
- `--shadow-primary/success/danger`: 彩色阴影

## 组件规范

### 按钮 (.btn)

基础样式:
```html
<button class="btn">默认按钮</button>
```

变体:
- `.btn.primary` - 主要操作
- `.btn.green` - 成功/确认
- `.btn.danger` - 危险/删除
- `.btn.ghost` - 轻量/次要

状态:
- `:hover` - 悬停效果
- `:active` - 点击效果
- `:disabled` - 禁用状态

### 卡片 (.card)

结构:
```html
<div class="card">
  <div class="card-head">
    <div class="card-title">
      <span class="icon-box">图标</span>
      <div>
        <h3>标题</h3>
        <p>描述</p>
      </div>
    </div>
  </div>
  <div class="card-body">
    内容
  </div>
</div>
```

### 表单控件

- `.input` - 文本输入框
- `.textarea` - 多行文本
- `.dropzone` - 文件拖放区
- `.option` / `.option-grid` - 选项卡片

### 导航项 (.nav-item)

用于侧边栏导航:
```html
<button class="nav-item active">
  <span>图标</span>
  <span>标签</span>
</button>
```

状态:
- `.active` - 激活状态
- `:hover` - 悬停效果

### 模态框

结构:
```html
<div class="modal-backdrop show">
  <div class="modal">
    <div class="modal-head">头部</div>
    <div class="modal-body">内容</div>
  </div>
</div>
```

### 徽章 (.badge)

变体:
- 默认(靛蓝)
- `.badge.green` - 绿色
- `.badge.gray` - 灰色  
- `.badge.amber` - 琥珀色

## 布局系统

### 主容器 (.shell)

全屏容器,flexbox 横向布局。

### 侧边栏 (.sidebar)

- 固定宽度: `--sidebar-width` (234px)
- 折叠宽度: `--sidebar-collapsed-width` (64px)
- 玻璃态效果: backdrop-filter
- 可折叠: `.collapsed`

### 内容区 (.main)

- flex: 1 占据剩余空间
- 包含 `.stage` 容器

### 顶部栏 (.topbar)

- sticky 定位
- 包含面包屑导航(.crumb)和标题行(.title-row)

### 内容容器 (.content)

- 最大宽度: `--content-max-width` (1200px)
- 居中对齐
- `.wide` 修饰符移除最大宽度限制

## 响应式设计

### 断点

- 移动端: `max-width: 960px`
- 小屏: `max-width: 640px`

### 移动端适配

- 侧边栏绝对定位,默认隐藏
- 网格布局改为单列
- 减小内边距和字号
- 隐藏次要元素

## 实用工具类

### 间距
- `.mt-*` / `.mb-*`: 上/下外边距
- `.p-*`: 内边距

### 文本
- `.text-center/right`: 对齐
- `.text-sm/base/lg/xl`: 字号
- `.font-medium/semibold/bold`: 字重

### 布局
- `.flex` / `.inline-flex`: Flexbox
- `.items-center/start/end`: 对齐
- `.justify-center/between/end`: 主轴对齐
- `.gap-*`: 间距

### 显示
- `.hidden` / `.block`: 显示控制
- `.w-full` / `.h-full`: 100%宽高

## 最佳实践

1. **优先使用设计令牌**: 避免硬编码颜色和尺寸值
2. **语义化类名**: 使用描述性的类名
3. **模块化组织**: 将相关样式组织在一起
4. **响应式优先**: 考虑不同屏幕尺寸
5. **可访问性**: 使用语义化 HTML 和 ARIA 属性

## 待完善

- 深色主题支持
- 动画规范
- 图标系统
- 加载状态组件
- 错误状态处理
