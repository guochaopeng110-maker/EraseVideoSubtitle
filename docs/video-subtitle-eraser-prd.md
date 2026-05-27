# Product Requirements Document (PRD): Subtitle Eraser (字幕擦除器)

## Problem Statement

对于视频内容创作者、搬运者或翻译人员而言，视频中的硬字幕（Hard Subtitles）往往会限制视频的二次分发与多平台复用。现有的字幕去除工具大多面临两个问题：要么操作复杂、处理质量低（产生严重的背景模糊或残留），要么在集成第三方 AI API 时存在安全隐患（如直接在前端暴露用户的 API Key）。此外，用户在上传大文件视频时，往往因缺乏明确的上传进度、异步任务的处理状态和直观的效果对比，而导致用户体验欠佳。

## Solution

构建一个基于 Next.js 的全栈式 **Subtitle Eraser**（字幕擦除）Web 应用。该应用通过安全的后端 Proxy 代理对接火山引擎 MediaKit 字幕擦除 API，实现高质量的视频硬字幕消除，保留原始背景。

前端采用极具视觉冲击力的**暗黑霓虹玻璃拟态（Glow and Glassmorphism Dark Mode）**仪表盘设计，提供拖拽上传、URL 粘贴、**渐进式轮询（Status Polling）**、双播放器前后效果对比以及本地**任务历史记录**。

系统支持完整的 **Mock Mode**，允许在不配置/调用真实付费 API 的情况下模拟完整的字幕擦除链路，方便本地调试、展示和快速迭代。

---

## User Stories

1.  **As a** 视频创作者, **I want to** 直接将本地视频文件拖入网页的上传区域或粘贴公网视频 URL, **so that** 我能极其便捷地提交 **Source Video**。
2.  **As a** 网速较慢的用户, **I want to** 在上传本地视频时看到清晰的百分比进度条, **so that** 我知道视频传输正在正常进行。
3.  **As a** 开发者/演示人员, **I want to** 在页面上随时一键切换 **Mock Mode** 开关, **so that** 我能免配置、零成本地演示和测试整个系统的交互流程。
4.  **As a** 注重隐私的安全意识高的用户, **I want to** 能够在前端输入并绑定我自己的火山引擎 API Key，且该 Key 仅保存在我本地浏览器（或临时通过安全代理请求传输）, **so that** 我的私密凭证不会泄露给第三方。
5.  **As a** 正在等待处理的创作者, **I want to** 看到一个逐步亮起的 AI 处理步骤清单（例如：“正在接收视频”、“正在初始化擦除任务”、“AI 正在检测字幕”、“正在消除字幕并融合背景”、“生成产物视频中”）, **so that** 我能对当前 **Erase Task** 的 AI 流水线状态一目了然。
6.  **As a** 系统管理员, **I want** 客户端在状态轮询（**Status Polling**）时采用渐进式退避算法（随着耗时增长，降低轮询频率）, **so that** 能极大减轻服务器负担，避免频繁请求火山引擎 API 而触发限流。
7.  **As a** 经常处理多视频的创作者, **I want to** 在侧边栏看到我的 **Erase Task** 任务历史列表，并带有状态标签（如“上传中”、“处理中”、“已完成”、“失败”）, **so that** 我能同时监控和管理多个擦除任务。
8.  **As a** 经常刷新网页的创作者, **I want** 我的任务历史记录能够保存在本地浏览器的 `localStorage` 中, **so that** 即使我刷新页面或关闭浏览器，历史处理任务和下载链接依然存在。
9.  **As a** 视觉质量审查人员, **I want to** 在任务完成后看到左右分屏的双播放器，或者通过滑动条对比 **Source Video** 与 **Cleaned Video**, **so that** 我能直观清晰地对比并确认字幕擦除效果。
10. **As a** 创作者, **I want to** 在结果区域看到火山引擎产物的 24 小时过期警告, **so that** 我能记得及时下载保留最终的 **Cleaned Video**。
11. **As a** 服务器运营商, **I want** 上传到服务器本地磁盘的临时视频文件在任务结束时（或在配置的 2 小时过期时间后）被自动清理, **so that** 服务器磁盘空间永远不会被占满。
12. **As a** 追求极简与美感的用户, **I want** 整个界面呈现高端的暗黑霓虹风格，并带有磨砂玻璃模糊和柔和的发光微交互, **so that** 整个工具使用起来感觉非常专业和奢华。

---

## Implementation Decisions

### 1. 核心深度模块划分与接口设计

为保证系统高内聚、易测试，我们将核心业务解耦为以下四个深层模块（Deep Modules）：

*   **`StorageAdapter` (存储模块接口)**
    *   *描述*：抽象视频存储。本地环境下实现为 `LocalDiskStorageAdapter`，将文件存放在 `public/uploads/` 目录，并返回相对于当前域名的可访问 URL 作为 API 所需的 **Source Video**。
    *   *未来扩展*：可通过修改环境变量无缝扩展至 S3 或 阿里云 OSS 适配器。
*   **`VolcengineClient` (第三方 API 封装客户端)**
    *   *描述*：负责火山引擎 API 鉴权头处理，构造 `POST /api/v1/tools/erase-video-subtitle` 请求和查询响应转换。
    *   *Mock 模式支持*：当系统处于 **Mock Mode** 时，此客户端会自动切换至 `MockVolcengineClient`，采用基于正态分布时间的伪随机定时器生成逼真的 AI 处理节点与任务进度，不产生任何真实网络请求。
*   **`PollingEngine` (渐进式状态轮询器)**
    *   *描述*：实现客户端轮询 API 状态时的自适应时间退避算法：
        *   运行前 30 秒：每 5 秒轮询一次。
        *   30 秒至 120 秒：每 8 秒轮询一次。
        *   超过 120 秒：每 12 秒轮询一次。
*   **`CleanupScheduler` (到期文件清理器)**
    *   *描述*：一个独立的生命周期任务或定时器，读取 `.env` 配置的 `TEMP_FILE_MAX_AGE_MINS` (默认 120 分钟)，每隔 `CLEANUP_CRON_INTERVAL_MINS` (默认 15 分钟) 自动扫描并强制删除过期的临时上传文件。任务最终完成（成功或失败）被客户端查询确认时，也会立刻触发该文件的清理。

### 2. 全栈 API 代理契约

为了彻底防范 API 凭证泄露，所有火山引擎的请求必须经由 Next.js 服务端 Route Handler 进行代理。

*   `POST /api/upload`
    *   *输入*：Multipart 视频文件表单。
    *   *输出*：`{ success: true, url: string, filename: string }`
*   `POST /api/tasks`
    *   *输入*：`{ video_url: string, mockMode: boolean }`
    *   *Header*：可选 `X-Volcengine-Key`（如用户使用自己绑定的 API Key）。
    *   *输出*：`{ success: true, task_id: string }`
*   `GET /api/tasks/[id]`
    *   *输入*：`id` (任务唯一标识)，`mockMode` (是否为 Mock 模式)。
    *   *输出*：符合火山引擎返回结构的 JSON（当成功时返回带有 `video_url` 的 **Cleaned Video** 和时长）。

---

## Testing Decisions

### 1. 好的测试标准
好的测试应当只测试外部行为，而不测试内部实现细节。例如：测试“当视频上传并触发擦除任务失败时，本地关联的 Source Video 文件应当被自动删除”，而不是测试“内部是否调用了 fs.unlink 或是 storageAdapter.delete”。

### 2. 核心模块测试规划
我们将使用 Vitest 对以下模块进行 100% 行为覆盖的单元/集成测试：
*   `PollingEngine`：测试随着时间累加，轮询器返回的下一次等待时间是否精确地在 5s、8s、12s 之间自动调整。
*   `VolcengineClient`：在 `Mock Mode` 下，模拟提交任务、轮询中、成功和超时错误等各种边缘状态，确保 API 状态转化无误。
*   `CleanupScheduler`：模拟文件写入时间，触发清理逻辑，验证超期文件被安全物理清除，而未超期文件保持完好。

---

## Out of Scope

*   **多用户账号与统一后台数据库**：本应用为轻量级免登录的全栈工具，任务历史记录全部安全持久化在用户本地浏览器的 `localStorage` 中，服务端不维持用户任务数据库。
*   **视频编辑与裁剪**：不提供视频上传前的在线裁剪、拼贴或静音等通用编辑操作，仅负责字幕擦除这一核心 AI 任务。
*   **Cleaned Video 产物的永久托管**：由于火山引擎产物链接具有 24 小时过期限制，本系统不提供产物的永久托管或转存。用户必须在 24 小时内自行下载。
*   **多语言字幕翻译**：本系统仅负责擦除硬字幕还原背景，不提供字幕翻译或自动压制新字幕的功能。

---

## Further Notes

*   **UI 视觉还原度**：前端实现必须严格还原 ADR-0004 中所描述的 Glow & Glassmorphism 现代霓虹暗黑主题，重点在于侧边栏、拖拽区的高级毛玻璃动效，以及提交任务后环形发光进度条的微交互动画。
