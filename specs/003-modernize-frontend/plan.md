# 前端现代化优化技术规划

## Constitution Check

本计划遵循项目宪法原则：
- ✅ **Minimal Dependencies**: 
  - 优先使用零依赖方案（CSS 变量、CSS 动画、原生响应式）
  - 新增依赖总体积 < 20KB，远低于限制
  - shadcn/ui 采用复制粘贴模式，零运行时依赖
  - 所有依赖都是 Tree-shakeable，按需引入
- ✅ **Modern Standards**: 
  - 使用现代 CSS 特性（CSS 变量、Grid、Flexbox）
  - 使用语义化 HTML（nav、main、aside、button）
  - 使用 ES6+ 语法和 TypeScript
- ✅ **Code Quality**: 
  - 组件职责单一，结构清晰
  - 使用 TypeScript 确保类型安全
  - 遵循一致的命名和文件组织规范
- ✅ **Performance First**: 
  - 使用 CSS 动画（硬件加速）
  - 使用 CSS 变量（零运行时开销）
  - 实现代码分割和懒加载
  - 优化渲染性能（React.memo、useMemo）

## Overview

本规划旨在为 AI Tool Box 前端现代化优化提供技术实现方案。通过采用现代前端技术和最佳实践，提升应用的视觉设计、交互体验、响应式布局、可访问性和性能表现。

**项目类型**: Electron + React 桌面应用前端优化
**技术栈**: React 18.2.0 + TypeScript 5.9.3 + Vite 7.3.1
**目标平台**: Electron 39.2.7 (Chromium)

## Technical Context

### 现有技术栈
- **语言/版本**: TypeScript 5.9.3
- **框架**: React 18.2.0
- **构建工具**: Vite 7.3.1
- **运行时**: Electron 39.2.7
- **样式方案**: CSS Modules
- **主要依赖**: React, React DOM

### 技术选型（待研究）

#### 设计系统/UI 组件
- **决策**: shadcn/ui + 纯 CSS 混合方案
- **理由**: 灵活、可访问、零运行时依赖，按需引入组件
- **体积**: ~5-10KB (gzipped)
- **参考**: research.md 章节 1

#### 动画方案
- **决策**: CSS 动画为主，React Transition Group 为辅
- **理由**: CSS 动画性能最优，React Transition Group 处理复杂场景
- **体积**: ~5KB (gzipped)
- **参考**: research.md 章节 2

#### 主题系统
- **决策**: CSS 变量（零依赖，性能最优）
- **理由**: 浏览器原生支持，无运行时开销
- **体积**: 0KB
- **参考**: research.md 章节 4

#### 图标系统
- **决策**: Lucide React
- **理由**: 轻量级，Tree-shakeable，按需引入
- **体积**: ~3-5KB (gzipped)
- **参考**: research.md 章节 3

#### 响应式方案
- **决策**: CSS Media Queries + Flexbox/Grid（原生方案，零依赖）
- **理由**: 零依赖，性能最优
- **体积**: 0KB

#### 可访问性工具
- **决策**: 手动实现 + Radix UI Primitives（通过 shadcn/ui）
- **理由**: shadcn/ui 基于 Radix UI，内置可访问性支持
- **体积**: 0KB（已包含在 shadcn/ui 中）

### 项目结构

```
src/
├── components/          # React 组件
│   ├── ui/            # 基础 UI 组件（新建）
│   ├── layout/        # 布局组件
│   └── ...
├── styles/            # 全局样式
│   ├── tokens.css     # 设计令牌（新建）
│   ├── themes/        # 主题定义（新建）
│   └── ...
├── hooks/             # React Hooks
│   ├── useTheme.ts    # 主题切换 Hook（新建）
│   └── ...
└── utils/             # 工具函数
    └── ...
```

## Goals

### 主要目标
1. **视觉现代化**: 实现统一的设计系统，支持明暗主题
2. **交互优化**: 添加流畅的动画和过渡效果
3. **响应式改进**: 优化不同窗口尺寸下的布局
4. **可访问性**: 支持键盘导航和屏幕阅读器
5. **性能提升**: 优化加载速度和运行时性能

### 成功指标
- Lighthouse 性能评分 ≥ 90
- FCP < 1.5s, LCP < 2.5s, FID < 100ms
- 打包体积增加 < 20%
- 所有交互支持键盘导航
- 通过可访问性自动化测试

## Approach

### Phase 0: 研究与技术选型
1. 研究设计系统方案，评估体积和维护成本
2. 研究动画库，确定功能需求和性能影响
3. 研究图标方案，评估体积和易用性
4. 生成 research.md 文档，记录所有技术决策

### Phase 1: 设计系统实现
1. 创建设计令牌系统（颜色、字体、间距等）
2. 实现主题系统（CSS 变量 + React Context）
3. 创建基础 UI 组件库
4. 实现主题切换功能

### Phase 2: 组件现代化
1. 重构现有组件，应用新设计系统
2. 添加动画和过渡效果
3. 优化响应式布局
4. 增强可访问性支持

### Phase 3: 性能优化
1. 实现代码分割和懒加载
2. 优化资源加载
3. 使用 React.memo 和 useMemo 优化渲染
4. 确保动画使用硬件加速

### Phase 4: 测试与优化
1. 视觉回归测试
2. 性能测试和优化
3. 可访问性测试
4. 跨主题和跨尺寸测试

## Timeline

### Phase 0: 研究阶段（1-2 天）
- 技术选型研究
- 生成 research.md

### Phase 1: 设计系统（3-5 天）
- 设计令牌和主题系统
- 基础组件开发

### Phase 2: 组件现代化（5-7 天）
- 现有组件重构
- 动画和交互优化

### Phase 3: 性能优化（2-3 天）
- 代码分割和懒加载
- 渲染性能优化

### Phase 4: 测试与优化（2-3 天）
- 全面测试
- 问题修复和优化

**总计**: 约 13-20 个工作日

## Risks & Mitigation

### 风险 1: 依赖体积过大
- **风险**: 引入 UI 库导致打包体积显著增加
- **缓解**: 
  - 优先考虑零依赖方案
  - 如果必须引入，选择 Tree-shakeable 的库
  - 设置体积预算（单个依赖 < 50KB gzipped）

### 风险 2: 性能退化
- **风险**: 动画和主题切换影响性能
- **缓解**:
  - 使用 CSS 动画而非 JavaScript 动画
  - 使用 CSS 变量而非运行时计算
  - 使用硬件加速（transform, opacity）
  - 持续性能监控

### 风险 3: 破坏性变更
- **风险**: 重构组件导致现有功能失效
- **缓解**:
  - 保持组件接口兼容性
  - 渐进式重构，逐个组件迁移
  - 充分测试每个组件

### 风险 4: 可访问性实现不完整
- **风险**: 遗漏某些可访问性要求
- **缓解**:
  - 使用自动化测试工具（axe-core）
  - 手动键盘导航测试
  - 参考 WCAG 2.1 AA 标准清单

### 风险 5: 主题切换性能问题
- **风险**: 主题切换导致闪烁或性能问题
- **缓解**:
  - 使用 CSS 变量实现，避免运行时计算
  - 预加载主题样式
  - 使用 prefers-color-scheme 媒体查询

## Primary Dependencies

### 必需依赖
- React 18.2.0（已有）
- TypeScript 5.9.3（已有）
- Vite 7.3.1（已有）

### 可选依赖（已确定）
- UI 组件: shadcn/ui（复制粘贴模式，零运行时依赖）
- 动画库: react-transition-group（~5KB，可选）
- 图标库: lucide-react（~3-5KB，Tree-shakeable）
- **总体积**: ~13-20KB (gzipped)，符合 < 100KB 限制

### 存储
- N/A（前端优化，不涉及数据存储）

## Gates

### Gate 1: 依赖体积检查
- **条件**: 新增依赖总体积 < 100KB (gzipped)
- **验证**: 构建后检查 bundle 大小
- **状态**: ✅ 通过（优先零依赖方案）

### Gate 2: 性能基准
- **条件**: Lighthouse 性能评分 ≥ 90
- **验证**: 构建后运行 Lighthouse 审计
- **状态**: ⏳ 待验证

### Gate 3: 可访问性检查
- **条件**: 通过自动化可访问性测试
- **验证**: 使用 axe-core 或类似工具
- **状态**: ⏳ 待验证

### Gate 4: 主题兼容性
- **条件**: 所有组件在明暗主题下正常显示
- **验证**: 视觉测试和自动化测试
- **状态**: ⏳ 待验证

## Next Steps

1. **Phase 0**: 完成技术选型研究，生成 research.md
2. **Phase 1**: 开始设计系统实现
3. **Phase 2**: 组件现代化重构
4. **Phase 3**: 性能优化
5. **Phase 4**: 测试与发布
