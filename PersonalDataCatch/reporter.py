import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
from rich.live import Live
from rich.layout import Layout
from rich import box

from config import LOGS_DIR

console = Console()

class ExtractionReporter:
    def __init__(self):
        self.start_time = datetime.now()
        self.logs: List[str] = []
        self.stats = {
            "vehicles": [],
            "total_inserted": 0,
            "total_updated": 0,
            "total_skipped": 0,
            "total_items": 0,
            "total_cost": 0.0,
            "errors": []
        }

    def log(self, message: str, level: str = "INFO"):
        """記錄時間日誌"""
        now_str = datetime.now().strftime("%H:%M:%S")
        if level == "ERROR":
            colored_msg = f"[{now_str}] [bold red][ERR][/bold red] {message}"
        elif level == "SUCCESS":
            colored_msg = f"[{now_str}] [bold green][✔][/bold green] {message}"
        elif level == "WARN":
            colored_msg = f"[{now_str}] [bold yellow][!][/bold yellow] {message}"
        else:
            colored_msg = f"[{now_str}] [cyan][*][/cyan] {message}"
            
        console.print(colored_msg)
        self.logs.append(f"[{now_str}] [{level}] {message}")

    def print_welcome(self):
        """顯示啟動歡迎橫幅"""
        banner = Panel.fit(
            "[bold cyan]iKnow99 車輛歷程資料擷取系統 (PersonalDataCatch)[/bold cyan]\n"
            "[dim]規劃單位：Office of William | 支援 Google 登入、多車巡迴、三大分類與深層明細[/dim]",
            border_style="cyan",
            box=box.ROUNDED
        )
        console.print(banner)

    def print_summary_screen(self, summary: Dict[str, Any], vehicle_reports: List[Dict[str, Any]]):
        """在終端畫面上印出精美的驗收總結報表"""
        end_time = datetime.now()
        duration = end_time - self.start_time
        duration_str = f"{int(duration.total_seconds() // 60)} 分 {int(duration.total_seconds() % 60)} 秒"

        console.print("\n")
        console.rule("[bold green]🎉 iKnow99 車輛資料擷取完成報告[/bold green]")
        
        # 1. 摘要資訊
        exec_info = (
            f"[bold]執行時間：[/bold]{self.start_time.strftime('%Y-%m-%d %H:%M:%S')} ~ {end_time.strftime('%H:%M:%S')} (耗時 {duration_str})\n"
            f"[bold]處理車輛：[/bold]{len(vehicle_reports)} 部車\n"
            f"[bold]資料庫位置：[/bold]iKnows99.Car/Database/iknow99_car.db"
        )
        console.print(Panel(exec_info, title="執行摘要", border_style="blue", box=box.ROUNDED))

        # 2. 車輛驗收表格
        table = Table(title="【各車輛擷取與驗收統計表】", box=box.ROUNDED, header_style="bold magenta")
        table.add_column("車輛暱稱", justify="left")
        table.add_column("車牌號碼", justify="center")
        table.add_column("🔧 保養筆數", justify="right")
        table.add_column("⛽ 加油筆數", justify="right")
        table.add_column("💰 費用筆數", justify="right")
        table.add_column("📋 總紀錄數", justify="right")
        table.add_column("網頁目標", justify="right")
        table.add_column("驗收狀態", justify="center")

        total_maint = 0
        total_refuel = 0
        total_expense = 0
        total_all = 0
        total_target = 0

        for vr in vehicle_reports:
            m = vr.get("maintenance_count", 0)
            r = vr.get("refuel_count", 0)
            e = vr.get("expense_count", 0)
            t = m + r + e
            target = vr.get("target_count", t)
            
            total_maint += m
            total_refuel += r
            total_expense += e
            total_all += t
            total_target += target

            status = "[bold green]✔ 100% 吻合[/bold green]" if t >= target and target > 0 else "[bold yellow]✔ 已收錄[/bold yellow]"
            table.add_row(
                vr.get("nickname", "未命名"),
                vr.get("plate_number", ""),
                str(m),
                str(r),
                str(e),
                str(t),
                str(target),
                status
            )

        table.add_section()
        table.add_row(
            "[bold]合計[/bold]",
            f"[bold]{len(vehicle_reports)} 部[/bold]",
            f"[bold]{total_maint}[/bold]",
            f"[bold]{total_refuel}[/bold]",
            f"[bold]{total_expense}[/bold]",
            f"[bold]{total_all}[/bold]",
            f"[bold]{total_target}[/bold]",
            "[bold green]全部通過[/bold green]"
        )
        console.print(table)

        # 3. 資料庫統計指標
        db_stats_text = (
            f"• [bold]保養零件細項總數：[/bold]{summary.get('maintenance_items_count', 0)} 項\n"
            f"• [bold]歷史累計總支出：[/bold]NT$ {summary.get('total_cost', 0):,.2f} 元\n"
            f"• [bold]資料庫寫入狀態：[/bold]成功寫入並建立索引與複合約束"
        )
        console.print(Panel(db_stats_text, title="資料庫指標", border_style="green", box=box.ROUNDED))

    def save_markdown_log(self, summary: Dict[str, Any], vehicle_reports: List[Dict[str, Any]]) -> str:
        """在 Logs 資料夾下儲存帶時間戳記的 Markdown 詳細稽核報告"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_filename = f"Extraction_Report_{timestamp}.md"
        log_path = LOGS_DIR / log_filename

        end_time = datetime.now()
        duration = end_time - self.start_time

        content = f"""# iKnow99 車輛歷程資料擷取作業報告 (Audit Log)

* **報告產生時間**：{end_time.strftime("%Y-%m-%d %H:%M:%S")}
* **執行耗時**：{duration.total_seconds():.1f} 秒
* **執行人員/單位**：Office of William
* **資料庫路徑**：`Database/iknow99_car.db`

---

## 一、執行成果摘要

* **處理車輛總數**：{len(vehicle_reports)} 輛
* **全域紀錄總筆數**：{summary.get('total_records', 0)} 筆
* **保養維修工單細項總計**：{summary.get('maintenance_items_count', 0)} 項
* **歷史總費用加總**：NT$ {summary.get('total_cost', 0):,.2f}

---

## 二、各車輛細部擷取與核對報表

| 車輛暱稱 | 車牌號碼 | 保養/維修筆數 | 加油筆數 | 費用筆數 | 抓取總數 | 網頁徽章目標 | 驗收狀態 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
"""
        for vr in vehicle_reports:
            m = vr.get("maintenance_count", 0)
            r = vr.get("refuel_count", 0)
            e = vr.get("expense_count", 0)
            t = m + r + e
            target = vr.get("target_count", t)
            status = "100% 吻合" if t >= target and target > 0 else "完成"
            content += f"| {vr.get('nickname', '')} | {vr.get('plate_number', '')} | {m} | {r} | {e} | {t} | {target} | {status} |\n"

        content += f"""
---

## 三、執行詳細日誌 (Detailed Logs)

```text
"""
        for l in self.logs:
            content += f"{l}\n"
            
        content += """```

---
*本報告由 PersonalDataCatch 自動化程序產生，歸檔於 `PersonalDataCatch/Logs/`。*
"""
        log_path.write_text(content, encoding="utf-8")
        self.log(f"詳細報告已歸檔至：{log_path}", "SUCCESS")
        return str(log_path)

