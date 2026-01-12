# Project Constitution

**Project**: AI Tool Box  
**Constitution Version**: 1.0.0  
**Ratification Date**: 2025-01-27  
**Last Amended Date**: 2025-01-27

## Project Overview

AI Tool Box 是一个前端项目，旨在集成多个主流 AI 工具（ChatGPT、DeepSeek 等），通过统一界面提供便捷的 AI 服务访问。

## Principles

### Principle 1: Minimal Dependencies

**Rule**: 项目必须保持最小化依赖，优先使用浏览器原生 API 和现代 Web 标准。仅在必要时引入第三方库，且必须明确引入理由。

**Rationale**: 减少依赖可以降低项目复杂度、提升加载性能、减少安全风险，并提高项目的可维护性。

### Principle 2: Modern Standards

**Rule**: 代码必须遵循现代 Web 标准（ES6+、HTML5、CSS3），使用语义化 HTML，优先使用 CSS 而非 JavaScript 实现样式和交互。

**Rationale**: 现代标准提供更好的性能、可访问性和浏览器兼容性，同时保持代码简洁易懂。

### Principle 3: Code Quality

**Rule**: 代码必须保持简洁、可读、可维护。使用清晰的命名、适当的注释，避免过度工程化。每个函数/组件应保持单一职责。

**Rationale**: 简洁的代码降低维护成本，提高开发效率，减少 bug 产生。

### Principle 4: Performance First

**Rule**: 必须优先考虑性能：减少 HTTP 请求、优化资源加载、使用懒加载和代码分割。避免不必要的重渲染和 DOM 操作。

**Rationale**: 性能直接影响用户体验，特别是在集成多个 webview 的场景下，性能优化至关重要。

## Governance

### Amendment Procedure

1. 提出修改建议（通过 Issue 或讨论）
2. 团队评审并达成共识
3. 更新 constitution.md 文件
4. 更新版本号（遵循语义化版本）
5. 同步更新相关模板和文档

### Versioning Policy

遵循语义化版本（Semantic Versioning）：

- **MAJOR**: 向后不兼容的原则变更或移除
- **MINOR**: 新增原则或重大指导扩展
- **PATCH**: 澄清、措辞修正、非语义性改进

### Compliance Review

- 所有代码提交前必须符合本规范
- 定期审查项目是否符合原则要求
- 发现违反原则时及时修正

