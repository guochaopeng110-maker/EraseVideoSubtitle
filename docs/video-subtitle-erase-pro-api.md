# 快速体验：一键擦除短剧字幕

本节将通过一个具体的示例，演示如何使用字幕擦除（精细化版）工具，快速实现针对中英文字幕短剧场景的字幕自动检测与擦除。

## 准备工作

1. **获取访问凭证**：在开始之前，访问 AI MediaKit 控制台 API Key 管理页面，创建并获取 AI MediaKit API Key（用于媒体处理功能鉴权）。
2. **准备视频文件**：准备一个待处理的视频文件，并将其上传至公网可访问的服务器或视频点播服务中，以获取可供 API 调用的 URL。

## 操作流程

精细化字幕擦除是一个异步任务，整体流程如下：

1. 成功调用 `POST /api/v1/tools/erase-video-subtitle-pro` 接口提交任务后，您将获得一个唯一的 `task_id`。
2. 您可以轮询 `GET /api/v1/tasks/{task_id}` 接口，直到任务状态 `status` 变为 `completed`；或者使用事件回调自动接收任务状态变化。
3. 任务完成后，解析响应中的 `result` 字段，即可在 `video_url` 字段中获取处理后视频的下载地址。

---

### 第 1 步：提交任务

调用提交字幕擦除（精细化版）任务 API。您可以直接复制以下 cURL 命令，向 API 提交一个字幕擦除任务。

```bash
curl -X POST 'https://mediakit.cn-beijing.volces.com/api/v1/tools/erase-video-subtitle-pro' \
-H 'Authorization: Bearer {Your_API_Key}' \
-H 'Content-Type: application/json' \
-d '{
  "video_url": "https://example.com/your_movie_clip.mp4",
  "mode": "Subtitle"
}'
```

#### 说明

* **需替换参数**：将 `{Your_API_Key}` 替换为您的有效 API Key。
* `-d` 部分是 JSON 请求体，您可以直接修改其中的关键参数来自定义您的视频：
  * `video_url`：替换为您自己的视频文件 URL。
  * `mode`：指定擦除模式为 `Subtitle`，擦除 OCR 检测为字幕的文本。此模式下，系统会自动识别并擦除满足以下条件的字幕：
    * **位置**：位于视频画面下方 50% 以内，且在横向偏中央的位置。
    * **大小**：文字竖向高度在视频高度的 1%～10% 之间。
    * **颜色**：白色。

请求成功后，您会收到如下包含 `task_id` 的响应，请保存此 ID 用于后续查询。

```json
{
  "success": true,
  "task_id": "amk-tool-erase-video-subtitle-pro-123456789",
  "request_id": "20240520203000ABCDEFG12345"
}
```

---

### 第 2 步：获取结果

由于视频处理需要时间，您需要通过轮询查询任务信息 API 来获取最终结果，直到任务状态变为 `completed`。

```bash
curl -X GET 'https://mediakit.cn-beijing.volces.com/api/v1/tasks/{task_id}' \
-H 'Authorization: Bearer {Your_API_Key}'
```

#### 说明

* **需替换参数**：将 URL 末尾的 `{task_id}` 替换为第 1 步返回的任务 ID。

当任务成功完成后，您将收到如下响应。`result` 字段中的 `video_url` 即是处理后视频的下载地址（默认输出为 MP4 格式，有效期为 24 小时）。

```json
{
    "success": true,
    "task_id": "amk-tool-erase-video-subtitle-pro-123456789",
    "task_type": "erase-video-subtitle-pro",
    "status": "completed",
    "result": {
        "video_url": "https://example.volcvideo.com/erased-video.mp4?auth_key=...",
        "duration": 180.5
    },
    "expires_at": 1775047666,
    "created_at": 1774874853,
    "finished_at": 1774874866,
    "request_id": "1742012dcc1938455d84dbe56beb7acc"
}
```
