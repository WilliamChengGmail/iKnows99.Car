import sys
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
from collector import Iknow99Collector

def main():
    reporter = ExtractionReporter()
    try:
        collector = Iknow99Collector(reporter)
        collector.start()
    except KeyboardInterrupt:
        reporter.log("使用者中斷程式執行。", "WARN")
    except Exception as e:
        reporter.log(f"執行期間發生未預期錯誤: {e}", "ERROR")
        import traceback
        reporter.log(traceback.format_exc(), "ERROR")

if __name__ == "__main__":
    main()
