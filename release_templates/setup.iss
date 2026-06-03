; ====================================================
;   字幕擦除助手 Inno Setup 打包脚本 (setup.iss)
; ====================================================

#define MyAppName "字幕擦除助手"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "EraseVideoSubtitle Team"
#define MyAppURL "https://github.com/guochaopeng110/EraseVideoSubtitle"
#define MyAppExeName "start_uac.bat"

[Setup]
; 唯一AppID，用于升级和卸载识别
AppId={{D37F6C2A-4FBE-4C8D-A8C5-5D0BE9A841F9}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes

; 【优化】：生成安装包的输出目录设置为当前脚本同级目录（即直接生成在 EraseSubtitle 目录下）
OutputDir=.
OutputBaseFilename=EraseVideoSubtitle_Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
; 使用 Default.isl 作为默认语言文件，保证在任何电脑上都能 100% 编译成功而不会报“找不到语言文件”的错误
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; 【优化】：因为 setup.iss 在 EraseSubtitle 目录下运行，采用“精准白名单导入”
; 这样可以完美避开导入 setup.iss 自身和生成的安装包 .exe 文件，防止无限递归打包的严重 Bug
Source: "app\*"; DestDir: "{app}\app"; Flags: recursesubdirs createallsubdirs
Source: "cpolar\*"; DestDir: "{app}\cpolar"; Flags: recursesubdirs createallsubdirs
Source: "node\*"; DestDir: "{app}\node"; Flags: recursesubdirs createallsubdirs
Source: "config.env"; DestDir: "{app}"; Flags: ignoreversion
Source: "start_uac.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; 创建开始菜单快捷方式
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\node\node.exe"
; 创建桌面快捷方式
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon; IconFilename: "{app}\node\node.exe"
; 创建卸载程序的快捷方式
Name: "{group}\卸载{#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; 安装完成后，自动打开配置文件供用户编辑密钥
Filename: "notepad.exe"; Parameters: "{app}\config.env"; Description: "立即编辑 config.env 配置文件（填入密钥与穿透凭证）"; Flags: postinstall shellexec skipifsilent

[UninstallRun]
; 卸载时强杀可能残留的后台进程，防止文件占用导致卸载不干净
Filename: "taskkill"; Parameters: "/f /im node.exe"; RunOnceId: "KillNode"; Flags: runhidden
Filename: "taskkill"; Parameters: "/f /im cpolar.exe"; RunOnceId: "KillCpolar"; Flags: runhidden

[Code]
// 可以使用 Pascal 脚本在安装前后执行自定义逻辑
