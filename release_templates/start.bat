@echo off
title 字幕擦除助手一键启动程序
chcp 65001 > nul

echo ====================================================
echo          字幕擦除助手 (Erase Video Subtitle)        
echo ====================================================
echo.

REM 1. 检查环境与配置文件
if not exist config.env (
    echo [错误] 找不到配置文件 config.env，请确保解压了完整压缩包！
    pause
    exit /b
)

REM 2. 读取配置文件中的环境变量
for /f "usebackq delims=" %%i in ("config.env") do (
    echo %%i | findstr /v "^#" > nul && set "%%i"
)

REM 3. 验证关键参数
if "%VOLCENGINE_API_KEY%"=="" (
    echo [警告] 未配置 VOLCENGINE_API_KEY! 
    echo 请先用记事本打开 config.env 配置文件，填入您的火山引擎 API Key。
    echo.
)

if "%CPOLAR_AUTHTOKEN%"=="" (
    echo [错误] 未在 config.env 中配置 CPOLAR_AUTHTOKEN!
    echo 请先用记事本打开 config.env 配置文件，配置您的 Cpolar 凭证。
    echo.
    pause
    exit /b
)

REM 4. 激活并绑定 Cpolar Authtoken
echo [步骤 1/3] 正在激活 Cpolar 内网穿透服务...
cpolar\cpolar.exe authtoken %CPOLAR_AUTHTOKEN% > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [失败] Cpolar 授权码激活失败！请检查网络或者 authtoken 是否填写正确。
    pause
    exit /b
)
echo [成功] Cpolar 授权认证成功。

REM 5. 启动 Next.js 独立服务端
echo [步骤 2/3] 正在启动本地 AI 字幕擦除服务端...
set PORT=3000
start /b node\node.exe app\server.js > nextjs_server.log 2>&1

REM 稍作等待以确保端口启动
timeout /t 2 /nobreak > nul

REM 6. 启动 Cpolar 穿透隧道
echo [步骤 3/3] 正在建立公网穿透隧道 [端口: %PORT%]...
start /b cpolar\cpolar.exe http %PORT% > cpolar.log 2>&1

REM 等待隧道建立
timeout /t 2 /nobreak > nul

echo.
echo ====================================================
echo                  服务已全部成功启动！
echo ====================================================
echo.
echo 🌟 【本地流畅访问地址】: http://localhost:%PORT%
echo 🌟 【公网穿透通道查看】: https://dashboard.cpolar.com/tunnels
echo.
echo 💡 【重要步骤提醒】：
echo 1. 打开您的浏览器，输入本地地址: http://localhost:%PORT% 进入工作台。
echo 2. 登录 https://dashboard.cpolar.com/tunnels 获取本次为您分配的公网 URL。
echo 3. 将公网 URL 复制并填入根目录 config.env 文件的 PUBLIC_URL 中。
echo 4. 在网页工作台上传视频，即可完美进行字幕擦除！
echo.
echo ====================================================
echo 【提示】若要关闭系统，请在此窗口按「任意键」，将自动清理后台。
echo ====================================================
echo.
pause > nul

REM 7. 退出并清理后台运行的 node 和 cpolar 进程
echo.
echo [正在安全关闭服务...]
taskkill /f /im node.exe > nul 2>&1
taskkill /f /im cpolar.exe > nul 2>&1
echo [已全部清理完毕，感谢使用！]
timeout /t 2 > nul
