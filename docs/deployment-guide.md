# 🚀 Subtitle Eraser (视频硬字幕擦除器) 生产环境部署指南

本项目是基于 **Next.js 14 (App Router)** 全栈架构开发的智能硬字幕擦除系统。为保证高并发、大文件上传的稳定性，以及火山引擎 AI 后台能够顺畅地拉取到上传的视频文件，请详细阅读本部署指南。

---

## 📌 部署前必读：核心机制与网络约束

在部署本项目之前，您必须了解以下两个核心机制，这直接决定了您的部署环境选择：

1. **公网可访问的视频源 (Source Video)**
   * **火山引擎 MediaKit 的工作方式**：它是一个**异步 AI 处理引擎**。当您的 Next.js 服务向火山引擎提交字幕擦除任务时，必须传入一个**火山引擎可以通过公网下载到**的视频 URL（即您上传暂存在 `public/uploads/` 下 of the video 公网链接）。
   * **约束条件**：**绝不能传入 `localhost` 或 `127.0.0.1`**。您的服务器必须有公网 IP、公网域名，或者配置了内网穿透（如 Cpolar / Ngrok），并且防火墙需要放行对视频文件的下载请求。
2. **本地临时文件存储与生命周期管理**
   * 本项目默认采用 `LocalDiskStorageAdapter`，文件会上传到服务器本地的 `public/uploads/` 目录中。
   * 服务端后台集成了一个 `CleanupScheduler` 定时器，默认**每隔 15 分钟**自动清理**已满 120 分钟（2小时）**的临时文件，并且在任务结束时会第一时间主动物理删除源视频，防止磁盘溢满。
   * **约束条件**：由于涉及本地磁盘可写性与定时物理删除，**本项目不适合直接一键部署到 Vercel 等 Serverless 只读/临时文件系统平台**。推荐部署在 **云服务器 (VPS)**、**Docker 容器** 或**支持磁盘挂载 (Volume Mount) 的云托管平台 (如 Railway, Render, Fly.io)**。

---

## 🛠️ 关键环境变量一览表

无论您采用何种方式部署，都需要在服务器的环境变量（或根目录 `.env` 文件）中配置以下参数：

| 变量名 | 默认值 | 描述 | 是否必填 |
| :--- | :--- | :--- | :--- |
| `VOLCENGINE_API_KEY` | 无 | 全局默认的火山引擎 MediaKit 密钥。若不填，用户必须在浏览器前端工作台配置个人密钥。 | 可选 (建议配置) |
| `TEMP_FILE_MAX_AGE_MINS` | `120` | 上传视频在服务器本地物理存储的最长时效（分钟）。 | 可选 |
| `CLEANUP_CRON_INTERVAL_MINS` | `15` | 后台 `CleanupScheduler` 扫描并清理过期文件的周期间隔（分钟）。 | 可选 |
| `PUBLIC_URL` | 动态获取 | 显式重写视频公网访问的主机域名，例如 `https://video.yourdomain.com` | 可选 (推荐配置) |
| `NEXT_PUBLIC_FORCE_CPOLAR_URL`| 无 | Cpolar 强制覆盖的本地穿透代理地址（通常为本地内网开发/测试使用）。 | 可选 |

---

## 方案一：云服务器 (VPS) 经典部署 (Node.js + PM2 + Nginx) 🌟【最推荐】

本方案适用于标准的 Linux (Ubuntu / CentOS) 或 Windows 云服务器，是性能最高、最可控的生产部署方案。

### 1. 准备运行环境
在服务器上安装以下基础软件：
* **Node.js**：v18.0.0 或更高版本
* **Git**：用于拉取最新代码
* **Nginx**：用于反向代理与 SSL 安全证书配置
* **PM2**：Node.js 生产进程管理工具（支持进程守护、挂掉自动重启、日志管理）
  ```bash
  npm install -g pm2
  ```

### 2. 拉取代码与依赖安装
```bash
cd /www/wwwroot
git clone <您的仓库地址> EraseVideoSubtitle
cd EraseVideoSubtitle
npm install
```

### 3. 配置环境变量
在项目根目录新建 `.env` 文件：
```env
VOLCENGINE_API_KEY=your_real_volcengine_api_key_here
TEMP_FILE_MAX_AGE_MINS=120
CLEANUP_CRON_INTERVAL_MINS=15
# 如果您的服务器绑定了域名，建议显式配置以下变量：
PUBLIC_URL=https://erase-subtitle.yourdomain.com
```

### 4. 编译打包与 PM2 守护启动
Next.js 14 的 standalone 模式要求首先进行编译：
```bash
# 1. 编译打包
npm run build

# 2. 创建 uploads 目录并确保有写入权限
mkdir -p public/uploads
chmod -R 777 public/uploads

# 3. 使用 PM2 启动服务（通过 npm 间接执行 next start）
pm2 start npm --name "erase-video-subtitle" -- start

# 4. 配置 PM2 自启动与保存状态
pm2 save
pm2 startup
```

### 5. Nginx 反向代理配置（极为重要）
由于 Next.js 部署在 `3000` 端口，且火山引擎需要通过公网反向读取视频，您需要配置 Nginx 将公网域名反向代理至本地 `3000` 端口。

> [!IMPORTANT]
> 火山引擎对大视频的拉取可能会花费数秒至数十秒，且大视频上传需要较大的 Body 限制。请务必在 Nginx 中调大 `client_max_body_size` 限制，并传递真实的代理头部。

创建或修改 Nginx 虚拟主机配置文件：
```nginx
server {
    listen 80;
    server_name erase-subtitle.yourdomain.com; # 您的域名

    # 1. 限制最大上传视频大小 (建议 500M)
    client_max_body_size 500m;

    # 2. 反向代理到 Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # 保持连接
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 传递真实主机名和协议，方便后端自动拼接真实的视频 URL
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # 缓存控制
        proxy_cache_bypass $http_upgrade;
    }
}
```
配置完成后重启 Nginx：
```bash
nginx -t
systemctl reload nginx
```

---

## 方案二：🐳 Docker 容器化一键部署 (Docker + Compose) 🐳【现代云原生】

如果您喜欢 Docker 的隔离环境与一键拉起特性，项目已内置了针对 Next.js 独立输出优化（Standalone Output）的高性能 `Dockerfile` 和 `docker-compose.yml`。

### 1. 极速启动
在服务器上安装完 Docker 与 Docker Compose 后，只需两步：

1. **配置环境变量**：在项目根目录下新建 `.env` 文件，填入所需变量。
2. **一键构建并启动**：
   ```bash
   docker compose up -d --build
   ```

### 2. 挂载持久卷说明
在 `docker-compose.yml` 中，我们已经默认配置了：
```yaml
volumes:
  - ./uploads:/app/public/uploads
```
* **作用**：这会将宿主机当前目录下的 `./uploads` 目录映射到容器内部的 `/app/public/uploads`。
* **优势**：容器重建或重启时，**已上传的视频不会丢失**；同时，宿主机系统管理员可以直接对该目录下的临时文件做空间大小限制或手动排查。

---

## 方案三：轻量级托管平台部署 (Railway / Render / Fly.io)

如果您没有独立的云服务器，也可以将项目推送到 GitHub 并连接至 Railway、Render 等云平台进行一键构建托管。

> [!CAUTION]
> **绝对不能直接默认部署！** 默认部署在这些平台上的临时文件每次发布新版或容器重启时都会被清空，且其临时磁盘不可写可能会导致视频上传直接报 500 写入错误。

### 部署黄金守则：
1. **添加磁盘卷 (Mount Volume)**：
   * 在平台控制面板中，为您部署的服务新建一个磁盘（Volume），例如大小设为 `5GB` 或 `10GB`。
   * 将该磁盘卷挂载（Mount）到容器内的路径：`/app/public/uploads`。
2. **添加环境变量**：
   * 在服务的 Settings -> Variables 中，添加 `VOLCENGINE_API_KEY` 及其他变量。
   * 配置 `PORT` 变量为 `3000`。

---

## 方案四：内网/局域网服务器部署 (Cpolar 穿透 + PM2)

如果您的服务器部署在本地局域网、家用 NAS、办公室内网等**没有公网 IP** 的环境，火山引擎默认是无法拉取到您的视频的。此时可以利用项目内置的 **Cpolar (极点云) 穿透套件** 解决公网访问痛点。

### Windows 内网服务器：
1. 打开 `release_templates/` 目录。
2. 复制 `config.env.example` 并重命名为 `config.env`，填入您的 Cpolar `AUTHTOKEN`：
   ```env
   CPOLAR_AUTHTOKEN=your_cpolar_authtoken_here
   ```
3. 双击运行 `start.bat`。它会自动下载 Cpolar 并创建 `3000` 端口的公网映射。
4. 将生成的公网链接（如 `https://xxxx.cpolar.top`）填入您根目录 `.env` 中的 `NEXT_PUBLIC_FORCE_CPOLAR_URL` 和 `PUBLIC_URL`。
5. 启动 Next.js 生产服务 (`npm run build && pm2 start npm --name "eraser" -- start`)。

### Linux 内网服务器：
1. 访问 [Cpolar 官网](https://www.cpolar.com/) 安装适用于 Linux 的客户端。
2. 运行后台穿透服务并绑定您的凭证。
3. 创建隧道将本地 `3000` 端口暴露，并获取其分配的 HTTPS 公网域名。
4. 将该公网域名配置到您的 `.env` 中的 `PUBLIC_URL` 中，这样后端在上传临时视频后，将自动把视频地址转换为该公网域名下的 URL 发送给火山引擎。

---

## 🛡️ 部署后测试与故障排查 (FAQ)

### 1. 为什么提交任务时火山引擎报错 `Download Failed` 或 `Invalid Video URL`？
* **原因 A：网络隔离**。火山引擎服务器无法访问您的视频链接。请尝试将上传后接口返回的公网 `url` 粘贴到您的手机浏览器或外网网络下，检查是否可以正常下载播放。
* **原因 B：反向代理限流或包体限制**。如果上传视频非常大，Nginx 反向代理可能拦截了请求导致写入失败。请检查 Nginx 错误日志 (`/var/log/nginx/error.log`)，并确保 `client_max_body_size` 足够大（如 `500m`）。
* **原因 C：域名动态拼接错误**。请检查在没有配置 `PUBLIC_URL` 时，Nginx 是否正确传递了转发头。如果使用了特殊的 CDN 或多层代理，强烈建议在 `.env` 中**显式指定** `PUBLIC_URL=https://您的真实公网域名`。

### 2. 本地物理文件清理器 (CleanupScheduler) 在生产环境下是如何运行的？
* `CleanupScheduler` 采用了 **Lazy Initialization (懒加载初始化)** 机制。
* 只要服务器在启动后收到**第一次**视频上传请求（`POST /api/upload`）或擦除任务提交（`POST /api/tasks`），后台定时扫描器就会自动激活，此后将严格以 `CLEANUP_CRON_INTERVAL_MINS` 设定的周期在服务器内存后台无限轮询。
* 定时器状态会常驻于 `globalThis`。PM2 或 Docker 容器能够完美支持其生命周期，无需您在操作系统级别配置额外的 Crontab 定时任务，运维极为简便。

### 3. 如何查看 Next.js 服务日志？
* **PM2 部署**：
   ```bash
   # 查看实时输出日志
   pm2 logs erase-video-subtitle
   # 清理历史日志
   pm2 flush
   ```
* **Docker 部署**：
   ```bash
   docker logs -f erase-video-subtitle
   ```
