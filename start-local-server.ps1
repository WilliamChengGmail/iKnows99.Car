# ==============================================================================
# CarVitals - 本地服務一鍵啟動程序 (Local Server Launcher)
# 維護者 / 製作者: Office of William
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "CarVitals Local Service (Port 3001)"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         CarVitals 車輛管理系統 本地服務一鍵啟動程序       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 取得專案路徑
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $ScriptDir "CarVitals"

if (-not (Test-Path $AppDir)) {
    Write-Host "[錯誤] 找不到服務目錄: $AppDir" -ForegroundColor Red
    Pause
    exit 1
}

Set-Location $AppDir
Write-Host "[1/4] 工作目錄設定成功: $AppDir" -ForegroundColor Green

# 2. 檢查環境變數檔案 (.env.local)
$EnvFile = Join-Path $AppDir ".env.local"
if (-not (Test-Path $EnvFile)) {
    Write-Host "[警告] 未找到 .env.local 環境變數檔案！" -ForegroundColor Yellow
    Write-Host "       請確認是否已設定 TURSO_DATABASE_URL 與 TURSO_AUTH_TOKEN。" -ForegroundColor Yellow
    $ExampleEnv = Join-Path $AppDir "_env_local_example"
    if (Test-Path $ExampleEnv) {
        Write-Host "       已為您複製 _env_local_example -> .env.local，請記得補齊金鑰。" -ForegroundColor Yellow
        Copy-Item $ExampleEnv $EnvFile
    }
} else {
    Write-Host "[2/4] 環境變數檔案 (.env.local) 檢查正常" -ForegroundColor Green
}

# 3. 檢查 node_modules
$NodeModulesDir = Join-Path $AppDir "node_modules"
if (-not (Test-Path $NodeModulesDir)) {
    Write-Host "[提示] 偵測到尚未安裝相依套件，正在執行 npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[錯誤] npm install 失敗，請檢查網路連線與 Node.js 環境！" -ForegroundColor Red
        Pause
        exit 1
    }
} else {
    Write-Host "[3/4] 相依套件庫 (node_modules) 檢查齊全" -ForegroundColor Green
}

# 4. 檢查 Port 3001 是否被佔用
$portInUse = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "[提示] 偵測到 Port 3001 已有程式在監聽中。" -ForegroundColor Yellow
    Write-Host "       若是先前的 Node / Next.js 伺服器，可能需要重新啟動以套用更新。" -ForegroundColor Yellow
    $choice = Read-Host "       是否要自動清理舊的 3001 Port 伺服器程序並重啟？ (Y/N，預設 Y)"
    if ($choice -eq "" -or $choice -match "^[Yy]") {
        foreach ($conn in $portInUse) {
            $procId = $conn.OwningProcess
            if ($procId -and $procId -ne $PID) {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Seconds 1
        Write-Host "       已釋放 Port 3001，準備啟動服務。" -ForegroundColor Green
    }
}

# 5. 選擇運行模式 (預設熱重載開發模式)
Write-Host ""
Write-Host "請選擇啟動模式:" -ForegroundColor Cyan
Write-Host " [1] 開發熱重載模式 (npm run dev) - 支援即時修改預覽 [預設]" -ForegroundColor White
Write-Host " [2] 生產效能模式 (npm run build & start) - 最佳化極速載入" -ForegroundColor White
$modeChoice = Read-Host "請輸入選項 (1 或 2，預設 1)"

$launchUrl = "http://localhost:3001"

# 自動在預設瀏覽器打開頁面 (延遲 4 秒等待服務啟動)
Start-Job -ScriptBlock {
    param($url)
    Start-Sleep -Seconds 4
    Start-Process $url
} -ArgumentList $launchUrl | Out-Null

Write-Host ""
Write-Host "[4/4] 正在啟動 CarVitals 本地伺服器..." -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host " 👉 服務網址: $launchUrl" -ForegroundColor Green
Write-Host " 👉 按下 Ctrl + C 即可終止伺服器" -ForegroundColor DarkGray
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

if ($modeChoice -eq "2") {
    Write-Host "正在進行最佳化編譯 (Build)..." -ForegroundColor Yellow
    npm run build
    npm run start
} else {
    npm run dev
}

