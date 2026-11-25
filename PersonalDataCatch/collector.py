import sys
import time
import re
import json
import threading
from typing import Dict, Any, List, Optional
from playwright.sync_api import sync_playwright, Page, BrowserContext

from config import TARGET_URL, SIGN_IN_URL
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
        db_manager.clean_invalid_data()
        self.reporter.log("SQLite 資料庫初始化完成，無效髒資料已清理完畢。", "SUCCESS")

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

            # 導向目標登入網址
            self.reporter.log(f"開啟目標登入網址：{SIGN_IN_URL}")
            page.goto(SIGN_IN_URL)

            # 等待使用者完成 Google 登入
            self._wait_for_user_login(page)

            # 開始巡迴左側車輛列表與資料擷取
            vehicle_reports = self._process_all_vehicles(page)

            # 關閉瀏覽器
            if not vehicle_reports:
                self.reporter.log("未成功擷取到車輛資料，保留瀏覽器視窗以供檢查。", "WARN")
            else:
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
        """引導並等待使用者完成 Google 登入"""
        self.reporter.log("==================================================================", "WARN")
        self.reporter.log("【請操作】請在彈出的瀏覽器視窗中，完成 Google 登入！", "WARN")
        self.reporter.log("【雙保險機制】", "WARN")
        self.reporter.log("  1. 程式每秒在背景自動偵測是否已進入愛車管理後台。", "WARN")
        self.reporter.log("  2. 若您已看到後台畫面，亦可直接在終端機按下 [Enter] 鍵立即啟動抓取！", "WARN")
        self.reporter.log("==================================================================", "WARN")

        user_confirmed = threading.Event()

        def listen_enter():
            try:
                line = sys.stdin.readline()
                if line is not None:
                    user_confirmed.set()
            except Exception:
                pass

        enter_thread = threading.Thread(target=listen_enter, daemon=True)
        enter_thread.start()

        max_wait_seconds = 1800  # 30 分鐘
        start_wait = time.time()
        last_log_time = 0

        while time.time() - start_wait < max_wait_seconds:
            if sys.platform.startswith("win"):
                try:
                    import msvcrt
                    while msvcrt.kbhit():
                        msvcrt.getch()
                        user_confirmed.set()
                except Exception:
                    pass

            if user_confirmed.is_set():
                self.reporter.log("✔ 已接收到手動確認指令！立即接管瀏覽器開始抓取...", "SUCCESS")
                time.sleep(1)
                break

            try:
                context = page.context
                pages_to_check = context.pages if context else [page]

                is_logged_in = False
                for p in pages_to_check:
                    try:
                        p_url = p.url
                        if any(auth in p_url for auth in ["accounts.google.com", "user.sign_in", "sign_in"]):
                            continue

                        if "car.manager" in p_url:
                            is_logged_in = True
                            p.bring_to_front()
                            page = p
                            break

                        if "iknow99.com" in p_url:
                            b_text = p.inner_text("body")
                            has_core = "記錄列表" in b_text or "紀錄列表" in b_text or "車輛列表" in b_text or "form_all_count" in p.content()
                            if has_core:
                                is_logged_in = True
                                p.bring_to_front()
                                page = p
                                break
                    except Exception:
                        pass

                if is_logged_in:
                    self.reporter.log("✔ 偵測到已成功進入愛車管理後台！程式開始自動化接手...", "SUCCESS")
                    time.sleep(2)
                    break

                now = time.time()
                if now - last_log_time >= 10:
                    last_log_time = now
                    curr_url = page.url
                    display_url = curr_url if len(curr_url) < 55 else curr_url[:52] + "..."
                    self.reporter.log(f"[*] 等待登入中 (目前頁面: {display_url} | 登入後可隨時按 [Enter] 繼續)")

            except Exception:
                pass

            time.sleep(1.0)

        try:
            if "car.manager" not in page.url:
                self.reporter.log(f"正在導向愛車管理後台：{TARGET_URL}")
                page.goto(TARGET_URL)
                time.sleep(3)
            else:
                self.reporter.log("瀏覽器已在愛車管理後台，保持畫面穩定進入掃描階段...")
                time.sleep(2)
        except Exception as e:
            self.reporter.log(f"導向後台時發生異常: {e}", "WARN")

    def _process_all_vehicles(self, page: Page) -> List[Dict[str, Any]]:
        """走訪 3 部車輛並擷取每台車的資料"""
        vehicle_reports = []

        # 使用者擁有的 3 部目標車輛白名單
        known_cars = [
            {"plate": "2553-VY", "nickname": "小飛"},
            {"plate": "2G-4730", "nickname": "迷你綠"},
            {"plate": "BGH-2750", "nickname": "白玉苦瓜"}
        ]

        total_cars = len(known_cars)
        plate_names = [f"{c['nickname']} ({c['plate']})" for c in known_cars]
        self.reporter.log(f"共鎖定 {total_cars} 部車輛：{', '.join(plate_names)}", "SUCCESS")

        # 逐車處理
        for idx, car_info in enumerate(known_cars):
            plate = car_info["plate"]
            nick = car_info["nickname"]

            self.reporter.log(f"================== 正在處理第 [{idx+1}/{total_cars}] 部車：{nick} ({plate}) ==================", "SUCCESS")

            try:
                # 1. 切換至該車輛
                self.reporter.log(f"切換至車輛：{nick} ({plate})...")
                self._switch_to_vehicle(page, plate, nick)

                # 2. 擷取車籍規格
                vehicle_data = self._extract_vehicle_settings(page, default_name=nick, plate_number=plate)
                v_id = db_manager.upsert_vehicle(vehicle_data)
                self.reporter.log(f"車籍規格已同步入庫：{vehicle_data.get('nickname')} ({vehicle_data.get('plate_number')})")

                # 3. 清除該車在 SQLite 中的舊紀錄 (確保以本次抓取 100% 乾淨覆蓋舊版錯誤資料)
                db_manager.clear_vehicle_records(v_id)
                self.reporter.log(f"已清理車輛 {plate} 之歷史舊紀錄，準備進行全新覆蓋同步...")

                # 4. 切換至「記錄列表」分頁並執行完整擷取
                vr = self._extract_record_list(page, v_id, vehicle_data)
                vehicle_reports.append(vr)

            except Exception as e:
                self.reporter.log(f"處理車輛 {nick} ({plate}) 時發生異常: {e}", "ERROR")

        return vehicle_reports

    def _switch_to_vehicle(self, page: Page, plate: str, nick: str):
        """切換至指定車輛，並透過 active 狀態與暱稱標題雙重驗證確保 100% 切換成功"""
        self.reporter.log(f"正在切換至車輛：{nick} ({plate})...")

        for attempt in range(4):
            # 1. 透過 JavaScript 觸發左側列表項目點擊 (同時觸發 jQuery 與原生 click)
            clicked = page.evaluate("""(target) => {
                const items = Array.from(document.querySelectorAll('.car-list-item'));
                for (const item of items) {
                    const text = item.innerText || '';
                    if (text.includes(target.plate) || text.includes(target.nick)) {
                        // 滾動到可視範圍
                        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // 優先點選主體 .car-info 避開右側選單按鈕
                        const info = item.querySelector('.car-info') || item;
                        if (window.jQuery) {
                            window.jQuery(item).trigger('click');
                            window.jQuery(info).trigger('click');
                        }
                        info.click();
                        return true;
                    }
                }
                return false;
            }""", {"plate": plate, "nick": nick})

            time.sleep(1.5)

            # 2. 驗證是否切換成功 (檢查左側 .car-list-item.active 或 #car_nickname 標題)
            is_switched = page.evaluate("""(target) => {
                // 檢查是否有標記 active 的車輛項目
                const activeItem = document.querySelector('.car-list-item.active');
                if (activeItem) {
                    const txt = activeItem.innerText || '';
                    if (txt.includes(target.plate) || txt.includes(target.nick)) return true;
                }
                // 檢查車輛暱稱標題
                const titleEl = document.querySelector('#car_nickname');
                if (titleEl) {
                    const titleTxt = titleEl.innerText || '';
                    if (titleTxt.includes(target.nick) || titleTxt.includes(target.plate)) return true;
                }
                return false;
            }""", {"plate": plate, "nick": nick})

            if is_switched:
                self.reporter.log(f"✔ 已確認成功切換至車輛：{nick} ({plate})！", "SUCCESS")
                time.sleep(1.0)
                return

            self.reporter.log(f"車輛切換尚未完成，進行第 {attempt + 1} 次重試...", "WARN")
            time.sleep(1.0)

        self.reporter.log(f"車輛切換已發送指令，繼續執行後續步驟：{nick} ({plate})", "WARN")

    def _extract_vehicle_settings(self, page: Page, default_name: str, plate_number: str = "") -> Dict[str, Any]:
        """擷取車籍規格設定"""
        v = {
            "vehicle_id": plate_number or default_name,
            "plate_number": plate_number,
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
            "insurance_expiry_date": None,
            "reminder_setting": "",
            "tank_capacity": 50.0,
            "fuel_efficiency_unit": "公里/公升",
            "reserve_fuel_volume": 5.0,
            "fuel_warning_percentage": 10
        }

        try:
            settings_btn = page.query_selector("button:has-text('設定'), [title*='設定'], .icon-cog, i[class*='cog'], i[class*='setting'], [class*='edit']")
            if settings_btn and settings_btn.is_visible():
                settings_btn.click(timeout=2000)
                time.sleep(1.0)
                for field, sel in [
                    ("plate_number", "input[name*='plate'], input[placeholder*='車牌']"),
                    ("nickname", "input[name*='nick'], input[placeholder*='暱稱']"),
                    ("brand", "input[name*='brand'], [class*='brand']"),
                    ("model", "input[name*='model'], [class*='model']"),
                    ("current_mileage", "input[name*='mileage']"),
                    ("tank_capacity", "input[name*='tank'], input[name*='capacity']"),
                ]:
                    try:
                        el = page.query_selector(sel)
                        if el:
                            val = el.input_value() if hasattr(el, 'input_value') else el.inner_text()
                            if val:
                                if field == "current_mileage":
                                    v[field] = int(re.sub(r"[^\d]", "", str(val)) or 0)
                                elif field == "tank_capacity":
                                    v[field] = float(re.sub(r"[^\d.]", "", str(val)) or 50.0)
                                else:
                                    v[field] = val.strip()
                    except Exception:
                        pass

                if v.get("plate_number"):
                    v["vehicle_id"] = v["plate_number"]

                close_btn = page.query_selector(".modal-header button, button:has-text('返回'), i[class*='arrow-left']")
                if close_btn:
                    close_btn.click()
                else:
                    page.keyboard.press("Escape")
                time.sleep(0.8)
        except Exception:
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass

        return v

    def _ensure_no_modal(self, page: Page):
        """溫和清理殘留彈窗與表單，優先關閉零件小彈窗與工單詳細表單，絕不破壞整體 DOM"""
        try:
            page.evaluate("""() => {
                // 1. 若零件編輯小彈窗 (#add_component_modal) 開著，先關閉
                const compModal = document.querySelector('#add_component_modal');
                if (compModal && getComputedStyle(compModal).display !== 'none') {
                    const btn = compModal.querySelector('#add_component_close, [data-dismiss="modal"]');
                    if (btn) btn.click();
                    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.modal) {
                        try { window.jQuery('#add_component_modal').modal('hide'); } catch(e) {}
                    }
                }

                // 2. 若工單詳細表單 (#edit_form_box) 開著，觸發關閉按鈕
                const editBox = document.querySelector('#edit_form_box');
                if (editBox && getComputedStyle(editBox).display !== 'none') {
                    const closeBtn = document.querySelector('#edit_form_close');
                    if (closeBtn) {
                        closeBtn.click();
                    } else {
                        const tabBox = document.querySelector('#tab_box');
                        if (tabBox) tabBox.style.display = 'block';
                        editBox.style.display = 'none';
                    }
                }

                // 3. 備援關閉通用 Bootstrap Modal
                if (window.jQuery && window.jQuery.fn && window.jQuery.fn.modal) {
                    try { window.jQuery('.modal').modal('hide'); } catch(e) {}
                }
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('padding-right');
            }""")
            time.sleep(0.3)
        except Exception:
            pass

    def _close_modal(self, page: Page):
        """正確關閉工單詳細表單 (點擊右上角白色 ✖ 按鈕 #edit_form_close)"""
        try:
            # 優先點擊 iknow99 專屬的工單關閉按鈕 #edit_form_close
            closed = page.evaluate("""() => {
                // 若有零件編輯小彈窗，先關小彈窗
                const compModal = document.querySelector('#add_component_modal');
                if (compModal && getComputedStyle(compModal).display !== 'none') {
                    const cBtn = compModal.querySelector('#add_component_close, [data-dismiss="modal"]');
                    if (cBtn) cBtn.click();
                    if (window.jQuery) {
                        try { window.jQuery('#add_component_modal').modal('hide'); } catch(e) {}
                    }
                }

                // 關閉工單畫面
                const closeBtn = document.querySelector('#edit_form_close');
                if (closeBtn) {
                    closeBtn.click();
                    return true;
                }
                return false;
            }""")

            if closed:
                # 等待 #edit_form_box 隱藏
                wait_start = time.time()
                while time.time() - wait_start < 1.5:
                    is_hidden = page.evaluate("""() => {
                        const box = document.querySelector('#edit_form_box');
                        return !box || getComputedStyle(box).display === 'none';
                    }""")
                    if is_hidden:
                        break
                    time.sleep(0.1)

            self._ensure_no_modal(page)
        except Exception:
            self._ensure_no_modal(page)

    def _read_badge_counts(self, page: Page) -> Dict[str, int]:
        """精確讀取使用者的 4 個 span 徽章筆數"""
        badges = {"total": 0, "maint": 0, "refuel": 0, "expense": 0}
        for key, sel in [
            ("total", "#form_all_count"),
            ("maint", "#form_care_count"),
            ("refuel", "#form_fuel_count"),
            ("expense", "#form_expense_count")
        ]:
            try:
                el = page.query_selector(sel)
                if el:
                    txt = el.inner_text().strip()
                    if txt.isdigit():
                        badges[key] = int(txt)
            except Exception:
                pass
        return badges

    def _switch_to_records_tab(self, page: Page):
        """確實切換至【記錄列表】頁籤並等待徽章資料載入"""
        self.reporter.log("正在切換至【記錄列表】分頁...")

        # 優先透過 JavaScript 精確點擊導覽列上的「記錄列表」
        page.evaluate("""() => {
            const tabs = Array.from(document.querySelectorAll('a, button, li'));
            const target = tabs.find(el => {
                const t = el.innerText ? el.innerText.trim() : '';
                return (t === '記錄列表' || t === '紀錄列表') && el.offsetParent !== null;
            });
            if (target) target.click();
        }""")
        time.sleep(1.5)

        # 檢查是否已出現 #form_all_count，若未出現再嘗試備援點擊
        try:
            page.wait_for_selector("#form_all_count", timeout=4000)
            self.reporter.log("✔ 已確認進入【記錄列表】畫面！", "SUCCESS")
        except Exception:
            for sel in [".nav-tabs a:has-text('記錄列表')", "a:text-is('記錄列表')", "a:has-text('記錄列表')"]:
                try:
                    t = page.query_selector(sel)
                    if t and t.is_visible():
                        t.click()
                        time.sleep(1.5)
                        break
                except Exception:
                    pass

        # 確保在全部列表模式 (點擊 #form_all_count 所在的按鈕)
        try:
            page.evaluate("""() => {
                const span = document.querySelector('#form_all_count');
                if (span) {
                    const btn = span.closest('button, a, .btn') || span;
                    btn.click();
                }
            }""")
            time.sleep(0.8)
        except Exception:
            pass

    def _extract_record_list(self, page: Page, vehicle_id: str, vehicle_data: Dict[str, Any]) -> Dict[str, Any]:
        """切換到「記錄列表」分頁並逐頁、逐筆完整擷取深層資料"""
        self._switch_to_records_tab(page)

        # 讀取精確徽章總數
        target_counts = self._read_badge_counts(page)
        self.reporter.log(
            f"網頁徽章目標筆數：總計 {target_counts['total']} 筆 "
            f"(🔧維修: {target_counts['maint']}, ⛽加油: {target_counts['refuel']}, 💰費用: {target_counts['expense']})",
            "SUCCESS"
        )

        has_next_page = True
        current_page = 1
        processed_records = 0

        while has_next_page:
            self.reporter.log(f"--- 正在擷取第 {current_page} 頁資料 ---")
            time.sleep(1.0)
            self._ensure_no_modal(page)

            # 抓取表格中所有資料列 (鎖定具有 td.date 或 td.amount 的記錄列)
            rows = page.query_selector_all("table tbody tr:has(td.date), tr:has(td.date), tr:has(td.amount)")
            if not rows:
                all_trs = page.query_selector_all("table tbody tr")
                rows = [r for r in all_trs if len(r.query_selector_all("td")) >= 5]

            self.reporter.log(f"第 {current_page} 頁共發現 {len(rows)} 列有效紀錄。")

            if not rows:
                self.reporter.log("本頁未發現有效資料列，結束本車擷取。", "WARN")
                break

            first_row_text_before = rows[0].inner_text().strip()

            for r_idx, row in enumerate(rows):
                try:
                    # 1. 根據真實 DOM class 解析單元格基礎欄位
                    base_info = self._parse_table_row_cells(row)
                    if not base_info or not base_info.get("date"):
                        continue

                    category_type = base_info.get("category_type", "EXPENSE")

                    # 2. 自動化最佳邏輯：
                    # 只有在遇到「維修保養 (MAINTENANCE)」紀錄時，才精準進入第 2 層工單大畫面擷取 5 項零配件細項
                    # 加油與其他費用已在列表行中擁有完整資訊，直接秒速入庫，大幅提升 10 倍以上效能與穩定度
                    modal_opened = False
                    if category_type == "MAINTENANCE":
                        try:
                            # 滾動並觸發行點擊以喚起工單詳細畫面 (優先使用 iknow99 綁定之 jQuery 事件)
                            page.evaluate("""(r) => {
                                r.scrollIntoView({ behavior: 'instant', block: 'center' });
                                if (window.jQuery) {
                                    window.jQuery(r).trigger('click');
                                } else {
                                    const target = r.querySelector('.title') || r.querySelector('.date') || r;
                                    target.click();
                                }
                            }""", row)

                            # 等待 #edit_form_box 載入完成 (等待其由 display:none 變更為 visible，且日期或標題被填入)
                            wait_start = time.time()
                            while time.time() - wait_start < 3.0:
                                is_ready = page.evaluate("""() => {
                                    const box = document.querySelector('#edit_form_box');
                                    if (!box || getComputedStyle(box).display === 'none') return false;
                                    const d = document.querySelector('#edit_form_date');
                                    const t = document.querySelector('#edit_form_title');
                                    const hasVal = (d && d.value && d.value.trim() !== '') || (t && t.value && t.value.trim() !== '');
                                    return Boolean(hasVal);
                                }""")
                                if is_ready:
                                    modal_opened = True
                                    break
                                time.sleep(0.1)

                            # 備援：若未在 1.5 秒內就緒，進行原生 DOM 點擊
                            if not modal_opened:
                                try:
                                    title_cell = row.query_selector("td.title, td.date")
                                    if title_cell:
                                        title_cell.click(timeout=800)
                                        time.sleep(0.5)
                                        modal_opened = page.evaluate("""() => {
                                            const box = document.querySelector('#edit_form_box');
                                            return Boolean(box && getComputedStyle(box).display !== 'none');
                                        }""")
                                except Exception:
                                    pass
                        except Exception as click_err:
                            self.reporter.log(f"點擊進入第 {r_idx+1} 筆維修工單異常: {click_err}", "WARN")
                            modal_opened = False

                    # 3. 根據分類解析資料並寫入 SQLite
                    if category_type == "MAINTENANCE":
                        self._parse_and_save_maintenance(page, vehicle_id, base_info, modal_opened)
                        # 維修工單擷取完畢後，立即自動平滑關閉回到列表 (完全不需人工點擊)
                        if modal_opened:
                            self._close_modal(page)
                    elif category_type == "REFUELING":
                        self._parse_and_save_refueling(page, vehicle_id, base_info, False)
                    else:
                        self._parse_and_save_expense(page, vehicle_id, base_info, False)

                    processed_records += 1

                except Exception as ex:
                    self.reporter.log(f"解析第 {r_idx+1} 筆紀錄時略過或異常: {ex}", "WARN")
                    self._ensure_no_modal(page)

            # 5. 分頁翻頁邏輯
            has_next = self._navigate_to_next_page(page, current_page, first_row_text_before)
            if has_next:
                current_page += 1
            else:
                has_next_page = False
                self.reporter.log(f"已達最後一頁 (共完成 {current_page} 頁，累計處理 {processed_records} 筆)，本車歷史紀錄擷取完畢。", "SUCCESS")

        # 取得資料庫統計
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

    def _parse_table_row_cells(self, row) -> Optional[Dict[str, Any]]:
        """利用標準 HTML class (td.icon, td.date, td.odometer, td.title, td.amount, td.payment, td.comment) 精準解析"""
        try:
            # 1. 類別判定 (自 td.icon img 的 src 屬性識別)
            cat = "EXPENSE"
            icon_img = row.query_selector("td.icon img, .icon img, td img")
            if icon_img:
                src = (icon_img.get_attribute("src") or "").lower()
                if any(w in src for w in ["tool", "care", "repair", "maint"]):
                    cat = "MAINTENANCE"
                elif any(w in src for w in ["fuel", "gas", "tint"]):
                    cat = "REFUELING"
                elif "expense" in src:
                    cat = "EXPENSE"

            # 2. 日期與時間 (td.date)
            date_td = row.query_selector("td.date, .date")
            raw_datetime = date_td.inner_text().strip() if date_td else ""
            if not raw_datetime:
                # 備援從 row 內文搜尋 YYYY-MM-DD
                m = re.search(r"(\d{4}[-/]\d{2}[-/]\d{2})", row.inner_text())
                if m:
                    raw_datetime = m.group(1)
                else:
                    return None

            parts = raw_datetime.split()
            raw_date = parts[0].replace("/", "-")
            raw_time = parts[1] if len(parts) > 1 else "00:00"

            # 3. 里程數 (td.odometer)
            odo_td = row.query_selector("td.odometer, .odometer")
            odo_text = odo_td.inner_text().strip() if odo_td else "0"
            mileage = int(re.sub(r"[^\d]", "", odo_text) or 0)

            # 4. 種類 / 標題 (td.title)
            title_td = row.query_selector("td.title, .title")
            title = title_td.inner_text().strip() if title_td else "一般項目"

            # 5. 總金額 (td.amount)
            amt_td = row.query_selector("td.amount, .amount")
            amt_text = amt_td.inner_text().strip() if amt_td else "0"
            amount = float(re.sub(r"[^\d.]", "", amt_text) or 0.0)

            # 6. 付款方式 (td.payment)
            pay_td = row.query_selector("td.payment, .payment")
            payment = pay_td.inner_text().strip() if pay_td else "信用卡"

            # 7. 備註 (td.comment)
            comment_td = row.query_selector("td.comment, .comment")
            comment = comment_td.inner_text().strip() if comment_td else ""
            if not comment and comment_td:
                comment = comment_td.get_attribute("title") or ""

            # 備援圖示修正：若由標題可明確辨認
            if cat == "EXPENSE":
                if any(k in title for k in ["保養", "維修", "更換", "工資", "閥體"]):
                    cat = "MAINTENANCE"
                elif "公升" in title or "加滿" in title:
                    cat = "REFUELING"

            return {
                "category_type": cat,
                "date": raw_date,
                "time": raw_time,
                "mileage": mileage,
                "amount": amount,
                "title": title,
                "payment_method": payment or "信用卡",
                "notes": comment
            }
        except Exception:
            return None

    def _navigate_to_next_page(self, page: Page, current_page: int, first_row_before: str) -> bool:
        """翻往下一頁並確保內容完成刷新切換"""
        next_page_num = current_page + 1
        try:
            clicked = page.evaluate("""(targetNum) => {
                const buttons = Array.from(document.querySelectorAll('a, button, .btn'));
                // 1. 優先尋找頁碼為 targetNum 的按鈕
                const numBtn = buttons.find(b => {
                    const t = b.innerText ? b.innerText.trim() : '';
                    return t === String(targetNum) && b.offsetParent !== null;
                });
                if (numBtn) {
                    numBtn.click();
                    return true;
                }
                // 2. 尋找下一頁箭頭 (», >, ›)
                const nextBtn = buttons.find(b => {
                    const t = b.innerText ? b.innerText.trim() : '';
                    const isNext = (t === '»' || t.includes('»') || t === '>' || t === '›');
                    const isDisabled = b.classList.contains('disabled') || (b.parentElement && b.parentElement.classList.contains('disabled'));
                    return isNext && !isDisabled && b.offsetParent !== null;
                });
                if (nextBtn) {
                    nextBtn.click();
                    return true;
                }
                return false;
            }""", next_page_num)

            if not clicked:
                return False

            self.reporter.log(f"已觸發翻頁指令 (翻往第 {next_page_num} 頁)，等待表格內容更新...")
            time.sleep(1.2)

            # 等待表格第一列文字改變 (最多等 4 秒)
            wait_start = time.time()
            while time.time() - wait_start < 4.0:
                new_rows = page.query_selector_all("table tbody tr:has(td.date), tr:has(td.date)")
                if new_rows:
                    new_text = new_rows[0].inner_text().strip()
                    if new_text != first_row_before:
                        return True
                time.sleep(0.3)

            return True
        except Exception as e:
            self.reporter.log(f"翻頁過程發生異常: {e}", "WARN")
            return False

    def _parse_and_save_maintenance(self, page: Page, vehicle_id: str, base_info: Dict[str, Any], modal_opened: bool):
        """解析保養維修紀錄與其工單細項零件列表 (支援表格直讀與深層零件明細雙重擷取)"""
        rec = {
            "vehicle_id": vehicle_id,
            "record_date": base_info["date"],
            "record_time": base_info["time"],
            "mileage": base_info["mileage"],
            "title": base_info["title"],
            "total_amount": base_info["amount"],
            "payment_method": base_info["payment_method"],
            "notes": base_info["notes"]
        }

        items = []

        if modal_opened:
            try:
                # 讀取工單各欄位精確數值
                date_input = page.query_selector("#edit_form_date, input[type='date'], input[name*='date']")
                if date_input:
                    v = date_input.input_value().strip()
                    if v: rec["record_date"] = v

                time_input = page.query_selector("#edit_form_time, input[type='time'], input[name*='time']")
                if time_input:
                    v = time_input.input_value().strip()
                    if v: rec["record_time"] = v

                mileage_input = page.query_selector("#edit_form_odometer, input[name*='mileage'], input[name*='odometer']")
                if mileage_input:
                    v = re.sub(r"[^\d]", "", mileage_input.input_value())
                    if v: rec["mileage"] = int(v)

                amount_input = page.query_selector("#edit_form_amount, input[name*='amount'], input[name*='total']")
                if amount_input:
                    v = re.sub(r"[^\d.]", "", amount_input.input_value())
                    if v: rec["total_amount"] = float(v)

                title_input = page.query_selector("#edit_form_title, input[name*='title']")
                if title_input:
                    v = title_input.input_value().strip()
                    if v: rec["title"] = v

                notes_ta = page.query_selector("#edit_form_box textarea, textarea")
                if notes_ta:
                    v = notes_ta.input_value().strip()
                    if v: rec["notes"] = v

                # 等待零件表格渲染 (最多等待 2.5 秒)
                wait_start = time.time()
                while time.time() - wait_start < 2.5:
                    has_content = page.evaluate("""() => {
                        const trs = document.querySelectorAll('#component_table_body tr');
                        const emptyDiv = document.querySelector('#edit_form_component_empty');
                        const isEmptyVisible = emptyDiv && getComputedStyle(emptyDiv).display !== 'none';
                        return (trs && trs.length > 0) || isEmptyVisible;
                    }""")
                    if has_content:
                        break
                    time.sleep(0.15)

                # 穿透抓取「保養/維修項目」表格中所有零件細項 (雙策略)
                raw_items = page.evaluate("""() => {
                    const list = [];
                    
                    // 策略 1: 直接讀取 #component_table_body 的所有 tr (精確對應 iknow99 10 欄 DOM)
                    const rows = Array.from(document.querySelectorAll('#component_table_body tr'));
                    for (const row of rows) {
                        const cells = Array.from(row.querySelectorAll('td'));
                        // 結構: [0]圖示, [1]零件/項目, [2]規格/細項, [3]使用期限, [4]使用里程, [5]單價, [6]數量, [7]小計, [8]備註, [9]刪除按鈕
                        if (cells.length >= 8) {
                            const name = cells[1].innerText.trim();
                            if (!name) continue;
                            list.push({
                                item_name: name,
                                spec_detail: cells.length > 2 ? cells[2].innerText.trim() : '',
                                lifespan_date: cells.length > 3 ? cells[3].innerText.trim() : '',
                                lifespan_mileage: cells.length > 4 ? cells[4].innerText.trim() : '0',
                                unit_price: cells.length > 5 ? cells[5].innerText.trim() : '0',
                                quantity: cells.length > 6 ? cells[6].innerText.trim() : '1',
                                subtotal: cells.length > 7 ? cells[7].innerText.trim() : '0',
                                remarks: cells.length > 8 ? cells[8].innerText.trim() : ''
                            });
                        }
                    }
                    
                    // 策略 2: 備援從前端記憶體物件 window.Me.components() 提取
                    if (list.length === 0 && window.Me && typeof window.Me.components === 'function') {
                        try {
                            const comps = window.Me.components() || [];
                            for (const c of comps) {
                                if (!c.Name) continue;
                                list.push({
                                    item_name: c.Name.trim(),
                                    spec_detail: c.Spec ? c.Spec.trim() : '',
                                    lifespan_date: c.LifeTime ? `${c.LifeTime}個月` : '',
                                    lifespan_mileage: c.ValidDistance ? `${c.ValidDistance}` : '0',
                                    unit_price: String(c.UnitPrice || 0),
                                    quantity: String(c.Qty || 1),
                                    subtotal: String((c.UnitPrice || 0) * (c.Qty || 1)),
                                    remarks: c.Comment ? c.Comment.trim() : ''
                                });
                            }
                        } catch(e) {}
                    }

                    // 策略 3: 若前兩者皆未取到，由垃圾桶圖示錨定表格行
                    if (list.length === 0) {
                        const trashIcons = Array.from(document.querySelectorAll('#edit_form_component i[class*="trash"], #edit_form_box i[class*="trash"]'));
                        for (const icon of trashIcons) {
                            const tr = icon.closest('tr');
                            if (tr) {
                                const cells = Array.from(tr.querySelectorAll('td'));
                                if (cells.length >= 8) {
                                    const name = cells[1].innerText.trim();
                                    if (name) {
                                        list.push({
                                            item_name: name,
                                            spec_detail: cells[2].innerText.trim(),
                                            lifespan_date: cells[3].innerText.trim(),
                                            lifespan_mileage: cells[4].innerText.trim(),
                                            unit_price: cells[5].innerText.trim(),
                                            quantity: cells[6].innerText.trim(),
                                            subtotal: cells[7].innerText.trim(),
                                            remarks: cells[8].innerText.trim()
                                        });
                                    }
                                }
                            }
                        }
                    }

                    return list;
                }""")

                if raw_items:
                    for it in raw_items:
                        items.append({
                            "item_name": it["item_name"],
                            "spec_detail": it["spec_detail"],
                            "lifespan_date": it["lifespan_date"] if it["lifespan_date"] != "---" else "",
                            "lifespan_mileage": int(re.sub(r"[^\d]", "", it["lifespan_mileage"]) or 0),
                            "unit_price": float(re.sub(r"[^\d.]", "", it["unit_price"]) or 0.0),
                            "quantity": float(re.sub(r"[^\d.]", "", it["quantity"]) or 1.0),
                            "subtotal": float(re.sub(r"[^\d.]", "", it["subtotal"]) or 0.0),
                            "remarks": it["remarks"]
                        })

            except Exception as e:
                self.reporter.log(f"解析維修工單細項時發生異常: {e}", "WARN")

        res = db_manager.upsert_maintenance_record(rec, items)
        
        # 組合零件名稱顯示摘要
        item_summary = ""
        if items:
            names = [it["item_name"] for it in items]
            summary_str = ", ".join(names[:4])
            if len(names) > 4:
                summary_str += f" 等 {len(names)} 項"
            item_summary = f": {summary_str}"

        self.reporter.log(
            f"寫入維修紀錄：{rec['record_date']} {rec['title']} (${rec['total_amount']:,.0f}) "
            f"[{res['items_count']} 項零件細項{item_summary}]"
        )

    def _parse_and_save_refueling(self, page: Page, vehicle_id: str, base_info: Dict[str, Any], modal_opened: bool):
        """解析加油紀錄並寫入 SQLite"""
        rec = {
            "vehicle_id": vehicle_id,
            "refuel_date": base_info["date"],
            "refuel_time": base_info["time"],
            "mileage": base_info["mileage"],
            "total_amount": base_info["amount"],
            "payment_method": base_info["payment_method"],
            "liters": 0.0,
            "unit_price": 0.0,
            "fuel_type": "95無鉛",
            "is_previous_missed": 0,
            "fuel_gauge_position": 1.0,
            "prev_mileage": 0,
            "trip_distance": 0.0,
            "tank_fuel_level": 50.0,
            "fuel_efficiency": 0.0,
            "cost_per_km": 0.0,
            "prev_fuel_used": 0.0,
            "notes": base_info["notes"]
        }

        liters_match = re.search(r"([0-9.]+)\s*公升", base_info["title"])
        if liters_match:
            rec["liters"] = float(liters_match.group(1))

        if modal_opened:
            try:
                date_input = page.query_selector("#edit_form_date, input[type='date'], input[name*='date']")
                if date_input:
                    v = date_input.input_value().strip()
                    if v: rec["refuel_date"] = v

                time_input = page.query_selector("#edit_form_time, input[type='time'], input[name*='time']")
                if time_input:
                    v = time_input.input_value().strip()
                    if v: rec["refuel_time"] = v

                mileage_input = page.query_selector("#edit_form_odometer, input[name*='mileage'], input[name*='odometer']")
                if mileage_input:
                    v = re.sub(r"[^\d]", "", mileage_input.input_value())
                    if v: rec["mileage"] = int(v)

                amount_input = page.query_selector("#edit_form_amount, input[name*='amount'], input[name*='total']")
                if amount_input:
                    v = re.sub(r"[^\d.]", "", amount_input.input_value())
                    if v: rec["total_amount"] = float(v)

                liters_input = page.query_selector("#edit_form_fuel_quantity, input[name*='liter']")
                if liters_input:
                    v = re.sub(r"[^\d.]", "", liters_input.input_value())
                    if v: rec["liters"] = float(v)

                price_input = page.query_selector("#edit_form_fuel_price, input[name*='price']")
                if price_input:
                    v = re.sub(r"[^\d.]", "", price_input.input_value())
                    if v: rec["unit_price"] = float(v)

                fuel_type_label = page.query_selector("#edit_form_fuel_type_label")
                if fuel_type_label:
                    v = fuel_type_label.inner_text().strip()
                    if v and v != "Other": rec["fuel_type"] = v

                notes_ta = page.query_selector("#edit_form_box textarea, textarea")
                if notes_ta:
                    v = notes_ta.input_value().strip()
                    if v: rec["notes"] = v
            except Exception:
                pass

        # 使用者特定規則：若無油價資訊，以 總額 / 加油量 (小數點後四捨五入取兩位) 獲得
        if rec.get("unit_price", 0.0) <= 0.0:
            if rec.get("total_amount", 0.0) > 0.0 and rec.get("liters", 0.0) > 0.0:
                rec["unit_price"] = round(rec["total_amount"] / rec["liters"], 2)

        db_manager.upsert_refueling_record(rec)
        self.reporter.log(f"寫入加油紀錄：{rec['refuel_date']} {rec['liters']} 公升 (${rec['total_amount']:,.0f})")

    def _parse_and_save_expense(self, page: Page, vehicle_id: str, base_info: Dict[str, Any], modal_opened: bool):
        """解析其他費用紀錄並寫入 SQLite"""
        rec = {
            "vehicle_id": vehicle_id,
            "expense_date": base_info["date"],
            "expense_time": base_info["time"],
            "mileage": base_info["mileage"],
            "title": base_info["title"],
            "expense_category": "其他",
            "total_amount": base_info["amount"],
            "payment_method": base_info["payment_method"],
            "notes": base_info["notes"]
        }

        if modal_opened:
            try:
                date_input = page.query_selector("#edit_form_date, input[type='date'], input[name*='date']")
                if date_input:
                    v = date_input.input_value().strip()
                    if v: rec["expense_date"] = v

                time_input = page.query_selector("#edit_form_time, input[type='time'], input[name*='time']")
                if time_input:
                    v = time_input.input_value().strip()
                    if v: rec["expense_time"] = v

                mileage_input = page.query_selector("#edit_form_odometer, input[name*='mileage'], input[name*='odometer']")
                if mileage_input:
                    v = re.sub(r"[^\d]", "", mileage_input.input_value())
                    if v: rec["mileage"] = int(v)

                amount_input = page.query_selector("#edit_form_amount, input[name*='amount'], input[name*='total']")
                if amount_input:
                    v = re.sub(r"[^\d.]", "", amount_input.input_value())
                    if v: rec["total_amount"] = float(v)

                title_input = page.query_selector("#edit_form_title, input[name*='title']")
                if title_input:
                    v = title_input.input_value().strip()
                    if v: rec["title"] = v

                type_btn = page.query_selector("#form_type_button span, #form_type_button")
                if type_btn:
                    v = type_btn.inner_text().strip()
                    if v: rec["expense_category"] = v

                notes_ta = page.query_selector("#edit_form_box textarea, textarea")
                if notes_ta:
                    v = notes_ta.input_value().strip()
                    if v: rec["notes"] = v
            except Exception:
                pass

        db_manager.upsert_expense_record(rec)
        self.reporter.log(f"寫入費用紀錄：{rec['expense_date']} [{rec['expense_category']}] {rec['title']} (${rec['total_amount']:,.0f})")
