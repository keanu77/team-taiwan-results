/** @type {import('tailwindcss').Config} */
module.exports = {
  // class 策略：由顯示設定切換。
  // 賽果頁的「顯示設定」會在 <html> 掛上 .dark。
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 品牌主色：深海軍藍
        brand: {
          50: "#f0f6fe",
          100: "#dceafd",
          200: "#c2dbfb",
          300: "#98c4f8",
          400: "#67a4f3",
          500: "#4381ed",
          600: "#2d63e1",
          700: "#254ecf",
          800: "#2441a8",
          900: "#223a85",
          950: "#182651",
        },
        // 輔助色：青綠 teal（脈搏線、強調元素）
        accent: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        warning: "#F59E0B",
        danger: "#EF4444",
        safe: "#10B981",
        // 語意色。角色固定，不要當裝飾色用：
        // electric = 可互動、lane = 已指派、sprint = 待處理、steel = 已結束。
        track: {
          DEFAULT: "#0B1A2E",
          line: "#23354A",
          muted: "#9FB2CC",
        },
        electric: {
          DEFAULT: "#0B5FFF",
          hover: "#0847C4",
          soft: "#E8F0FF",
          line: "#C8DBFF",
        },
        // fill 是色塊專用（對比 2.6:1，絕不可當文字色）；ink 才是文字色（5.0:1）
        lane: {
          fill: "#84CC16",
          ink: "#4D7C0F",
          soft: "#F2FBE3",
        },
        sprint: {
          fill: "#F97316",
          ink: "#C2410C",
          deep: "#9A3412",
          soft: "#FFF1E7",
          line: "#F5C9A8",
          canvas: "#FFFAF5",
        },
        steel: {
          DEFAULT: "#5B6478",
          soft: "#8A97AC",
          line: "#DDE4EE",
          hair: "#E9EEF6",
        },
        chalk: "#F2F5FA",
        // Night Track：賽道色系的暗色軌。對比以 #071018 為底實算，
        // ink 15.9:1、muted 7.4:1、electric 5.9:1、lane 12.7:1、sprint 8.5:1
        night: {
          canvas: "#071018",
          surface: "#0F1A26",
          raised: "#16273A",
          border: "#1E2E3E",
          hair: "#19273A",
          ink: "#E9F0F7",
          body: "#C2D0E0",
          muted: "#93A3B5",
          electric: "#4D8BFF",
          "electric-soft": "#10243F",
          lane: "#A3E635",
          "lane-soft": "#1A2A0E",
          sprint: "#FB923C",
          "sprint-soft": "#2A1A0E",
          "sprint-line": "#56331C",
        },
      },
      fontFamily: {
        // 拉丁字面自 self-host 的 IBM Plex 取用（layout.tsx 以 @fontsource 匯入）；
        sans: [
          '"IBM Plex Sans"',
          '"Noto Sans TC"',
          '"PingFang TC"',
          '"Microsoft JhengHei"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        // 時間、日期與計數專用；等寬加 tabular-nums 才能跨列對齊
        mono: [
          '"IBM Plex Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)",
        "card-hover": "0 12px 24px -8px rgba(24, 38, 81, 0.18)",
        nav: "0 1px 2px rgba(16, 24, 40, 0.06)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #182651 0%, #223a85 55%, #0f766e 100%)",
        "surface-gradient":
          "linear-gradient(180deg, #f0f6fe 0%, #f8fafc 60%, #f0fdfa 100%)",
      },
    },
  },
  plugins: [],
};
