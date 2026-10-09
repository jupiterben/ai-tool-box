# DeepSeek TUI 接入 Agent CLI 页

日期：2026-08-10  
状态：已批准  

## 目标

在 Agent CLI 独立页新增 DeepSeek TUI（[Hghrry/DeepSeek-TUI](https://github.com/Hghrry/DeepSeek-TUI) / npm `deepseek-tui`），行为与现有 npm 包型 CLI（Claude、Gemini 等）一致。

## 行为

- `AgentCliId` 增加 `deepseek`。
- 目录项：`name=DeepSeek TUI`，`command=deepseek`，`packageName=deepseek-tui`。
- 安装/升级：`npm install --global deepseek-tui`。
- 检测：`deepseek --version`；最新版：`npm view deepseek-tui version`。
- 配置字段与保存路径不变（`agent-cli-settings.json`）。
- 卡片品牌缩写 `DS`，深蓝 logo 色；页头说明补充 DeepSeek。

## 非目标

- 不改 IPC / 启动 Agent 逻辑。
- 不使用脚本安装器。
- 不写入 `~/.deepseek/config.toml`（仍用本机统一 Agent CLI 配置）。
