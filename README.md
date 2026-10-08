# team-taiwan-results

綜合運動會（亞運、亞室武運、南美運動會等）的**國家隊賽程與賽果追蹤頁**。
GitHub Actions 定時向官方成績系統同步（預設每 30 分鐘，可調到 10 分鐘），產生純靜態網站發布到 Cloudflare Pages：不需要伺服器、不需要資料庫，也不用付費。

網站：<https://tpe.sportsmedicine.tw/>（首頁列出所有賽事，例如 [2026 愛知・名古屋亞運](https://tpe.sportsmedicine.tw/ag2026/)；舊網址 keanu77.github.io/team-taiwan-results 會自動轉過來）

一個 repo 可以同時放多個賽事，每個賽事有自己的網址。只想看賽果的人直接開連結就好，不需要複製任何東西。

- 依運動項目分組的當日／整個賽期賽程與比分，支援中英文選手搜尋
- 本隊累計獎牌、得牌選手、各國獎牌排行榜
- 選手中文姓名、項目中文名稱對照（CSV 名單）
- 手機版、夜間模式、字級調整

> 本專案與任何賽會主辦單位或成績系統廠商無關，資料以官方公告為準。

## 運作方式

```
GitHub Actions（排程每 10 分鐘一輪，各賽事依 syncIntervalMinutes 決定實際多久抓一次）
  └─ npm run sync ── 讀官方成績 API ──▶ data 分支（JSON 快照，失敗時保留上一份）
  └─ npm run build ─ CSV 名單＋快照 ──▶ Cloudflare Pages（靜態網站，瀏覽器每分鐘重讀）
```

- 只有**比賽前兩天到閉幕後三天**會真的去抓官網；其他時間排程會直接跳過。
- 官網連線失敗時保留最後一次成功的資料，並暫停一個同步間隔再試，不會連續重試。
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
      countries.csv            ← 內建國名表沒有的代表隊（選填）
    results/manual.csv         ← 只有手動成績模式需要
templates/                     ← 空白範本
```

## 想追蹤新的賽事？

- **請維護者加進這個網站**：用「[新增賽事](https://github.com/keanu77/team-taiwan-results/issues/new?template=new-event.yml)」表單開 issue。維護者確認後貼上「建立賽事」標籤，系統會自動建立賽事資料夾並開 PR，合併後就上線。
- **自己架一份**（追蹤其他國家、小型賽事，或想自己管理）：照下面的步驟。

## 用在新的賽事

### 1. 複製 repo（自己架才需要）

按右上角 **Use this template**（或 Fork）建立自己的 repo。只追蹤一個賽事的話，可以刪掉不要的 `events/` 資料夾；只剩一個賽事時，首頁會直接轉到那個賽事。

### 2. 新增賽事資料夾

三種方式擇一，代號（資料夾名稱）就是網址路徑：

- **Issue 表單**（不用寫程式）：見上方「請維護者加進這個網站」；自己架的 repo 也能用，需先到 **Settings → Actions → General** 勾選「Allow GitHub Actions to create and approve pull requests」，並建立「建立賽事」標籤。
- **指令**：
  ```bash
  npm run new-event -- --id aimag2026 --name "2026 利雅德亞洲室內暨武藝運動會" \
    --start 2026-11-12 --end 2026-11-21 --tz Asia/Riyadh --tz-label 沙烏地 \
    --noc TPE --label 中華隊 --source manual --web-url https://<官方成績網站>
  ```
  會建立設定檔與只有表頭的空白名單，並先做格式檢查。`bornan` 另加 `--api-base`，`sheet` 另加 `--csv-url`。
- **GitHub 網頁**：新增檔案時，檔名輸入 `events/aimag2026/competition.config.json` 就會自動建立資料夾，內容照下表填。

> ⚠️ **不要整個複製 `events/ag2026/`**：裡面的名單是 2026 亞運的。得牌日期超出新賽期時建置會失敗並提醒，但選手對照不會被擋下。

`competition.config.json` 欄位：

| 欄位 | 說明 | 範例 |
|---|---|---|
| `name` | 賽事名稱（顯示在頁首） | `2026 愛知・名古屋亞運` |
| `startDate` / `endDate` | 比賽期間，主辦地日期 | `2026-09-10` |
| `timeZone` / `timeZoneLabel` | 主辦地時區（[IANA 名稱](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)）與顯示名稱 | `Asia/Tokyo`、`日本` |
| `viewerTimeZone` / `viewerTimeZoneLabel` | 觀眾所在時區，展開場次時並列顯示 | `Asia/Taipei`、`台灣` |
| `team.noc` | 追蹤的代表隊三碼代碼 | `TPE` |
| `team.label` | 代表隊中文名稱（網站上顯示的名字） | `中華隊` |
| `team.aliases` | 官方資料中代表隊可能出現的全名，顯示時換成代碼 | `["Chinese Taipei", "中華台北"]` |
| `source.type` | `bornan`（自動同步）、`manual`（手動 CSV）或 `sheet`（Google 試算表），見下方「成績來源」 | `bornan` |
| `source.code` | 賽事代碼，2–20 碼大寫英數字。bornan 要與官方 API 網址裡的那一段相同；其他來源自取 | `AG2026` |
| `source.apiBase` | 官方成績 API 根網址（只有 bornan 需要） | `https://back.results.asiangames2026.org/s/AG2026/en` |
| `source.csvUrl` | 試算表「發布到網路」的 CSV 網址（只有 sheet 需要） | `https://docs.google.com/spreadsheets/d/e/…/pub?output=csv` |
| `source.webUrl` | 官方成績網站，頁面上的「官方成績網站」連結 | `https://results.asiangames2026.org` |
| `syncIntervalMinutes` | 當日賽果與獎牌榜多久重抓一次（10–1440）。預設 30；低於 30 要搭配下方的外部觸發才會準時 | `30` |
| `teamMedals.source` / `updatedAt`（選填） | 代表團得牌明細的來源與更新時間，顯示在獎牌明細下方；整段可省略 | `中華奧會代表團成績公布總表`、`2026-09-29T23:00:00+08:00` |

設定寫錯時，`npm run build` 與同步會直接失敗並指出是哪個欄位。

### 3. 準備名單（選填，但建議）

官方資料只有英文。把中文對照填進該賽事 `rosters/` 的 CSV（`npm run new-event` 會建好空白表頭；`templates/` 有各附一列範例的版本）：

| 檔案 | 用途 | 欄位 |
|---|---|---|
| `rosters/athletes.csv` | 選手中文姓名 | `discipline`（三碼項目代碼，如 ATH）、`english_name`（與官方寫法完全相同）、`chinese_name`、`registration_id`（選填，官方報名編號，同名時用來區分）、`identity_group`（選填） |
| `rosters/event-names.csv` | 內建字典翻不出來的項目名稱 | `english`（官方完整項目名）、`chinese` |
| `rosters/team-medals.csv` | 代表團公布的得牌明細（補中文項目名與團體隊員） | `medal`（金／銀／銅）、`date`（須在賽期內）、`sport`、`event`、`athletes`（多人用「、」分隔） |
| `rosters/countries.csv` | 內建國名表（亞運代表隊）沒有的國家；沒填只顯示三碼代碼 | `code`（三碼）、`chinese`、`english` |

用 Excel 編輯的話，存檔時選 **CSV UTF-8**，中文才不會變亂碼。

中華奧會的「代表團成績公布總表」PDF 可以直接轉成 `team-medals.csv`（需要 [poppler](https://poppler.freedesktop.org/) 的 `pdftotext`）：

```bash
EVENT=ag2026 npm run import-medal-pdf -- 總表.pdf --dry-run   # 先看解析結果
EVENT=ag2026 npm run import-medal-pdf -- 總表.pdf             # 寫入該賽事的 CSV 並更新 config 的 teamMedals
```

PDF 版面一改就可能解析失敗（失敗時不會寫入任何東西），那時改成手動編輯 CSV。

### 4. 設定 Cloudflare Pages 與 Actions

網站放在 Cloudflare Pages（免費方案即可）。GitHub Pages 從台灣連線每個檔案要等 0.5–1.5 秒、剛發布的檔案最慢 8 秒，且所有檔案只能快取 10 分鐘，所以改用 Cloudflare。

1. 建立 Pages 專案（一次即可，名稱要與 `.github/workflows/sync-and-deploy.yml` 的 `--project-name` 相同）：
   ```bash
   npx wrangler pages project create team-taiwan-results --production-branch main
   ```
2. Cloudflare 後台 **My Profile → API Tokens → Create Custom Token**，權限只給 **Account → Cloudflare Pages → Edit**，Account Resources 選你的帳號。
3. 存成 repo secrets：`CLOUDFLARE_API_TOKEN`（上一步的 token）與 `CLOUDFLARE_ACCOUNT_ID`（Cloudflare 後台右側的 Account ID）。
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN
   gh secret set CLOUDFLARE_ACCOUNT_ID
   ```
4. 到 **Actions** 分頁按啟用。Fork 的 repo 預設停用排程，沒啟用就不會自動更新。
5. **Actions → 同步成績並發布 → Run workflow** 手動跑第一次，網站會出現在 `https://<專案名稱>.pages.dev/`。
6. 要用自己的網域：Pages 專案 → **Custom domains** 加上網域，DNS 的 CNAME 指到 `<專案名稱>.pages.dev`。

快取規則由建置時產生的 `site/_headers` 決定：帶雜湊的 JS／CSS 快取一年、資料檔依版本號快取一天、`index.json` 只快取 1 分鐘。

#### 賽期中要準時更新（選用，最快每 10 分鐘）

不做任何設定時，內建排程照樣會定期同步與發布，但 GitHub 的排程只是「盡量執行」：本 repo 在 2026-10-06～07 實測，常被降到 **3–6 小時才跑一次**。賽期外或已結束的賽事不受影響，不必處理。

賽期中需要準時更新，就由外部定時呼叫 workflow（等同按 Run workflow），內建排程保留當備援。外部觸發的間隔設成和該賽事的 `syncIntervalMinutes` 一樣（30 或 10 分鐘）；觸發比設定密只會多跑空 workflow，不會更快。任選一種，賽期結束後停用：

| 做法 | 設定 | 適合 |
|------|------|------|
| **常開的電腦**（Mac launchd／Linux cron） | 依間隔執行 `gh workflow run sync-and-deploy.yml -R <owner>/team-taiwan-results`；`gh auth login` 一次即可，不用另建 token | 手邊有不關機的機器（電腦關機或斷網時會停） |
| **cron-job.org** 等免費排程服務 | 依間隔 `POST https://api.github.com/repos/<owner>/team-taiwan-results/actions/workflows/sync-and-deploy.yml/dispatches`，body `{"ref":"main"}`，header `Authorization: Bearer <token>` | 沒有常開的機器 |
| **Cloudflare Workers** 排程觸發 | Worker 的 `scheduled()` 送上面同一個 POST，token 放 Worker secret | 想要雲端執行又不依賴第三方排程網站 |

- 第二、三種要用 **fine-grained PAT**，只授權這個 repo、權限只給 **Actions: Read and write**，並設到期日（賽期結束後）。
- 10 分鐘是下限。改成 10 分鐘時，當天賽程與獎牌榜對官網的請求會變成 3 倍（已是正式成績的場次不重抓），請先確認該賽會成績網站的使用條款。同步程式在賽期外會自己跳過，外部觸發忘了關也不會去打官網，只是多跑幾次空 workflow。

### 5. 注意

- 每個賽事的同步資料存在 `data` 分支的 `<代號>/` 資料夾。**不要把舊賽事的資料夾改設定成新賽事**，請另開新代號；同步程式偵測到資料夾裡是另一個賽事代碼的資料時會停下來，這時只要刪掉 `data` 分支裡那一個 `<代號>/` 資料夾，**不要刪整個分支**（其他賽事的資料也在裡面）。
- workflow 出現紅字時：sync 記錄裡有「同步失敗」是官網暫時讀不到（資料已保留，下一輪重試）；「格式不符」是設定或 CSV 寫錯，訊息會指出檔案、欄位與列號；「無法取得 data 分支」是 GitHub 暫時故障，本輪不發布、網站維持原樣。
- 賽事結束後資料夾可以一直留著，網站會保留成封存頁，同步程式不會再去打官網。
- 要下架某個賽事，刪掉 `events/<代號>/` 即可。

## 成績來源

### `bornan`：自動同步

[Bornan Sports Technology](https://bornan.sport/) 承包了多個綜合賽會的成績系統（2026 亞運、2026 亞洲室內暨武藝運動會、2026 南美運動會等）。程式是依 2026 亞運的 API 寫的，**其他賽事是否完全相容尚未驗證**；新賽事開打前請先手動跑一次 workflow 確認。

找 `apiBase` 的方法：用電腦瀏覽器打開官方成績網站，按 F12 開「網路（Network）」分頁，重新整理後找網址像 `https://back.results.<網域>/s/<賽事代碼>/en/...` 的請求，取到 `/en` 為止。

### 官網不是 Bornan 系統時怎麼辦？

依可靠度、維護成本與對官網的負擔，建議順序：

| 順序 | 做法 | 適合 | 代價與風險 |
|---|---|---|---|
| 1 | **`manual` 手動 CSV**（已支援） | 場次少、一兩個人維護 | 要有人更新，沒有即時比分；不打官網、沒有使用條款問題 |
| 2 | **`sheet` Google 試算表**（已支援） | 多人分工填成績、填寫的人不會用 GitHub | 試算表欄名被改就會同步失敗；成績列驟減一半以上會拒收，防止誤刪 |
| 3 | **新增一種官方 API 轉接器**（要寫程式） | 官方有穩定、允許程式讀取的 JSON API | 每個廠商要各寫一份解析與測試；要先確認官網使用條款 |
| 4 | **解析官網 HTML**（不建議） | 沒有 API、版面長期不變、條款允許 | 改版就壞、最容易被擋；最後手段 |

不要繞過登入、驗證碼或任何存取限制；官網條款禁止自動讀取時，請改用 1 或 2。

**寫新的 API 轉接器**：網頁只認得本 repo 自己的格式（`src/lib/results/types.ts` 的 `TpeResultUnit` 與 `medals.json`），廠商格式只需要在同步端轉換。

1. 在 `src/config-schema.ts` 的 `source` 加一種 `type` 與它需要的欄位。
2. 仿照 `src/lib/results/source.ts`（Bornan）寫 `fetchDay(date, previous)`，回傳 `TpeResultUnit[]`；有獎牌榜再寫一個回傳 `MedalStanding[]` 的函式。沿用 `readBornan` 的保護：只打白名單路徑、每秒最多 1 個請求、限制回應大小、不跟隨轉址。
3. 在 `scripts/sync.ts` 依 `type` 呼叫；排程、失敗保留上一份、冷卻都由 `src/lib/results/sync/run.ts` 處理，不用重寫。
4. 用真實回應存成 `tests/fixtures/` 寫測試，再用一場真實賽事手動跑一次 workflow 驗證。

### `sheet`：Google 試算表

1. 建一個試算表，第一列放 `templates/manual.csv` 的欄名（與手動 CSV 完全相同）。
2. **檔案 → 共用 → 發布到網路**，選要發布的工作表、格式選 **CSV**，複製產生的網址。
3. 設定 `"source": { "type": "sheet", "code": "<自取>", "webUrl": "<官方網站>", "csvUrl": "<剛剛的網址>" }`。

之後每輪排程都會讀一次（約每 10 分鐘，GitHub 排程常延遲），有變動才重新發布。只把編輯權限給需要填成績的人。

### `manual`：手動 CSV

成績填在該賽事的 `events/<代號>/results/manual.csv`（格式見 `templates/manual.csv`），push 後就會發布。每列是一場比賽中的一位（或一隊）參賽者：

| 欄位 | 必填 | 說明 |
|---|---|---|
| `unit_id` | ✓ | 場次代號，自己取，同一場的每列要相同（英數字、`.`、`_`、`-`） |
| `date` | ✓ | 比賽日期（主辦地） |
| `time` | | `HH:MM`，主辦地時間；官方只寫接在前一場之後的填 `接續前場`（可寫成 `09:30 接續前場`，時間只用來排序）；空白顯示「時間待定」 |
| `sport` / `event` | ✓ | 運動種類、項目，例如 `羽球`、`男子單打` |
| `phase` / `venue` | | 階段、場館 |
| `status` | ✓ | `未開賽`、`進行中`、`非正式成績`、`正式成績`、`延賽`、`取消`… |
| `name` / `organisation` | ✓ | 選手或隊伍名稱、三碼代表隊代碼 |
| `result` / `rank` | | 成績、名次 |
| `medal` | | `金`／`銀`／`銅` |
| `outcome` | | 對戰結果 `勝`／`負`／`和` |
| `discipline` | | 三碼項目代碼（例如 `BDM`），決定分組；不填就用 `sport` 名稱分組 |

同一場剛好兩位不同代表隊的參賽者時，會以對戰形式顯示。手動與試算表模式不顯示各國獎牌排行榜，獎牌數依 `team-medals.csv` 計算。
新賽事還沒填任何成績時，只有表頭的 CSV 不算錯；已經有成績卻存成只剩表頭，會被擋下以免清空。

#### 已結束的奧運：從 Wayback 存檔回補

奧運官方成績 API 在閉幕後就下線，但網際網路檔案館（Wayback Machine）存有當時的逐場原始檔。`import-wayback` 會讀這些存檔，把本隊出賽的場次轉成 `manual.csv`：

```bash
EVENT=og2024 npm run import-wayback -- --comp OG2024 --disc BDM,BOX --dry-run   # 先看結果
EVENT=og2024 npm run import-wayback -- --comp OG2024 --disc BDM,BOX             # 寫入
```

- `--disc` 是三碼項目代碼，只替換這些項目的列，其他列保留，可以分批匯入；`--only BDMMDOUBLES` 可只抓特定項目。
- 對戰項目會連對手一起收，多人同場（舉重、射箭排名賽等）只收本隊；獎牌依金牌戰／銅牌戰勝負或決賽名次推算，拳擊四強敗方算銅牌。
- Wayback 沒存到的場次會列出「Wayback 缺」，無法判斷那場有沒有本隊，要對照官方頁面人工補。
- 累計獎牌仍以 `team-medals.csv` 為準，匯入後請對照代表團公布的得牌明細填寫。
- 原始檔快取在 `.cache/wayback/`（不進版控），重跑不會重抓。

## 本機開發

需要 Node.js 22 以上。

需要指定賽事的指令用 `EVENT=<代號>`；不指定時用 `events/` 底下第一個賽事。

```bash
npm install
EVENT=ag2026 npm run dev     # http://localhost:3000（沒有同步資料時顯示空白狀態）
EVENT=ag2026 npm run sync    # 向官方同步這個賽事一輪，資料寫到 data/ag2026/
npm run sync:all             # 依序同步所有賽事（GitHub Actions 用這個）
npm run new-event -- --id …   # 建立新賽事資料夾（參數見上方「新增賽事資料夾」）
npm test                     # 單元測試
npm run typecheck
npm run build:site           # 整個網站（所有賽事＋首頁）輸出到 site/
```

## 注意事項

- **GitHub 排程不準時**：可能延遲或跳過，實測曾降到 3–6 小時一次。賽期中要準時更新見〈賽期中要準時更新〉；即使如此，分秒必爭的即時比分仍請看官網。
- **對官網的負擔**：已是正式成績的場次不會重複請求，只在閉幕後第三天的最終補正時全部重讀一次。
- **repo 60 天沒有任何 commit，GitHub 會自動停用排程**。賽事開始前記得確認 Actions 是開啟的。
- **請尊重官網**：同步程式每秒最多送 1 個請求，失敗會自動冷卻。`syncIntervalMinutes` 預設 30，只在賽期中確實需要時才調到 10，也請遵守各賽會成績網站的使用條款。
- 公開版**不附國旗圖**（官方圖檔有版權疑慮），獎牌榜只顯示代碼與國名。
- `rosters/` 內附的 2026 亞運中華隊選手中英文對照與得牌明細，取自官方公開名單與中華奧會公布的總表，作為範例格式。

## 授權

程式碼採 [MIT License](LICENSE)。成績資料的權利屬於各賽會與官方成績系統。
