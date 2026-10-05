# team-taiwan-results

綜合運動會（亞運、亞室武運、南美運動會等）的**國家隊賽程與賽果追蹤頁**。
GitHub Actions 每 30 分鐘向官方成績系統同步一次，產生純靜態網站發布到 GitHub Pages：不需要伺服器、不需要資料庫，也不用付費。

網站：<https://keanu77.github.io/team-taiwan-results/>（首頁列出所有賽事，例如 [2026 愛知・名古屋亞運](https://keanu77.github.io/team-taiwan-results/ag2026/)）

一個 repo 可以同時放多個賽事，每個賽事有自己的網址。只想看賽果的人直接開連結就好，不需要複製任何東西。

- 依運動項目分組的當日／整個賽期賽程與比分，支援中英文選手搜尋
- 本隊累計獎牌、得牌選手、各國獎牌排行榜
- 選手中文姓名、項目中文名稱對照（CSV 名單）
- 手機版、夜間模式、字級調整

> 本專案與任何賽會主辦單位或成績系統廠商無關，資料以官方公告為準。

## 運作方式

```
GitHub Actions（每 30 分鐘）
  └─ npm run sync ── 讀官方成績 API ──▶ data 分支（JSON 快照，失敗時保留上一份）
  └─ npm run build ─ CSV 名單＋快照 ──▶ GitHub Pages（靜態網站，瀏覽器每分鐘重讀）
```

- 只有**比賽前兩天到閉幕後三天**會真的去抓官網；其他時間排程會直接跳過。
- 官網連線失敗時保留最後一次成功的資料，並暫停 30 分鐘再試，不會連續重試。
- 同步資料放在獨立的 `data` 分支（每個賽事一個資料夾），`main` 的歷史不會被洗版。

## 目錄結構

```
events/
  ag2026/                      ← 賽事代號＝網址路徑（小寫英數字與減號）
    competition.config.json    ← 賽事設定
    rosters/                   ← 中文對照名單（選填）
      athletes.csv
      event-names.csv
      team-medals.csv
    results/manual.csv         ← 只有手動成績模式需要
templates/                     ← 空白範本
```

## 想追蹤新的賽事？

- **請維護者加進這個網站**：開一個 [issue](https://github.com/keanu77/team-taiwan-results/issues)，附上賽事名稱、日期、官方成績網站網址，以及要追蹤的代表隊。
- **自己架一份**（追蹤其他國家、小型賽事，或想自己管理）：照下面的步驟。

## 用在新的賽事

### 1. 複製 repo（自己架才需要）

按右上角 **Use this template**（或 Fork）建立自己的 repo。只追蹤一個賽事的話，可以刪掉不要的 `events/` 資料夾；只剩一個賽事時，首頁會直接轉到那個賽事。

### 2. 新增賽事資料夾

把 `events/ag2026/` 整個複製成 `events/<新代號>/`（例如 `events/aimag2026/`），代號就是網址路徑。全部可以在 GitHub 網頁上完成：新增檔案時，檔名輸入 `events/aimag2026/competition.config.json` 就會自動建立資料夾。

然後修改裡面的 `competition.config.json`：

| 欄位 | 說明 | 範例 |
|---|---|---|
| `name` | 賽事名稱（顯示在頁首） | `2026 愛知・名古屋亞運` |
| `startDate` / `endDate` | 比賽期間，主辦地日期 | `2026-09-10` |
| `timeZone` / `timeZoneLabel` | 主辦地時區（[IANA 名稱](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)）與顯示名稱 | `Asia/Tokyo`、`日本` |
| `viewerTimeZone` / `viewerTimeZoneLabel` | 觀眾所在時區，展開場次時並列顯示 | `Asia/Taipei`、`台灣` |
| `team.noc` | 追蹤的代表隊三碼代碼 | `TPE` |
| `team.label` | 代表隊中文名稱 | `中華台北` |
| `team.aliases` | 官方資料中代表隊可能出現的全名，顯示時換成代碼 | `["Chinese Taipei", "中華台北"]` |
| `source.type` | `bornan`（自動同步）或 `manual`（手動 CSV） | `bornan` |
| `source.code` | 賽事代碼，官方 API 網址裡的那一段 | `AG2026` |
| `source.apiBase` | 官方成績 API 根網址（只有 bornan 需要） | `https://back.results.asiangames2026.org/s/AG2026/en` |
| `source.webUrl` | 官方成績網站，頁面上的「官方成績網站」連結 | `https://results.asiangames2026.org` |
| `syncIntervalMinutes` | 當日賽果的同步間隔（15–1440） | `30` |
| `teamMedals.source` / `updatedAt` | 代表團得牌明細的來源與更新時間（顯示用） | |

設定寫錯時，`npm run build` 與同步會直接失敗並指出是哪個欄位。

### 3. 準備名單（選填，但建議）

官方資料只有英文。把中文對照填進該賽事 `rosters/` 的三個 CSV（可以從 `templates/` 複製只有一列範例的空白版）：

| 檔案 | 用途 | 欄位 |
|---|---|---|
| `rosters/athletes.csv` | 選手中文姓名 | `discipline`（三碼項目代碼，如 ATH）、`english_name`（與官方寫法完全相同）、`chinese_name`、`registration_id`（選填，官方報名編號，同名時用來區分）、`identity_group`（選填） |
| `rosters/event-names.csv` | 內建字典翻不出來的項目名稱 | `english`（官方完整項目名）、`chinese` |
| `rosters/team-medals.csv` | 代表團公布的得牌明細（補中文項目名與團體隊員） | `medal`（金／銀／銅）、`date`、`sport`、`event`、`athletes`（多人用「、」分隔） |

用 Excel 編輯的話，存檔時選 **CSV UTF-8**，中文才不會變亂碼。

中華奧會的「代表團成績公布總表」PDF 可以直接轉成 `team-medals.csv`（需要 [poppler](https://poppler.freedesktop.org/) 的 `pdftotext`）：

```bash
EVENT=ag2026 npm run import-medal-pdf -- 總表.pdf --dry-run   # 先看解析結果
EVENT=ag2026 npm run import-medal-pdf -- 總表.pdf             # 寫入該賽事的 CSV 並更新 config 的 teamMedals
```

PDF 版面一改就可能解析失敗（失敗時不會寫入任何東西），那時改成手動編輯 CSV。

### 4. 開啟 GitHub Pages 與 Actions

1. repo 的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
2. 到 **Actions** 分頁按啟用。Fork 的 repo 預設停用排程，沒啟用就不會自動更新。
3. **Actions → 同步成績並發布 → Run workflow** 手動跑第一次。完成後網址會出現在 workflow 的 deploy 步驟。

### 5. 注意

- 每個賽事的同步資料存在 `data` 分支的 `<代號>/` 資料夾。**不要把舊賽事的資料夾改設定成新賽事**，請另開新代號；同步程式偵測到資料夾裡是另一個賽事代碼的資料時會停下來提醒。
- 賽事結束後資料夾可以一直留著，網站會保留成封存頁，同步程式不會再去打官網。
- 要下架某個賽事，刪掉 `events/<代號>/` 即可。

## 成績來源

### `bornan`：自動同步

[Bornan Sports Technology](https://bornan.sport/) 承包了多個綜合賽會的成績系統（2026 亞運、2026 亞洲室內暨武藝運動會、2026 南美運動會等）。程式是依 2026 亞運的 API 寫的，**其他賽事是否完全相容尚未驗證**；新賽事開打前請先手動跑一次 workflow 確認。

找 `apiBase` 的方法：用電腦瀏覽器打開官方成績網站，按 F12 開「網路（Network）」分頁，重新整理後找網址像 `https://back.results.<網域>/s/<賽事代碼>/en/...` 的請求，取到 `/en` 為止。

### `manual`：手動 CSV

官網不是 Bornan 系統、或 API 不相容時，把 `source.type` 改成 `manual`，成績填在該賽事的 `events/<代號>/results/manual.csv`（格式見 `templates/manual.csv`），push 後就會發布。每列是一場比賽中的一位（或一隊）參賽者：

| 欄位 | 必填 | 說明 |
|---|---|---|
| `unit_id` | ✓ | 場次代號，自己取，同一場的每列要相同（英數字、`.`、`_`、`-`） |
| `date` | ✓ | 比賽日期（主辦地） |
| `time` | | `HH:MM`，主辦地時間；空白顯示「時間待定」 |
| `sport` / `event` | ✓ | 運動種類、項目，例如 `羽球`、`男子單打` |
| `phase` / `venue` | | 階段、場館 |
| `status` | ✓ | `未開賽`、`進行中`、`非正式成績`、`正式成績`、`延賽`、`取消`… |
| `name` / `organisation` | ✓ | 選手或隊伍名稱、三碼代表隊代碼 |
| `result` / `rank` | | 成績、名次 |
| `medal` | | `金`／`銀`／`銅` |
| `outcome` | | 對戰結果 `勝`／`負`／`和` |

同一場剛好兩位不同代表隊的參賽者時，會以對戰形式顯示。手動模式不顯示各國獎牌排行榜。

## 本機開發

需要 Node.js 22 以上。

需要指定賽事的指令用 `EVENT=<代號>`；不指定時用 `events/` 底下第一個賽事。

```bash
npm install
EVENT=ag2026 npm run dev     # http://localhost:3000（沒有同步資料時顯示空白狀態）
EVENT=ag2026 npm run sync    # 向官方同步這個賽事一輪，資料寫到 data/ag2026/
npm run sync:all             # 依序同步所有賽事（GitHub Actions 用這個）
npm test                     # 單元測試
npm run typecheck
npm run build:site           # 整個網站（所有賽事＋首頁）輸出到 site/
```

## 注意事項

- **GitHub 排程不準時**：尖峰時可能延遲 5–15 分鐘，偶爾會跳過一輪。需要分秒必爭的即時比分請看官網。
- **repo 60 天沒有任何 commit，GitHub 會自動停用排程**。賽事開始前記得確認 Actions 是開啟的。
- **請尊重官網**：同步程式每秒最多送 1 個請求、30 分鐘一輪，失敗會自動冷卻。請不要把間隔調得更短，也請遵守各賽會成績網站的使用條款。
- 公開版**不附國旗圖**（官方圖檔有版權疑慮），獎牌榜只顯示代碼與國名。
- `rosters/` 內附的 2026 亞運中華台北選手中英文對照與得牌明細，取自官方公開名單與中華奧會公布的總表，作為範例格式。

## 授權

程式碼採 [MIT License](LICENSE)。成績資料的權利屬於各賽會與官方成績系統。
