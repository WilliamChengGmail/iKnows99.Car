import time
import re
import json
import threading
from typing import Dict, Any, List, Optional
from playwright.sync_api import sync_playwright, Page, BrowserContext

from config import TARGET_URL
import db_manager
from reporter import ExtractionReporter

class Iknow99Collector:
    def __init__(self, reporter: ExtractionReporter):
        self.reporter = reporter
        self.captured_payloads: List[Dict[str, Any]] = []

    def start(self):
        """啟動 Playwright 瀏覽器並執行主流程"""
        self.reporter.print_welcome()
        db_manager.init_database()
        self.reporter.log("SQLite 資料庫初始化完成，資料表與視圖已準備就緒。", "SUCCESS")

        with sync_playwright() as p:
            self.reporter.log("正在啟動 Chrome 瀏覽器 (可見視窗模式)...")
            browser = p.chromium.launch(
                headless=False,
                args=["--start-maximized", "--disable-blink-features=AutomationControlled"]
            )
            context = browser.new_context(no_viewport=True)
            page = context.new_page()

            # 設定 API 攔截監聽
            self._setup_interceptor(page)

            # 導向目標網址
            self.reporter.log(f"開啟目標網址：{TARGET_URL}")
            page.goto(TARGET_URL)

            # 等待使用者完成 Google 登入
            self._wait_for_user_login(page)

            # 開始巡迴左側車輛列表與資料擷取
            vehicle_reports = self._process_all_vehicles(page)

            # 關閉瀏覽器
            self.reporter.log("資料擷取完成，準備關閉瀏覽器視窗。")
            browser.close()

            # 產出總結報表與日誌
            overall_summary = db_manager.get_overall_summary()
            self.reporter.print_summary_screen(overall_summary, vehicle_reports)
            self.reporter.save_markdown_log(overall_summary, vehicle_reports)

    def _setup_interceptor(self, page: Page):
        """設定網路請求監聽器，攔截 JSON API 回應"""
        def handle_response(response):
            try:
                url = response.url
                # 攔截包含車輛、紀錄或維修等相關 API
                if any(k in url.lower() for k in ["/api/", "car", "record", "maintenance", "gas", "expense"]):
                    content_type = response.headers.get("content-type", "")
                    if "application/json" in content_type:
                        try:
                            data = response.json()
                            self.captured_payloads.append({"url": url, "data": data})
                        except Exception:
                            pass
            except Exception:
                pass

        page.on("response", handle_response)

    def _wait_for_user_login(self, page: Page):
        """引導並等待使用者完成 Google 登入 (支援自動辨識 + Enter 手動觸發雙保險)"""
        self.reporter.log("==================================================================", "WARN")
        self.reporter.log("【請操作】請在彈出的瀏覽器視窗中，完成 Google 登入！", "WARN")
        self.reporter.log("【雙保險機制】", "WARN")
        self.reporter.log("  1. 程式每秒在背景自動偵測是否已進入愛車管理後台。", "WARN")
        self.reporter.log("  2. 若您已看到後台畫面，亦可直接在終端機按下 [Enter] 鍵立即啟動抓取！", "WARN")
        self.reporter.log("==================================================================", "WARN")

        user_confirmed = threading.Event()

        def listen_enter():
            try:
                # 監聽終端機 Enter
                sys.stdin.readline()
                user_confirmed.set()
            except Exception:
                pass

        enter_thread = threading.Thread(target=listen_enter, daemon=True)
        enter_thread.start()

        max_wait_seconds = 600  # 延長為 10 分鐘等待
        start_wait = time.time()
        last_log_time = 0

        while time.time() - start_wait < max_wait_seconds:
            # 檢查使用者是否手動按下 Enter
            if user_confirmed.is_set():
                self.reporter.log("✔ 已接收到 [Enter] 指令！手動確認已完成登入，開始自動化接手...", "SUCCESS")
                time.sleep(1)
                break

            # 自動檢測所有分頁 (防止 Google 登入開在 Popup 或分頁)
            try:
                context = page.context
                pages_to_check = context.pages if context else [page]

                is_logged_in = False
                for p in pages_to_check:
                    try:
                        p_url = p.url
                        # 若不是在 Google 認證域，且進入了 iknow99
                        if "accounts.google.com" not in p_url and "iknow99.com" in p_url:
                            # 檢查整個 DOM 的文字
                            b_text = p.inner_text("body")
                            if any(k in b_text for k in ["車輛列表", "儀表板", "記錄列表", "紀錄列表", "費用統計", "愛車管理", "william"]):
                                is_logged_in = True
                                # 確保焦點切回該頁面
                                p.bring_to_front()
                                break
                    except Exception:
                        pass

                if is_logged_in:
                    self.reporter.log("✔ 偵測到已成功進入 iknow99 後台！程式開始自動化接手...", "SUCCESS")
                    time.sleep(2)
                    break

                now = time.time()
                if now - last_log_time >= 15:
                    last_log_time = now
                    curr_url = page.url
                    display_url = curr_url if len(curr_url) < 60 else curr_url[:57] + "..."
                    self.reporter.log(f"[*] 等待登入中... (若已登入可直接在終端機按 [Enter] 鍵繼續)")

            except Exception:
                pass

            time.sleep(1.5)

        # 確保當前分頁直接前往 car.manager 目標頁
        try:
            if "car.manager" not in page.url:
                self.reporter.log(f"正在導航至主後台：{TARGET_URL}")
                page.goto(TARGET_URL)
                page.wait_for_load_state("networkidle")
                time.sleep(2)
        except Exception:
            pass

    def _process_all_vehicles(self, page: Page) -> List[Dict[str, Any]]:
        """走訪左側車輛清單並擷取每台車的資料"""
        vehicle_reports = []

        # 尋找左側車輛列表中的各車項目
        self.reporter.log("正在掃描左側車輛清單...")
        page.wait_for_selector("text='車輛列表'", timeout=15000)
        time.sleep(2)

        # 透過 DOM 尋找車輛按鈕或卡片
        # 截圖中顯示：包含車牌、暱稱、廠牌 logo 的清單項目
        car_elements = page.query_selector_all(".car-list-item, div[class*='car-item'], [class*='vehicle-item']")
        if not car_elements:
            # 備援 selector：抓取左側包含車牌格式或暱稱的元素
            car_elements = page.query_selector_all("div:has(> img[src*='nissan'], > img[src*='ford'], > img[alt*='logo'])")
            if not car_elements:
                # 使用通用左側列表容器內的可點擊項目
                car_elements = page.query_selector_all(".sidebar li, .sidebar div[role='button'], div[style*='cursor: pointer']")

        # 若未找到專門 class，用文字特徵辨識已知的車輛暱稱或車牌模式
        car_names_found = []
        for el in car_elements:
            txt = el.inner_text().strip()
            if txt and any(c in txt for c in ["-", "小", "綠", "瓜"]):
                car_names_found.append(el)

        total_cars = len(car_names_found) if car_names_found else 1
        self.reporter.log(f"偵測到 {total_cars} 部車輛項目，開始逐車處理歷程...", "SUCCESS")

        # 逐車處理
        for idx in range(total_cars):
            try:
                # 重新抓取車輛元素以防 DOM Stale
                elements = page.query_selector_all(".car-list-item, div[class*='car-item']")
                target_el = elements[idx] if idx < len(elements) else None
                
                car_name = f"車輛_{idx+1}"
                if target_el:
                    target_el.click()
                    time.sleep(2)
                    car_name = target_el.inner_text().split("\n")[0]

                self.reporter.log(f"================== 正在處理第 [{idx+1}/{total_cars}] 部車：{car_name} ==================", "SUCCESS")

                # 1. 擷取車籍規格
                vehicle_data = self._extract_vehicle_settings(page, default_name=car_name)
                v_id = db_manager.upsert_vehicle(vehicle_data)
                self.reporter.log(f"車籍資料已同步入庫：{vehicle_data.get('nickname')} ({vehicle_data.get('plate_number')})")

                # 2. 切換至「紀錄列表」分頁
                vr = self._extract_record_list(page, v_id, vehicle_data)
                vehicle_reports.append(vr)

            except Exception as e:
                self.reporter.log(f"處理車輛時發生錯誤: {e}", "ERROR")

        return vehicle_reports

    def _extract_vehicle_settings(self, page: Page, default_name: str) -> Dict[str, Any]:
        """擷取車籍規格設定（對應車輛設定畫面）"""
        # 預設物件
        v = {
            "vehicle_id": default_name,
            "plate_number": "",
            "nickname": default_name,
            "brand": "",
            "model": "",
            "trim": "",
            "car_type": "轎車",
            "horsepower": "",
            "displacement": "",
            "fuel_type": "汽油",
            "current_mileage": 0,
            "mileage_unit": "公里",
            "license_date": None,
            "vehicle_usage": "自用車",
            "tank_capacity": 50.0,
            "fuel_efficiency_unit": "公里/公升",
            "reserve_fuel_volume": 5.0,
            "fuel_warning_percentage": 10
        }

        # 嘗試點擊車輛設定圖示（若有設定齒輪或彈窗）
        settings_btn = page.query_selector("button:has-text('設定'), [title*='設定'], .icon-cog, i[class*='setting']")
        if settings_btn:
            try:
                settings_btn.click()
                time.sleep(1.5)
                # 從彈出的「車輛設定」表單中抽取欄位
                plate_input = page.query_selector("input[name*='plate'], input[placeholder*='車牌']")
                if plate_input:
                    v["plate_number"] = plate_input.input_value()
                    v["vehicle_id"] = v["plate_number"]

                nick_input = page.query_selector("input[name*='nick'], input[placeholder*='暱稱']")
                if nick_input:
                    v["nickname"] = nick_input.input_value()

                # 關閉設定視窗 (點擊左上角返回或右上角打勾)
                close_btn = page.query_selector(".modal-header button, button:has-text('返回'), i[class*='arrow-left']")
                if close_btn:
                    close_btn.click()
                    time.sleep(1)
            except Exception:
                pass

        # 若未成功開窗，嘗試從畫面文字提取車牌（如 2553-VY、2G-4730、BGH-2750）
        page_text = page.inner_text("body")
        plate_match = re.search(r"([A-Z0-9]{2,4}-[A-Z0-9]{2,4})", page_text)
        if plate_match and not v["plate_number"]:
            v["plate_number"] = plate_match.group(1)
            v["vehicle_id"] = v["plate_number"]

        return v

    def _extract_record_list(self, page: Page, vehicle_id: str, vehicle_data: Dict[str, Any]) -> Dict[str, Any]:
        """切換到「紀錄列表」分頁並逐頁、逐筆完整擷取"""
        self.reporter.log("切換至【紀錄列表】分頁...")
        
        # 點擊「記錄列表」或「紀錄列表」頁籤
        tab_list = page.locator("text='記錄列表', text='紀錄列表', a:has-text('記錄列表'), a:has-text('紀錄列表')")
        if tab_list.count() > 0:
            tab_list.first.click()
            time.sleep(2)

        # 讀取頂部徽章總數 (44 總數, 5 維修, 33 加油, 6 費用)
        target_counts = self._read_badge_counts(page)
        self.reporter.log(
            f"網頁徽章目標筆數：總計 {target_counts['total']} 筆 "
            f"(🔧維修: {target_counts['maint']}, ⛽加油: {target_counts['refuel']}, 💰費用: {target_counts['expense']})"
        )

        has_next_page = True
        current_page = 1
        processed_records = 0

        while has_next_page:
            self.reporter.log(f"--- 正在擷取第 {current_page} 頁資料 ---")
            page.wait_for_load_state("networkidle")
            time.sleep(1.5)

            # 抓取表格中所有資料列
            rows = page.query_selector_all("table tbody tr, .record-list-item, div[class*='record-row']")
            if not rows:
                # 備用：若找不到標準 table，嘗試抓取包含日期的橫列
                rows = page.query_selector_all("tr:has(td)")

            self.reporter.log(f"第 {current_page} 頁共發現 {len(rows)} 列紀錄。")

            for r_idx, row in enumerate(rows):
                try:
                    row_text = row.inner_text()
                    if not row_text.strip():
                        continue

                    # 辨識分類圖示 (🔧維修, ⛽加油, 💰費用)
                    category_type = self._detect_row_category(row, row_text)
                    
                    # 點擊該列以開啟深層資料彈窗
                    row.click()
                    time.sleep(1.2)

                    # 根據分類解析彈窗內容並存入 SQLite
                    if category_type == "MAINTENANCE":
                        self._parse_and_save_maintenance(page, vehicle_id, row_text)
                    elif category_type == "REFUELING":
                        self._parse_and_save_refueling(page, vehicle_id, row_text)
                    else:
                        self._parse_and_save_expense(page, vehicle_id, row_text)

                    processed_records += 1

                    # 關閉彈窗 (點擊右上角 X 或左上角勾勾/返回)
                    close_btn = page.query_selector(".modal button.close, [class*='close'], button:has-text('✕'), i[class*='check'], i[class*='close']")
                    if close_btn:
                        close_btn.click()
                        time.sleep(0.8)
                    else:
                        page.keyboard.press("Escape")
                        time.sleep(0.8)

                except Exception as ex:
                    self.reporter.log(f"解析單筆紀錄時略過或發生異常: {ex}", "WARN")
                    try:
                        page.keyboard.press("Escape")
                    except Exception:
                        pass

            # 檢查是否有下一頁按鈕
            next_page_btn = page.query_selector(f"a:has-text('{current_page + 1}'), button:has-text('{current_page + 1}'), a[rel='next'], .pagination .next:not(.disabled)")
            if next_page_btn and next_page_btn.is_visible():
                self.reporter.log(f"翻往第 {current_page + 1} 頁...")
                next_page_btn.click()
                current_page += 1
                time.sleep(2)
            else:
                has_next_page = False
                self.reporter.log("已達最後一頁，本車歷史紀錄擷取完畢。")

        # 取得資料庫目前的實際統計
        db_counts = db_manager.get_vehicle_counts(vehicle_id)
        return {
            "vehicle_id": vehicle_id,
            "plate_number": vehicle_data.get("plate_number", ""),
            "nickname": vehicle_data.get("nickname", ""),
            "target_count": target_counts["total"],
            "maintenance_count": db_counts["maintenance"],
            "refuel_count": db_counts["refueling"],
            "expense_count": db_counts["expense"],
            "total_count": db_counts["total"]
        }

    def _read_badge_counts(self, page: Page) -> Dict[str, int]:
        """讀取頂部 4 個徽章按鈕的筆數統計"""
        badges = {"total": 0, "maint": 0, "refuel": 0, "expense": 0}
        try:
            # 依序尋找包含圖示或數字的按鈕
            btn_texts = page.eval_on_selector_all(
                ".btn, button, .badge",
                "elements => elements.map(e => e.innerText.trim())"
            )
            # 解析純數字
            numbers = []
            for t in btn_texts:
                if t.isdigit():
                    numbers.append(int(t))
            if len(numbers) >= 4:
                badges["total"] = numbers[0]
                badges["maint"] = numbers[1]
                badges["refuel"] = numbers[2]
                badges["expense"] = numbers[3]
        except Exception:
            pass
        return badges

    def _detect_row_category(self, row, row_text: str) -> str:
        """根據圖示 class 或文字特徵辨識紀錄分類"""
        html = row.inner_html().lower()
        if any(w in html for w in ["wrench", "tool", "repair", "maint"]) or "保養" in row_text:
            return "MAINTENANCE"
        elif any(w in html for w in ["gas", "pump", "fuel", "oil"]) or "公升" in row_text:
            return "REFUELING"
        else:
            return "EXPENSE"

    def _parse_and_save_maintenance(self, page: Page, vehicle_id: str, row_text: str):
        """解析保養維修彈窗表單並存入 SQLite"""
        # 從輸入框抓取欄位
        date_val = page.input_value("input[name*='date'], input[type='date']") if page.query_selector("input[type='date']") else "2022-01-01"
        time_val = page.input_value("input[name*='time'], input[type='time']") if page.query_selector("input[type='time']") else "12:00"
        mileage_val = page.input_value("input[name*='mileage']") if page.query_selector("input[name*='mileage']") else "0"
        amount_val = page.input_value("input[name*='amount'], input[name*='total']") if page.query_selector("input[name*='amount']") else "0"
        title_val = page.input_value("input[name*='title']") if page.query_selector("input[name*='title']") else "定期保養"
        notes_val = page.input_value("textarea") if page.query_selector("textarea") else ""

        rec = {
            "vehicle_id": vehicle_id,
            "record_date": date_val or "2022-01-01",
            "record_time": time_val or "00:00",
            "mileage": int(re.sub(r"[^\d]", "", str(mileage_val)) or 0),
            "title": title_val or "保養維修",
            "total_amount": float(re.sub(r"[^\d.]", "", str(amount_val)) or 0.0),
            "payment_method": "信用卡",
            "notes": notes_val
        }

        # 抓取工單細項零件列表
        items = []
        item_rows = page.query_selector_all(".modal table tbody tr")
        for ir in item_rows:
            tds = [td.inner_text().strip() for td in ir.query_selector_all("td")]
            if len(tds) >= 6:
                items.append({
                    "item_name": tds[0],
                    "spec_detail": tds[1] if len(tds) > 1 else "",
                    "lifespan_date": tds[2] if len(tds) > 2 else "",
                    "lifespan_mileage": int(re.sub(r"[^\d]", "", tds[3]) or 0) if len(tds) > 3 else 0,
                    "unit_price": float(re.sub(r"[^\d.]", "", tds[4]) or 0.0) if len(tds) > 4 else 0.0,
                    "quantity": float(re.sub(r"[^\d.]", "", tds[5]) or 1.0) if len(tds) > 5 else 1.0,
                    "subtotal": float(re.sub(r"[^\d.]", "", tds[6]) or 0.0) if len(tds) > 6 else 0.0,
                    "remarks": tds[7] if len(tds) > 7 else ""
                })

        res = db_manager.upsert_maintenance_record(rec, items)
        self.reporter.log(f"寫入保養紀錄：{rec['record_date']} {rec['title']} (${rec['total_amount']:,.0f}) [{res['items_count']} 項細項]")

    def _parse_and_save_refueling(self, page: Page, vehicle_id: str, row_text: str):
        """解析加油彈窗表單並存入 SQLite"""
        date_val = page.input_value("input[type='date']") if page.query_selector("input[type='date']") else "2022-01-01"
        time_val = page.input_value("input[type='time']") if page.query_selector("input[type='time']") else "12:00"
        mileage_val = page.input_value("input[name*='mileage']") if page.query_selector("input[name*='mileage']") else "0"
        amount_val = page.input_value("input[name*='amount'], input[name*='total']") if page.query_selector("input[name*='amount']") else "0"
        liters_val = page.input_value("input[name*='liter']") if page.query_selector("input[name*='liter']") else "0"
        price_val = page.input_value("input[name*='price']") if page.query_selector("input[name*='price']") else "0"
        notes_val = page.input_value("textarea") if page.query_selector("textarea") else ""

        rec = {
            "vehicle_id": vehicle_id,
            "refuel_date": date_val or "2022-01-01",
            "refuel_time": time_val or "00:00",
            "mileage": int(re.sub(r"[^\d]", "", str(mileage_val)) or 0),
            "total_amount": float(re.sub(r"[^\d.]", "", str(amount_val)) or 0.0),
            "payment_method": "信用卡",
            "liters": float(re.sub(r"[^\d.]", "", str(liters_val)) or 0.0),
            "unit_price": float(re.sub(r"[^\d.]", "", str(price_val)) or 0.0),
            "fuel_type": "95無鉛",
            "is_previous_missed": 0,
            "fuel_gauge_position": 1.0,
            "prev_mileage": 0,
            "trip_distance": 0.0,
            "tank_fuel_level": 50.0,
            "fuel_efficiency": 0.0,
            "cost_per_km": 0.0,
            "prev_fuel_used": 0.0,
            "notes": notes_val
        }

        db_manager.upsert_refueling_record(rec)
        self.reporter.log(f"寫入加油紀錄：{rec['refuel_date']} {rec['liters']} 公升 (${rec['total_amount']:,.0f})")

    def _parse_and_save_expense(self, page: Page, vehicle_id: str, row_text: str):
        """解析費用彈窗表單並存入 SQLite"""
        date_val = page.input_value("input[type='date']") if page.query_selector("input[type='date']") else "2022-01-01"
        time_val = page.input_value("input[type='time']") if page.query_selector("input[type='time']") else "12:00"
        mileage_val = page.input_value("input[name*='mileage']") if page.query_selector("input[name*='mileage']") else "0"
        amount_val = page.input_value("input[name*='amount'], input[name*='total']") if page.query_selector("input[name*='amount']") else "0"
        title_val = page.input_value("input[name*='title']") if page.query_selector("input[name*='title']") else "一般費用"
        category_val = page.input_value("select[name*='category']") if page.query_selector("select[name*='category']") else "其他"
        notes_val = page.input_value("textarea") if page.query_selector("textarea") else ""

        rec = {
            "vehicle_id": vehicle_id,
            "expense_date": date_val or "2022-01-01",
            "expense_time": time_val or "00:00",
            "mileage": int(re.sub(r"[^\d]", "", str(mileage_val)) or 0),
            "title": title_val or "一般費用",
            "expense_category": category_val or "其他",
            "total_amount": float(re.sub(r"[^\d.]", "", str(amount_val)) or 0.0),
            "payment_method": "現金",
            "notes": notes_val
        }

        db_manager.upsert_expense_record(rec)
        self.reporter.log(f"寫入費用紀錄：{rec['expense_date']} [{rec['expense_category']}] {rec['title']} (${rec['total_amount']:,.0f})")

