`POST https://mediakit.cn-beijing.volces.com/api/v1/tools/erase-video-subtitle`

本接口用于提交一个异步的字幕擦除（标准版）任务，智能检测并擦除视频画面中已有的硬字幕，保留原始背景。


* **获取任务结果**：任务提交成功后，您需要保存返回的 `task_id`，并通过轮询查询任务信息 API或配置事件回调获取最终结果。

* **开发指南**：如需了解完整的使用流程和应用示例，请参阅[字幕擦除](https://www.volcengine.com/docs/6448/2371372)。


## 请求参数

### Header 参数


|参数 |类型 |是否必选 |示例值 |描述 |
|---|---|---|---|---|
|`Authorization` |String |是 |`Bearer {Your_API_Key}` |格式为 `Bearer {Your_API_Key}`。请参考[基础概念及准备工作](https://www.volcengine.com/docs/6448/2300661)获取 API Key。 |



### Body 参数


|参数 |类型 |是否必选 |示例值 |描述 |
|---|---|---|---|---|
|`video_url` |String |是 |`https://example.com/video.mp4` |待擦除字幕的视频 URL。<br><br><br>* **视频来源**：仅支持公网可访问的 HTTP/HTTPS URL。<br><br>* **支持格式**：`mp4`, `flv`, `ts`, `avi`, `mov`, `wmv`, `mkv` 等主流视频格式。<br><br>* **输入分辨率限制**：最高支持 2K 分辨率。<br><br>* **输出分辨率**：最高支持 1080P。 |
|`client_token` |String |否 |`your_unique_request_id_137` |用户请求凭证，用于幂等控制。大小写敏感，不超过 64 个 ASCII 码可打印字符。详情请参考[幂等性控制](https://www.volcengine.com/docs/6448/2300661#672adae7)。 |
|`callback_args` |String |否 |`your_custom_callback_args` |自定义回调参数。您提供的内容将在任务完成时，通过[事件回调](https://www.volcengine.com/docs/6448/2288701)原样返回，方便您关联业务。字段长度最大为 512 字节。 |


## 请求示例

```Bash
curl -X POST 'https://mediakit.cn-beijing.volces.com/api/v1/tools/erase-video-subtitle' \
-H 'Authorization: Bearer {Your_API_Key}' \
-H 'Content-Type: application/json' \
-d '{
  "video_url": "https://example.com/source_video.mp4"
}'
```

## 响应说明

### 任务提交成功响应

任务提交成功后，接口会立即返回以下 JSON 对象。


|参数 |类型 |描述 |
|---|---|---|
|`success` |Boolean |任务是否提交成功。<br><br><br>* `true`：成功。<br><br>* `false`：失败。更多信息请查看下文的[错误处理](https://www.volcengine.com/docs/6448/2386125#Em0W57ObZH)。 |
|`task_id` |String |任务的唯一标识，用于后续查询任务进度和结果。 |
|`request_id` |String |本次请求的唯一标识，可用于问题排查。 |


示例：

```JSON
{
  "success": true,
  "task_id": "amk-tool-erase-video-subtitle-123456789",
  "request_id": "20240521140000ABCDEFG12345"
}
```

### 异步任务结果

任务处理完成后，通过[查询任务信息 API](https://www.volcengine.com/docs/6448/2278532) 或[事件回调](https://www.volcengine.com/docs/6448/2288701)获取的 `result` 字段将包含以下内容。


|参数 |类型 |示例值 |描述 |
|---|---|---|---|
|`video_url` |String |`https://example.volcvideo.com/output.mp4?auth_key=...` |擦除字幕后的视频文件下载地址。该地址的有效期为 **24 小时**，请务必及时保存产物。输出视频为 MP4 格式。 |
|`duration` |Number |`180.5` |输出视频的总时长（单位：秒）。 |


最终的完整任务信息示例：

```JSON
{
    "success": true,
    "task_id": "amk-tool-erase-video-subtitle-123456789",
    "result": { 
        "video_url": "https://example.volcvideo.com/output.mp4?auth_key=...",
        "duration": 180.5
    },
    "expires_at": 1777464650,
    "created_at": 1777291767,
    "finished_at": 1777291851,
    "request_id": "202604272009269BA43D771246AFF513F0"
}
```

## 错误处理

当请求的参数或鉴权信息不正确时，任务将不会被创建，接口会返回一个同步的错误响应。详见[错误码](https://www.volcengine.com/docs/6448/2300662)。示例如下：

```JSON
{
  "success": false,
  "task_id": "",
  "request_id": "20240521140500XYZW12345",
  "error": {
    "code": "InvalidParameter",
    "message": "The parameter `video_url` is required.",
    "param": "video_url",
    "type": "BadRequest"
  }
}
```