import sys
import subprocess
from pathlib import Path

# 設定 Windows 終端輸出編碼為 UTF-8，防止編碼衝突
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 將當前資料夾加入 sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from reporter import ExtractionReporter

def check_dependencies(reporter: ExtractionReporter):
    """檢查並安裝相依模組，所有細節寫入日誌"""
    reporter.log(f"檢查 Python 環境：{sys.version.split()[0]} ({sys.executable})")
    
    required = ["playwright", "rich"]
    for pkg in required:
        try:
            __import__(pkg)
            reporter.log(f"已安裝相依模組：{pkg}")
        except ImportError:
            reporter.log(f"正在安裝相依模組：{pkg}...", "WARN")
            subprocess.run([sys.executable, "-m", "pip", "install", pkg, "--quiet"], check=True)
            reporter.log(f"成功安裝模組：{pkg}", "SUCCESS")

def main():
    reporter = ExtractionReporter()
    reporter.print_welcome()
    
    try:
        reporter.log("==================== [1/3] 啟動環境檢測 ====================")
        check_dependencies(reporter)
        reporter.log("[2/3] 環境檢測完成，載入資料擷取模組...", "SUCCESS")
        
        from collector import Iknow99Collector
        collector = Iknow99Collector(reporter)
        
        reporter.log("[3/3] 啟動瀏覽器與資料庫作業...", "SUCCESS")
        collector.start()
    except KeyboardInterrupt:
        reporter.log("使用者中斷程式執行 (Ctrl+C)。", "WARN")
    except Exception as e:
        reporter.log(f"執行期間發生未預期錯誤: {e}", "ERROR")
        import traceback
        reporter.log(traceback.format_exc(), "ERROR")

if __name__ == "__main__":
    main()
