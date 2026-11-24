# [DOCUMENTATION_OUTPUT_RULES]

## 1. 文檔存放路徑規範
- 凡是為本專案生成的 `task`、`implementation_plan`、`walkthrough` 或相關規格、分析與設計文檔，**必須統一存放在 `DocumentsAndInformations/` 目錄下**。
- 若 `DocumentsAndInformations/` 目錄不存在，生成檔案時必須自動建立。

## 2. 檔名時間戳記格式
- 檔案命名必須加上生成當下的時間戳記（西元年月日與時分秒，格式：`YYYYMMDDHHmmss`）。
- **命名格式**：`{{TYPE}}_{{TIMESTAMP}}.md`
- **範例**：
  - `Implementation_plan_20261124103946.md`
  - `Task_20261124103946.md`
  - `Walkthrough_20261124103946.md`

## 3. 元數據與備份協同
- 產生上述檔案時，必須同時遵循以下規範：
  - 於同目錄生成對應的 `{{FILE_NAME}}.metadata.json`，記錄 `file_name`、`version`、`author` 與 `last_modified`。
  - 文件作者/製作資訊統一標註為 `Office of William`。
  - 若修改既有 `.md` 檔案，需於 `.backups/` 目錄建立備份檔 `{{FILE_NAME}}_{{TIMESTAMP}}.bak`。
