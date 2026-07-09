# WinBrain 前端重设计

现代化的 WinBrain AI 专家工作台前端界面,采用简洁的设计系统和高效的代码结构。

## 📁 项目结构

```
.
├── index.html              # 主页面入口
├── styles/                 # 样式文件
│   ├── variables.css       # 设计令牌(颜色、字体、间距等)
│   ├── components.css      # UI组件样式
│   ├── layouts.css         # 布局样式
│   └── main.css           # 主样式文件(导入所有子样式)
├── scripts/               # JavaScript文件
│   └── app.js            # 应用逻辑
└── DESIGN.md             # 设计系统文档
```

## 🚀 快速开始

### 本地运行

1. 直接在浏览器中打开 `index.html` 文件
2. 或使用本地服务器(推荐):

```bash
# 使用 Python 3
python3 -m http.server 8000

# 然后访问: http://localhost:8000
```

### 浏览器要求

支持现代CSS特性的浏览器:Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## 🎨 核心功能

- **新建对话**: 创建新的AI对话会话
- **历史对话**: 查看和管理历史对话记录
- **配置中心**: 数据源连接和API配置
- **资产管理**: 管理知识资产
- **用量统计**: 查看使用统计数据
- **知识图谱**: 知识图谱可视化和编辑
- **调度中心**: 任务调度管理
- **消息中心**: 通知和消息管理

## 🛠️ 技术栈

- 纯原生 HTML/CSS/JavaScript(无框架依赖)
- CSS变量统一设计令牌
- 模块化CSS文件组织
- ES6+ JavaScript

## 📝 开发说明

### 修改样式

- 设计令牌: 编辑 `styles/variables.css`
- 组件样式: 编辑 `styles/components.css`
- 布局样式: 编辑 `styles/layouts.css`

### 添加新页面

在 `scripts/app.js` 中添加页面配置和渲染逻辑。

详见 [设计系统文档](./DESIGN.md)
