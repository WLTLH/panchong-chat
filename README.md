# 充电采集分析（微信小程序）

现场/售后完成插枪充电测试后，录入**现象观察 + GB/T 27930 CAN 日志**，辅助判断更像桩/车/连接问题，并提供直流流程回放与报文曲线。

> 辅助倾向，**不定责**；不替代官方诊断。

## 打开方式

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入本目录（`project.config.json` 所在目录）
3. AppID：`wxcd66423d545c9f42`（已写入 `project.config.json`）
4. 基础库建议 **2.19+**，打开 ES6 转译

## 主路径怎么点

### 直流 + 日志（核心）

1. **采集** → 选「直流快充」→「填入演示」→「开始分析」
2. 自动进入 **直流流程**，按倍速回放 7 步轨道与停因
3. 切到 **报文曲线**，查看 SOC / 电流幅值|I| / 绝缘状态

演示入口也可在流程页底部：成功 / CEM停 / CST中止。

### 交流 / 仅现象

1. **采集** →「交流慢充」→ 勾选现象 →「开始分析」
2. 进入 **分析结果**：三维倾向、建议、依据

### 专业工具

**工具** tab → 单帧解读 / 报文一览 / 协议说明。

## 工程结构

```
app.js / app.json / app.wxss
utils/
  gbt27930.js      # ID/解析/TP重组/报文库
  bst_cst.js       # BST/CST/BEM/CEM 位域
  state_machine.js # 会话阶段机
  dc_flow.js       # 流程分析 + 实时回放 + 演示日志
  dc_series.js     # 曲线序列
  analyze.js       # 采集评分与路由
pages/             # home / dcflow / dcchart / tools / result / index / catalog / detail / flow
```

## 约定摘要

- 全量解析，禁止跳帧；UI 可降采样
- BMS SA：`0xF4` / `0xF5`
- 电流 UI：幅值 `|I|`
- 绝缘：仅状态线，不编造 kΩ
