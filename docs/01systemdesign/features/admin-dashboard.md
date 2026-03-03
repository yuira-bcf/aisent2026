# 管理者ダッシュボード・アナリティクス 詳細設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate（オーダーメイド香水ECプラットフォーム） |
| 対象機能 | 管理者ダッシュボード・KPI分析・リアルタイム監視・アラートシステム |
| 技術スタック | Next.js 15 (App Router), TypeScript, Drizzle ORM, PostgreSQL, Recharts, Tailwind CSS 4 |
| バージョン | 3.0 |
| 作成日 | 2026-02-15 |
| 更新日 | 2026-02-15 |

---

## 目次

1. [概要](#1-概要)
2. [画面構成](#2-画面構成)
3. [KPIカード定義](#3-kpiカード定義)
4. [調香パイプライン](#4-調香パイプライン)
5. [クリエーターティア分布](#5-クリエーターティア分布)
6. [レビュー状況](#6-レビュー状況)
7. [グラフ・チャート仕様](#7-グラフチャート仕様)
8. [アラート・通知システム](#8-アラート通知システム)
9. [リアルタイム更新仕様](#9-リアルタイム更新仕様)
10. [データ集計ロジック](#10-データ集計ロジック)
11. [APIエンドポイント設計](#11-apiエンドポイント設計)
12. [コンポーネント設計](#12-コンポーネント設計)
13. [権限・アクセス制御](#13-権限アクセス制御)
14. [DB関連テーブル](#14-db関連テーブル)
15. [パフォーマンス考慮事項](#15-パフォーマンス考慮事項)

---

## 1. 概要

### 1.1 目的

管理者（ADMIN ロール）がプラットフォーム全体のビジネス状況をリアルタイムで把握し、迅速な意思決定を行うための統合ダッシュボードを提供する。売上・注文・ユーザー・クリエーターに関するKPIを一元的に可視化し、異常検知やアラート通知によりオペレーション上の問題を即座に発見できる仕組みを構築する。

### 1.2 スコープ

| 区分 | 含まれるもの |
|------|-------------|
| KPIモニタリング | 売上・注文数・新規ユーザー・アクティブクリエーター・平均注文額・コンバージョン率 |
| データ可視化 | 売上推移チャート・注文トレンド・カテゴリ別内訳円グラフ |
| 調香パイプライン | 注文ステータス別件数のリアルタイム可視化（注文確定→調香準備中→調香中→調香完了→発送済→配達完了）|
| クリエーター分析 | ティア分布、売上ランキング、アクティブクリエーター数 |
| レビュー状況 | 投稿数・平均評価・フラグ件数・未対応モデレーション |
| アラートシステム | 在庫僅少・未処理注文・レビューフラグ検知 |
| リアルタイム更新 | Server-Sent Events による自動データリフレッシュ |
| データ集計 | 日次・週次・月次の集計ロジックとキャッシュ戦略 |

### 1.3 前提条件

- ユーザーは `users.role = 'ADMIN'` であること
- 認証は NextAuth.js v5（JWT戦略）で管理される
- DBスキーマは `packages/db/src/schema/` 配下の定義に準拠する
- 金額はすべて日本円（整数）で扱い、`integer` 型で保持する
- タイムゾーンは `Asia/Tokyo` を基準とする

---

## 2. 画面構成

### 2.1 画面一覧

| パス | 画面名 | 説明 |
|------|--------|------|
| `/admin` | ダッシュボードトップ | KPIカード・チャート・アラート・最近の注文・ランキング |
| `/admin/analytics` | 詳細アナリティクス | 詳細な売上分析・ユーザー行動分析・クリエーター分析 |
| `/admin/analytics/sales` | 売上詳細分析 | 売上推移・日別/週別/月別切替・CSV出力 |
| `/admin/analytics/users` | ユーザー分析 | 新規登録推移・リテンション・コホート分析 |
| `/admin/analytics/creators` | クリエーター分析 | 売上ランキング・ティア分布・成長率 |
| `/admin/alerts` | アラート管理 | アラート一覧・既読/未読管理・設定 |

### 2.2 ダッシュボードトップ レイアウト

```
┌────────────────────────────────────────────────────────────────────────┐
│  Admin  管理ダッシュボード                              🔔 5   [更新]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ 今月売上 │ │ 注文数  │ │新規ユーザー│ │ﾌﾟクリエーター│ │平均注文額│ │ CVR   │  │
│  │ ¥1.28M │ │ 156件  │ │  48人   │ │  12人   │ │ ¥8,205│ │ 4.2%  │  │
│  │+12.5%▲ │ │+8.3%▲ │ │ +15人▲ │ │ +2人▲  │ │+3.8%▲ │ │+0.3pt▲│  │
│  │昨年¥982K│ │昨年118件│ │昨年32人  │ │昨年8人  │ │昨年¥8,322│ │昨年3.5%│  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
│                                                                        │
│  ┌─── 調香パイプライン ───────────────────── ● リアルタイム ──────────┐  │
│  │                                                                  │  │
│  │  注文確定  調香準備中  調香中   調香完了   発送済   配達完了        │  │
│  │    8件      5件      12件     3件      6件     122件           │  │
│  │  ▓▓▓▓░░░░░░▓▓▓░░░░░░▓▓▓▓▓▓▓░░▓▓░░░░░░▓▓▓▓░░░░▓▓▓▓▓▓▓▓▓▓▓▓  │  │
│  │  ⚠ 遅延注文: 2件（24時間以上未処理）                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─── 要対応 (5) ──────────────────────────────────────────────────┐  │
│  │  🔴 未処理注文 3件が24時間超過                          [対応]  │  │
│  │  🔴 在庫僅少: 夏の風 30ml 残り3本                       [確認]  │  │
│  │  🟡 フラグレビュー 2件確認待ち                          [確認]  │  │
│  │  🟡 クリエーター申請 2件未処理                          [審査]  │  │
│  │  🟢 低評価レビュー(★1) 1件                             [確認]  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─── 売上推移（6ヶ月）────────┐  ┌─── ティア分布 ────────────────┐  │
│  │  ¥1.28M       ▓▓           │  │  Grand Master ◆  2人 ███     │  │
│  │  ¥1.14M    ▓▓ ▓▓           │  │  Master ◆       4人 █████   │  │
│  │  ¥1.05M    ▓▓ ▓▓           │  │  Expert ◆       8人 █████████│  │
│  │  ¥980K  ▓▓ ▓▓ ▓▓           │  │  Artisan ◆     12人 █████████│  │
│  │  ¥820K  ▓▓ ▓▓ ▓▓ ▓▓       │  │  Apprentice ◇   6人 ██████  │  │
│  │  ¥680K  ▓▓ ▓▓ ▓▓ ▓▓ ▓▓   │  │              合計 32人       │  │
│  │       9月10月11月12月 1月 2月│  └──────────────────────────────┘  │
│  │  昨年同期 ¥4.55M 昨対+30.8%│                                     │
│  └─────────────────────────────┘                                     │
│                                                                        │
│  ┌─── クリエーター売上 TOP 5 ──────────────────────────────────────┐  │
│  │  1  shimizu    ◆ Master   45件  ¥368,000                      │  │
│  │  2  takahashi  ◆ Expert   38件  ¥295,000                      │  │
│  │  3  nakamura   ◆ Expert   32件  ¥248,000                      │  │
│  │  4  yamamoto   ◆ Artisan  28件  ¥196,000                      │  │
│  │  5  suzuki     ◆ Artisan  22件  ¥152,000                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─── レビュー状況（今月）─────────────────────────────────────────┐  │
│  │  投稿数: 32件(昨年21件)  平均:★4.38  フラグ:2件  未対応:3件    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌────────┐ ┌────────┐ ┌────────┐                                    │
│  │注文管理  │ │商品管理  │ │ユーザー │                                    │
│  │クリエーター│ │クーポン  │ │レビュー │                                    │
│  │EC設定   │ │サイト設定│ │ ログ   │                                    │
│  └────────┘ └────────┘ └────────┘                                    │
│                                                                        │
│  ┌─── 最近の注文 ──────────────────────────────── [全て見る →] ────┐  │
│  │  🟡 #KI-0042 たろちゃん     調香中      ¥24,300               │  │
│  │  🟢 #KI-0041 はなりん       発送済      ¥8,800                │  │
│  │  🔵 #KI-0040 ゆうき         注文確定    ¥12,500               │  │
│  │  🟡 #KI-0039 けんけん       調香準備中   ¥7,800               │  │
│  │  🟢 #KI-0038 さっちー       配達完了    ¥15,200               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.3 レスポンシブ対応

| ブレークポイント | KPIカード配置 | チャート配置 |
|----------------|-------------|-------------|
| `>= 1280px` (xl) | 6列（1行に全6枚） | 2カラム（売上推移 + カテゴリ別） |
| `>= 768px` (md) | 3列 x 2行 | 1カラム（縦積み） |
| `< 768px` (sm) | 2列 x 3行 | 1カラム（縦積み） |

---

## 3. KPIカード定義

### 3.1 KPI一覧

| # | KPI名 | 計算方法 | 前月比表示 | 昨年同月比 | アイコン |
|---|--------|---------|-----------|-----------|---------|
| 1 | 売上 | 当月 `orders.total_yen` 合計（status = 'PAID' 以降） | `(当月 - 前月) / 前月 * 100` % | 昨年同月値と昨対比 | `DollarSign` |
| 2 | 注文数 | 当月 `orders` 件数（status = 'PAID' 以降） | 同上 | 昨年同月値と昨対比 | `ShoppingCart` |
| 3 | 新規ユーザー | 当月 `users.created_at` 範囲内の件数 | 前月新規数との差分 | 昨年同月値と昨対比 | `UserPlus` |
| 4 | アクティブクリエーター | 過去30日に1件以上の注文を処理したクリエーター数 | 前月との差分 | 昨年同月値と昨対比 | `Palette` |
| 5 | 平均注文額 | 売上 / 注文数 | `(当月平均 - 前月平均) / 前月平均 * 100` % | 昨年同月値と昨対比 | `TrendingUp` |
| 6 | CVR | ユニーク訪問者数に対する注文完了率 | 前月CVRとの差分（ポイント） | 昨年同月値と昨対比 | `Target` |

### 3.2 KPIデータ型

```typescript
// lib/types/admin-dashboard.ts

/** 個別KPIカードのデータ */
export type KPICardData = {
  label: string;
  value: number;
  formattedValue: string;    // 表示用フォーマット済み文字列
  change: number;            // 前月比の変化量（% or 差分）
  changeType: 'percent' | 'absolute';
  trend: 'up' | 'down' | 'neutral';
  lastYearValue: number;     // 昨年同月値
  lastYearChange: number;    // 昨対比（%）
  sparklineData: number[];   // 直近7日間のミニグラフ用データ
};

/** ダッシュボードKPI全体 */
export type DashboardKPIs = {
  sales: KPICardData;
  orders: KPICardData;
  newUsers: KPICardData;
  activeCreators: KPICardData;
  avgOrderAmount: KPICardData;
  conversionRate: KPICardData;
  period: {
    start: string;    // ISO 8601
    end: string;
  };
  generatedAt: string;       // キャッシュ生成時刻
};
```

### 3.3 フォーマットルール

| KPI | フォーマット | 例 |
|-----|------------|-----|
| 売上 | `¥` + 3桁区切り。100万以上は `¥X.XXM` 表記も併記 | `¥1,280,000` / `¥1.28M` |
| 注文数 | 数値 + `件` | `156件` |
| 新規ユーザー | 数値 + `人` | `45人` |
| アクティブクリエーター | 数値 + `人` | `12人` |
| 平均注文額 | `¥` + 3桁区切り | `¥8,205` |
| コンバージョン率 | 小数点1桁 + `%` | `4.2%` |

```typescript
// lib/utils/format.ts

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `¥${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `¥${(amount / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function formatCount(value: number, unit: string): string {
  return `${value.toLocaleString('ja-JP')}${unit}`;
}
```

### 3.4 スパークライン

各KPIカード内に直近7日間の推移を示すミニ折れ線グラフ（スパークライン）を表示する。

- 幅: 80px / 高さ: 32px
- 線色: トレンドが `up` なら `text-green-500`、`down` なら `text-red-500`、`neutral` なら `text-muted-foreground`
- Recharts の `LineChart` を `ResponsiveContainer` で包む（軸・グリッド非表示）

---

## 4. 調香パイプライン

### 4.1 概要

受注生産プラットフォームの最重要管理指標。全注文のステータス分布をリアルタイムで可視化する。

### 4.2 パイプラインステータス

| ステータス | コード | カラー | 説明 |
|-----------|--------|--------|------|
| 注文確定 | confirmed | #3b82f6 (blue) | 決済完了、クリエーター未着手 |
| 調香準備中 | preparing | #8b5cf6 (purple) | クリエーターが材料確認中 |
| 調香中 | manufacturing | #f59e0b (amber) | 調香作業進行中 |
| 調香完了 | manufactured | #10b981 (green) | 調香完了、発送準備中 |
| 発送済 | shipped | #06b6d4 (cyan) | 配送業者に引渡し済み |
| 配達完了 | delivered | #22c55e (green) | 顧客に到着 |

### 4.3 遅延検知ルール

| ステータス | 遅延閾値 | アラートレベル |
|-----------|---------|--------------|
| 注文確定 | 24時間以上 | HIGH |
| 調香準備中 | 48時間以上 | HIGH |
| 調香中 | 7日以上 | MEDIUM |
| 調香完了 → 発送 | 24時間以上 | HIGH |
| 発送済 → 配達 | 5日以上 | MEDIUM |

### 4.4 集計クエリ

```typescript
export async function getPipelineSummary() {
  const result = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)`,
    })
    .from(orders)
    .where(
      notInArray(orders.status, ['cancelled', 'returned'])
    )
    .groupBy(orders.status);

  return result;
}

export async function getDelayedOrders() {
  const now = new Date();
  const threshold24h = subHours(now, 24);

  return await db.query.orders.findMany({
    where: and(
      inArray(orders.status, ['confirmed', 'manufactured']),
      lte(orders.updatedAt, threshold24h),
    ),
    orderBy: [asc(orders.updatedAt)],
  });
}
```

---

## 5. クリエーターティア分布

### 5.1 概要

プラットフォーム上のクリエーターの品質分布を可視化。ティアの偏りや成長トレンドを管理者が把握するための指標。

### 5.2 集計クエリ

```typescript
export async function getTierDistribution() {
  const result = await db
    .select({
      tier: creatorStats.tier,
      count: sql<number>`count(*)`,
    })
    .from(creatorStats)
    .groupBy(creatorStats.tier)
    .orderBy(
      sql`CASE ${creatorStats.tier}
        WHEN 'GRAND_MASTER' THEN 1
        WHEN 'MASTER' THEN 2
        WHEN 'EXPERT' THEN 3
        WHEN 'ARTISAN' THEN 4
        WHEN 'APPRENTICE' THEN 5
      END`
    );

  return result;
}
```

### 5.3 表示仕様

各ティアを横棒グラフで表示。ティアカラーとアイコンは `creator-tier-system.md` のTIER_DISPLAY定義に準拠:

| ティア | アイコン | カラー |
|--------|---------|--------|
| Grand Master | ◆ | #7c3aed (platinum) |
| Master | ◆ | #d97706 (gold) |
| Expert | ◆ | #94a3b8 (silver) |
| Artisan | ◆ | #cd7f32 (bronze) |
| Apprentice | ◇ | #a3a3a3 (gray) |

---

## 6. レビュー状況

### 6.1 表示指標

| 指標 | ソース | 説明 |
|------|--------|------|
| 投稿数（今月） | `count(creator_reviews WHERE created_at >= monthStart)` | 今月のレビュー投稿数 |
| 平均評価 | `avg(creator_reviews.rating)` | 全体の平均評価 |
| フラグ件数 | `count(creator_reviews WHERE flag_count >= 2)` | フラグ2件以上のレビュー数 |
| 未対応 | `count(creator_reviews WHERE status = 'PENDING')` | 管理者レビュー待ち件数 |

### 6.2 昨年同月比較

各指標に昨年同月の値と昨対比を表示する。

---

## 7. グラフ・チャート仕様

### 7.1 売上推移チャート

**種別:** Recharts `ComposedChart`（`Bar` + `Line`）

| 項目 | 仕様 |
|------|------|
| X軸 | 期間ラベル（月別: `2026-01` / 週別: `W03` / 日別: `01/15`） |
| Y軸（左） | 売上金額（`¥` フォーマット） |
| Y軸（右） | 注文数 |
| Bar | 売上金額（グラデーション: `#8b5cf6` → `#6d28d9`） |
| Line | 注文数（色: `#f59e0b`、ドット表示） |
| ツールチップ | 期間 / 売上 / 注文数 / 平均注文額 を表示 |

**表示期間切替:**

| モード | データ範囲 | X軸ラベル |
|--------|-----------|----------|
| 月別 | 直近12ヶ月 | `YYYY-MM` |
| 週別 | 直近12週 | `MM/DD週` |
| 日別 | 直近30日 | `MM/DD` |

**データ型:**

```typescript
// lib/types/admin-dashboard.ts

export type SalesChartDataPoint = {
  period: string;
  sales: number;
  orderCount: number;
  avgOrderAmount: number;
};

export type SalesChartResponse = {
  data: SalesChartDataPoint[];
  granularity: 'monthly' | 'weekly' | 'daily';
  totalSales: number;
  totalOrders: number;
};
```

### 7.2 注文トレンドチャート

**種別:** Recharts `AreaChart`

| 項目 | 仕様 |
|------|------|
| X軸 | 日付 |
| Y軸 | 注文数 |
| Area | ステータス別にスタック表示 |
| カラー | PAID: `#22c55e` / SHIPPED: `#3b82f6` / DELIVERED: `#8b5cf6` / CANCELLED: `#ef4444` |

**データ型:**

```typescript
export type OrderTrendDataPoint = {
  date: string;
  paid: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  total: number;
};

export type OrderTrendResponse = {
  data: OrderTrendDataPoint[];
  period: { start: string; end: string };
};
```

### 7.3 カテゴリ別売上内訳

**種別:** Recharts `PieChart`（ドーナツ型）

| 項目 | 仕様 |
|------|------|
| データ | クリエーターの `specialties` を基にした香りカテゴリ別売上 |
| 表示 | カテゴリ名 + 割合(%) + 金額 |
| カラー | FLORAL: `#ec4899` / WOODY: `#84cc16` / CITRUS: `#f59e0b` / ORIENTAL: `#8b5cf6` / FRESH: `#06b6d4` / GOURMAND: `#f97316` |
| インタラクション | ホバーでツールチップ表示。クリックで該当カテゴリの詳細ドリルダウン |

**データ型:**

```typescript
export type CategoryBreakdownItem = {
  category: string;
  sales: number;
  percentage: number;
  orderCount: number;
  color: string;
};

export type CategoryBreakdownResponse = {
  data: CategoryBreakdownItem[];
  totalSales: number;
  period: { start: string; end: string };
};
```

### 7.4 Recharts 共通設定

```typescript
// lib/constants/chart-config.ts

export const CHART_COLORS = {
  primary: '#8b5cf6',
  primaryGradientStart: '#8b5cf6',
  primaryGradientEnd: '#6d28d9',
  secondary: '#f59e0b',
  success: '#22c55e',
  danger: '#ef4444',
  info: '#3b82f6',
  categories: {
    FLORAL: '#ec4899',
    WOODY: '#84cc16',
    CITRUS: '#f59e0b',
    ORIENTAL: '#8b5cf6',
    FRESH: '#06b6d4',
    GOURMAND: '#f97316',
  },
} as const;

export const CHART_COMMON_PROPS = {
  margin: { top: 5, right: 30, left: 20, bottom: 5 },
  animationDuration: 300,
  animationEasing: 'ease-in-out' as const,
};

export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  },
  labelStyle: { color: 'hsl(var(--foreground))' },
};
```

---

## 8. アラート・通知システム

### 8.1 アラート種類

| # | アラート種別 | 条件 | 優先度 | チェック間隔 |
|---|------------|------|--------|------------|
| 1 | 未処理注文 (`PENDING_ORDER`) | `orders.status` が `confirmed` のまま24時間以上経過 | `HIGH` | 30分 |
| 2 | 在庫僅少 (`LOW_STOCK`) | `products` の在庫数が閾値（デフォルト5）以下 | `HIGH` | 15分 |
| 3 | フラグレビュー (`FLAGGED_REVIEW`) | フラグ報告が2件以上のレビューが発生 | `MEDIUM` | イベント駆動 |
| 4 | クリエーター申請 (`CREATOR_APPLICATION`) | 未処理のクリエーター申請がある | `MEDIUM` | 1時間 |
| 5 | 低評価レビュー (`LOW_RATING_REVIEW`) | 星1のレビューが新規投稿された | `LOW` | イベント駆動 |

### 8.2 アラートデータ型

```typescript
// lib/types/admin-alerts.ts

export const alertTypeEnum = [
  'PENDING_ORDER',
  'LOW_STOCK',
  'FLAGGED_REVIEW',
  'CREATOR_APPLICATION',
  'LOW_RATING_REVIEW',
] as const;
export type AlertType = (typeof alertTypeEnum)[number];

export const alertPriorityEnum = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type AlertPriority = (typeof alertPriorityEnum)[number];

export type AdminAlert = {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  description: string;
  link: string;
  metadata: Record<string, unknown>;   // アラート種別ごとの追加データ
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
  readAt: string | null;
};

export type AlertSummary = {
  total: number;
  unread: number;
  byPriority: Record<AlertPriority, number>;
  byType: Record<AlertType, number>;
};
```

### 8.3 アラート表示ワイヤフレーム

```
┌──────────────────────────────────────────────────────────────┐
│  アラート (5件未読)                                    [全て見る]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [HIGH] 在庫僅少                               2分前         │
│  「夏の風 30ml」の在庫が残り3本です                            │
│  [商品を確認] [非表示にする]                                   │
│                                                              │
│  [HIGH] 未処理注文                              1時間前       │
│  3件の注文が24時間以上未処理です                               │
│  [注文管理へ] [非表示にする]                                   │
│                                                              │
│  [MED]  低評価レビュー                          3時間前       │
│  「田中花子」の調合に★1レビューが投稿されました                │
│  [レビューを確認] [非表示にする]                               │
│                                                              │
│  [MED]  フラグ付きレビュー                      5時間前       │
│  2件のレビューが管理者確認待ちです                             │
│  [レビュー管理へ] [非表示にする]                               │
│                                                              │
│  [LOW]  クリエーター申請                        12時間前      │
│  2件の未処理申請があります                                    │
│  [申請一覧へ] [非表示にする]                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.4 アラート生成ロジック

```typescript
// lib/services/alert-generator.ts

import { db } from '@/db';
import { products, orders, adminAlerts } from '@/db/schema';
import { and, eq, lt, sql, gte, count } from 'drizzle-orm';

const LOW_STOCK_THRESHOLD = 5;
const PENDING_ORDER_HOURS = 24;

/** 在庫僅少アラートチェック */
export async function checkLowStockAlerts(): Promise<void> {
  const lowStockProducts = await db
    .select({
      id: products.id,
      name: products.name,
      // stock_quantity を想定。現時点で products テーブルに在庫カラムが
      // ない場合は admin_product_inventory テーブルを参照する
    })
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        // products に stockQuantity カラムを追加想定
        sql`stock_quantity <= ${LOW_STOCK_THRESHOLD}`,
        sql`stock_quantity > 0`,
      )
    );

  for (const product of lowStockProducts) {
    // 同一商品の未読アラートが既に存在するか確認（重複防止）
    const existing = await db.query.adminAlerts.findFirst({
      where: and(
        eq(adminAlerts.type, 'LOW_STOCK'),
        eq(adminAlerts.isRead, false),
        sql`metadata->>'productId' = ${product.id}`,
      ),
    });

    if (!existing) {
      await db.insert(adminAlerts).values({
        type: 'LOW_STOCK',
        priority: 'HIGH',
        title: `在庫僅少: ${product.name}`,
        description: `「${product.name}」の在庫が残りわずかです`,
        link: `/admin/products/${product.id}`,
        metadata: { productId: product.id },
      });
    }
  }
}

/** 未処理注文アラートチェック */
export async function checkPendingOrderAlerts(): Promise<void> {
  const threshold = new Date();
  threshold.setHours(threshold.getHours() - PENDING_ORDER_HOURS);

  const pendingOrders = await db
    .select({ count: count() })
    .from(orders)
    .where(
      and(
        eq(orders.status, 'PAID'),
        lt(orders.createdAt, threshold),
      )
    );

  const pendingCount = pendingOrders[0].count;
  if (pendingCount > 0) {
    const existing = await db.query.adminAlerts.findFirst({
      where: and(
        eq(adminAlerts.type, 'PENDING_ORDER'),
        eq(adminAlerts.isRead, false),
        sql`created_at > NOW() - INTERVAL '1 hour'`,
      ),
    });

    if (!existing) {
      await db.insert(adminAlerts).values({
        type: 'PENDING_ORDER',
        priority: 'HIGH',
        title: `未処理注文: ${pendingCount}件`,
        description: `${pendingCount}件の注文が${PENDING_ORDER_HOURS}時間以上未処理です`,
        link: '/admin/orders?status=PAID',
        metadata: { count: pendingCount },
      });
    }
  }
}
```

### 8.5 アラート設定

管理者がアラートの閾値やチェック間隔をカスタマイズできる。

```typescript
export type AlertSettings = {
  lowStock: {
    enabled: boolean;
    threshold: number;           // デフォルト: 5
    checkIntervalMinutes: number; // デフォルト: 15
  };
  pendingOrder: {
    enabled: boolean;
    thresholdHours: number;      // デフォルト: 24
    checkIntervalMinutes: number; // デフォルト: 30
  };
  lowRatingReview: {
    enabled: boolean;
    ratingThreshold: number;     // デフォルト: 2
  };
  flaggedReview: {
    enabled: boolean;
    flagCountThreshold: number;  // デフォルト: 2
  };
  salesAnomaly: {
    enabled: boolean;
    dropPercentThreshold: number; // デフォルト: 50
  };
};
```

---

## 9. リアルタイム更新仕様

### 9.1 更新方式

Server-Sent Events（SSE）を使用し、ダッシュボードデータをリアルタイムに更新する。WebSocket に比べて実装がシンプルで、一方向のデータ配信に適している。

### 9.2 SSE エンドポイント

```typescript
// app/api/admin/dashboard/stream/route.ts

import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // 初回データ送信
      sendInitialData(send);

      // 定期更新（30秒間隔）
      const interval = setInterval(async () => {
        try {
          const kpis = await getDashboardKPIs();
          send('kpi-update', kpis);

          const alerts = await getUnreadAlerts();
          send('alert-update', alerts);
        } catch (error) {
          console.error('SSE update error:', error);
        }
      }, 30_000);

      // キープアライブ（15秒間隔）
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'));
      }, 15_000);

      // クリーンアップ
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(keepAlive);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

### 9.3 クライアント側フック

```typescript
// hooks/use-dashboard-stream.ts

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { DashboardKPIs, AdminAlert } from '@/lib/types/admin-dashboard';

type DashboardStreamState = {
  kpis: DashboardKPIs | null;
  alerts: AdminAlert[];
  isConnected: boolean;
  lastUpdated: Date | null;
  error: string | null;
};

export function useDashboardStream() {
  const [state, setState] = useState<DashboardStreamState>({
    kpis: null,
    alerts: [],
    isConnected: false,
    lastUpdated: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 5;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/admin/dashboard/stream');
    eventSourceRef.current = es;

    es.onopen = () => {
      setState((prev) => ({ ...prev, isConnected: true, error: null }));
      retryCountRef.current = 0;
    };

    es.addEventListener('kpi-update', (event) => {
      const data = JSON.parse(event.data) as DashboardKPIs;
      setState((prev) => ({
        ...prev,
        kpis: data,
        lastUpdated: new Date(),
      }));
    });

    es.addEventListener('alert-update', (event) => {
      const data = JSON.parse(event.data) as AdminAlert[];
      setState((prev) => ({ ...prev, alerts: data }));
    });

    es.onerror = () => {
      es.close();
      setState((prev) => ({ ...prev, isConnected: false }));

      // 指数バックオフによる再接続
      if (retryCountRef.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30_000);
        retryCountRef.current += 1;
        setTimeout(connect, delay);
      } else {
        setState((prev) => ({
          ...prev,
          error: '接続が切断されました。ページをリロードしてください。',
        }));
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  return { ...state, reconnect };
}
```

### 9.4 更新イベント一覧

| イベント名 | データ | トリガー |
|-----------|--------|---------|
| `kpi-update` | `DashboardKPIs` | 30秒間隔のポーリング |
| `alert-update` | `AdminAlert[]` | 30秒間隔 + 新規アラート発生時 |
| `order-update` | `RecentOrder[]` | 新規注文 / ステータス変更時 |
| `connection-status` | `{ connected: boolean }` | 接続状態変化時 |

### 9.5 フォールバック

SSE が利用できない環境（古いプロキシ等）では、60秒間隔の `router.refresh()` によるポーリングにフォールバックする。

```typescript
// SSE非対応時のフォールバック
useEffect(() => {
  if (!state.isConnected && state.error) {
    const interval = setInterval(() => {
      router.refresh();
    }, 60_000);
    return () => clearInterval(interval);
  }
}, [state.isConnected, state.error, router]);
```

---

## 10. データ集計ロジック

### 10.1 KPI集計クエリ

```typescript
// lib/db/queries/admin-dashboard.ts

import { db } from '@/db';
import { orders, users, products, orderItems } from '@/db/schema';
import { and, eq, gte, lte, sql, count, sum, ne } from 'drizzle-orm';
import type { DashboardKPIs, KPICardData } from '@/lib/types/admin-dashboard';

/** 月の開始・終了日を取得（JST基準） */
function getMonthRange(targetMonth: string): { start: Date; end: Date } {
  // targetMonth: "2026-01"
  const [year, month] = targetMonth.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, -9)); // JST 00:00 → UTC
  const end = new Date(Date.UTC(year, month, 1, -9));        // 翌月の0時
  return { start, end };
}

function getPrevMonthRange(targetMonth: string): { start: Date; end: Date } {
  const [year, month] = targetMonth.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return getMonthRange(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
}

/** 売上・注文数を集計 */
async function getSalesMetrics(start: Date, end: Date) {
  const result = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${orders.totalYen}), 0)`,
      orderCount: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(
      and(
        ne(orders.status, 'PENDING'),
        ne(orders.status, 'CANCELLED'),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end),
      )
    );
  return {
    totalSales: Number(result[0].totalSales),
    orderCount: Number(result[0].orderCount),
  };
}

/** 新規ユーザー数を集計 */
async function getNewUserCount(start: Date, end: Date): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        gte(users.createdAt, start),
        lte(users.createdAt, end),
      )
    );
  return result[0].count;
}

/** アクティブクリエーター数を集計
 *  当月に1件以上の有効注文（PAID以降）に含まれる商品の
 *  blendResult.blendRequest.userId を持つクリエーター数 */
async function getActiveCreatorCount(start: Date, end: Date): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT br.user_id) as count
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    JOIN blend_results bres ON bres.id = p.blend_result_id
    JOIN blend_requests br ON br.id = bres.blend_request_id
    WHERE o.status NOT IN ('PENDING', 'CANCELLED')
      AND o.created_at >= ${start}
      AND o.created_at < ${end}
  `);
  return Number(result.rows[0]?.count ?? 0);
}

/** コンバージョン率を計算
 *  注文完了ユーザー数 / 当月にログイン or セッションが発生したユーザー数 */
async function getConversionRate(start: Date, end: Date): Promise<number> {
  // 注文を行ったユニークユーザー数
  const orderingUsers = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${orders.userId})` })
    .from(orders)
    .where(
      and(
        ne(orders.status, 'PENDING'),
        ne(orders.status, 'CANCELLED'),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end),
      )
    );

  // アクティブユーザー数（期間内に注文 or ログインしたユーザー）
  // 簡易版: 全CUSTOMERユーザーの中で当月にcreated_atがある or 注文したユーザー
  const activeUsers = await db.execute(sql`
    SELECT COUNT(DISTINCT u.id) as count
    FROM users u
    WHERE u.role = 'CUSTOMER'
      AND (
        u.created_at >= ${start} AND u.created_at < ${end}
        OR EXISTS (
          SELECT 1 FROM orders o
          WHERE o.user_id = u.id
            AND o.created_at >= ${start}
            AND o.created_at < ${end}
        )
      )
  `);

  const orderingCount = Number(orderingUsers[0].count);
  const activeCount = Number(activeUsers.rows[0]?.count ?? 0);

  return activeCount > 0 ? (orderingCount / activeCount) * 100 : 0;
}

/** スパークライン用の日別データ（直近7日間） */
async function getDailySparkline(
  metric: 'sales' | 'orders' | 'users',
): Promise<number[]> {
  const days = 7;
  const results: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    let value = 0;
    if (metric === 'sales') {
      const r = await getSalesMetrics(dayStart, dayEnd);
      value = r.totalSales;
    } else if (metric === 'orders') {
      const r = await getSalesMetrics(dayStart, dayEnd);
      value = r.orderCount;
    } else if (metric === 'users') {
      value = await getNewUserCount(dayStart, dayEnd);
    }
    results.push(value);
  }

  return results;
}

/** メインのKPI取得関数 */
export async function getDashboardKPIs(
  targetMonth?: string,
): Promise<DashboardKPIs> {
  const now = new Date();
  const month =
    targetMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { start, end } = getMonthRange(month);
  const { start: prevStart, end: prevEnd } = getPrevMonthRange(month);

  // 当月
  const currentSales = await getSalesMetrics(start, end);
  const currentNewUsers = await getNewUserCount(start, end);
  const currentActiveCreators = await getActiveCreatorCount(start, end);
  const currentCVR = await getConversionRate(start, end);

  // 前月
  const prevSales = await getSalesMetrics(prevStart, prevEnd);
  const prevNewUsers = await getNewUserCount(prevStart, prevEnd);
  const prevActiveCreators = await getActiveCreatorCount(prevStart, prevEnd);
  const prevCVR = await getConversionRate(prevStart, prevEnd);

  // 平均注文額
  const currentAvg =
    currentSales.orderCount > 0
      ? Math.round(currentSales.totalSales / currentSales.orderCount)
      : 0;
  const prevAvg =
    prevSales.orderCount > 0
      ? Math.round(prevSales.totalSales / prevSales.orderCount)
      : 0;

  // スパークライン
  const [salesSparkline, ordersSparkline, usersSparkline] = await Promise.all([
    getDailySparkline('sales'),
    getDailySparkline('orders'),
    getDailySparkline('users'),
  ]);

  const calcChange = (current: number, prev: number) =>
    prev > 0 ? ((current - prev) / prev) * 100 : 0;

  const buildCard = (
    label: string,
    value: number,
    formatted: string,
    change: number,
    changeType: 'percent' | 'absolute',
    sparkline: number[],
  ): KPICardData => ({
    label,
    value,
    formattedValue: formatted,
    change: Math.round(change * 10) / 10,
    changeType,
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    sparklineData: sparkline,
  });

  return {
    sales: buildCard(
      '売上',
      currentSales.totalSales,
      formatCurrency(currentSales.totalSales),
      calcChange(currentSales.totalSales, prevSales.totalSales),
      'percent',
      salesSparkline,
    ),
    orders: buildCard(
      '注文数',
      currentSales.orderCount,
      `${currentSales.orderCount}件`,
      calcChange(currentSales.orderCount, prevSales.orderCount),
      'percent',
      ordersSparkline,
    ),
    newUsers: buildCard(
      '新規ユーザー',
      currentNewUsers,
      `${currentNewUsers}人`,
      currentNewUsers - prevNewUsers,
      'absolute',
      usersSparkline,
    ),
    activeCreators: buildCard(
      'アクティブクリエーター',
      currentActiveCreators,
      `${currentActiveCreators}人`,
      currentActiveCreators - prevActiveCreators,
      'absolute',
      [], // クリエーターのスパークラインは省略
    ),
    avgOrderAmount: buildCard(
      '平均注文額',
      currentAvg,
      formatCurrency(currentAvg),
      calcChange(currentAvg, prevAvg),
      'percent',
      salesSparkline.map((s, i) =>
        ordersSparkline[i] > 0 ? Math.round(s / ordersSparkline[i]) : 0,
      ),
    ),
    conversionRate: buildCard(
      'コンバージョン率',
      currentCVR,
      `${currentCVR.toFixed(1)}%`,
      currentCVR - prevCVR,
      'absolute',
      [],
    ),
    period: { start: start.toISOString(), end: end.toISOString() },
    generatedAt: new Date().toISOString(),
  };
}
```

### 10.2 売上推移集計クエリ

```typescript
// lib/db/queries/admin-sales-chart.ts

import { db } from '@/db';
import { orders } from '@/db/schema';
import { and, ne, gte, lte, sql } from 'drizzle-orm';
import type { SalesChartResponse } from '@/lib/types/admin-dashboard';

type Granularity = 'monthly' | 'weekly' | 'daily';

export async function getSalesChartData(
  granularity: Granularity,
  months: number = 12,
): Promise<SalesChartResponse> {
  const now = new Date();

  let dateFormat: string;
  let intervalStart: Date;

  switch (granularity) {
    case 'monthly':
      dateFormat = `TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM')`;
      intervalStart = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      break;
    case 'weekly':
      dateFormat = `TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'IYYY-"W"IW')`;
      intervalStart = new Date(now.getTime() - months * 7 * 24 * 60 * 60 * 1000);
      break;
    case 'daily':
      dateFormat = `TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'MM/DD')`;
      intervalStart = new Date(now.getTime() - months * 24 * 60 * 60 * 1000);
      break;
  }

  const result = await db.execute(sql`
    SELECT
      ${sql.raw(dateFormat)} as period,
      COALESCE(SUM(total_yen), 0)::integer as sales,
      COUNT(*)::integer as order_count,
      CASE
        WHEN COUNT(*) > 0
        THEN ROUND(SUM(total_yen)::numeric / COUNT(*))::integer
        ELSE 0
      END as avg_order_amount
    FROM orders
    WHERE status NOT IN ('PENDING', 'CANCELLED')
      AND created_at >= ${intervalStart}
    GROUP BY ${sql.raw(dateFormat)}
    ORDER BY period ASC
  `);

  const data = result.rows.map((row: any) => ({
    period: row.period,
    sales: row.sales,
    orderCount: row.order_count,
    avgOrderAmount: row.avg_order_amount,
  }));

  return {
    data,
    granularity,
    totalSales: data.reduce((sum, d) => sum + d.sales, 0),
    totalOrders: data.reduce((sum, d) => sum + d.orderCount, 0),
  };
}
```

### 10.3 注文トレンド集計クエリ

```typescript
// lib/db/queries/admin-order-trend.ts

export async function getOrderTrendData(
  days: number = 30,
): Promise<OrderTrendResponse> {
  const start = new Date();
  start.setDate(start.getDate() - days);

  const result = await db.execute(sql`
    SELECT
      TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD') as date,
      COUNT(*) FILTER (WHERE status = 'PAID')::integer as paid,
      COUNT(*) FILTER (WHERE status = 'SHIPPED')::integer as shipped,
      COUNT(*) FILTER (WHERE status = 'DELIVERED')::integer as delivered,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::integer as cancelled,
      COUNT(*)::integer as total
    FROM orders
    WHERE created_at >= ${start}
    GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD')
    ORDER BY date ASC
  `);

  return {
    data: result.rows as OrderTrendDataPoint[],
    period: {
      start: start.toISOString(),
      end: new Date().toISOString(),
    },
  };
}
```

### 10.4 カテゴリ別売上集計クエリ

```typescript
// lib/db/queries/admin-category-breakdown.ts

export async function getCategoryBreakdown(
  targetMonth: string,
): Promise<CategoryBreakdownResponse> {
  const { start, end } = getMonthRange(targetMonth);

  // blend_requests のキーワードを基にカテゴリを推定
  // keywords テーブルの category フィールドを利用
  const result = await db.execute(sql`
    SELECT
      COALESCE(k.category, 'OTHER') as category,
      SUM(oi.price_yen * oi.quantity)::integer as sales,
      COUNT(DISTINCT o.id)::integer as order_count
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN blend_results bres ON bres.id = p.blend_result_id
    LEFT JOIN blend_requests br ON br.id = bres.blend_request_id
    LEFT JOIN blend_request_keywords brk ON brk.blend_request_id = br.id
    LEFT JOIN keywords k ON k.id = brk.keyword_id
    WHERE o.status NOT IN ('PENDING', 'CANCELLED')
      AND o.created_at >= ${start}
      AND o.created_at < ${end}
    GROUP BY COALESCE(k.category, 'OTHER')
    ORDER BY sales DESC
  `);

  const totalSales = result.rows.reduce(
    (sum: number, row: any) => sum + row.sales,
    0,
  );

  const data: CategoryBreakdownItem[] = result.rows.map((row: any) => ({
    category: row.category,
    sales: row.sales,
    percentage:
      totalSales > 0 ? Math.round((row.sales / totalSales) * 1000) / 10 : 0,
    orderCount: row.order_count,
    color: CHART_COLORS.categories[row.category as keyof typeof CHART_COLORS.categories] ?? '#9ca3af',
  }));

  return {
    data,
    totalSales,
    period: { start: start.toISOString(), end: end.toISOString() },
  };
}
```

### 10.5 クリエーター売上ランキング

```typescript
// lib/db/queries/admin-creator-ranking.ts

export type CreatorRankingItem = {
  rank: number;
  userId: string;
  creatorName: string;
  tier: string;
  orderCount: number;
  sales: number;
  changePercent: number;
};

export async function getCreatorRanking(
  targetMonth: string,
  limit: number = 10,
): Promise<CreatorRankingItem[]> {
  const { start, end } = getMonthRange(targetMonth);
  const { start: prevStart, end: prevEnd } = getPrevMonthRange(targetMonth);

  const result = await db.execute(sql`
    WITH current_month AS (
      SELECT
        br.user_id,
        SUM(oi.price_yen * oi.quantity)::integer as sales,
        COUNT(DISTINCT o.id)::integer as order_count
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      JOIN blend_results bres ON bres.id = p.blend_result_id
      JOIN blend_requests br ON br.id = bres.blend_request_id
      WHERE o.status NOT IN ('PENDING', 'CANCELLED')
        AND o.created_at >= ${start}
        AND o.created_at < ${end}
      GROUP BY br.user_id
    ),
    prev_month AS (
      SELECT
        br.user_id,
        SUM(oi.price_yen * oi.quantity)::integer as sales
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      JOIN blend_results bres ON bres.id = p.blend_result_id
      JOIN blend_requests br ON br.id = bres.blend_request_id
      WHERE o.status NOT IN ('PENDING', 'CANCELLED')
        AND o.created_at >= ${prevStart}
        AND o.created_at < ${prevEnd}
      GROUP BY br.user_id
    )
    SELECT
      u.name as creator_name,
      cm.user_id,
      cm.sales,
      cm.order_count,
      CASE
        WHEN pm.sales > 0
        THEN ROUND(((cm.sales - pm.sales)::numeric / pm.sales) * 100, 1)
        ELSE 0
      END as change_percent
    FROM current_month cm
    JOIN users u ON u.id = cm.user_id
    LEFT JOIN prev_month pm ON pm.user_id = cm.user_id
    ORDER BY cm.sales DESC
    LIMIT ${limit}
  `);

  return result.rows.map((row: any, index: number) => ({
    rank: index + 1,
    userId: row.user_id,
    creatorName: row.creator_name,
    tier: 'Standard', // creator_profiles.tier から取得する拡張予定
    orderCount: row.order_count,
    sales: row.sales,
    changePercent: Number(row.change_percent),
  }));
}
```

---

## 11. APIエンドポイント設計

### 11.1 Server Actions 一覧

すべてのデータ取得は Next.js 15 の Server Actions + React Server Components を活用する。
API Route は SSE エンドポイントのみ使用する。

| # | Action | ファイル | 説明 | 権限 |
|---|--------|---------|------|------|
| 1 | `getDashboardData` | `actions/admin/dashboard.ts` | KPI + チャート + アラート + 最近の注文を一括取得 | ADMIN |
| 2 | `getSalesChartAction` | `actions/admin/analytics.ts` | 売上推移チャートデータ取得 | ADMIN |
| 3 | `getOrderTrendAction` | `actions/admin/analytics.ts` | 注文トレンドデータ取得 | ADMIN |
| 4 | `getCategoryBreakdownAction` | `actions/admin/analytics.ts` | カテゴリ別売上取得 | ADMIN |
| 5 | `getCreatorRankingAction` | `actions/admin/analytics.ts` | クリエーター売上ランキング取得 | ADMIN |
| 6 | `markAlertAsRead` | `actions/admin/alerts.ts` | アラートを既読にする | ADMIN |
| 7 | `dismissAlert` | `actions/admin/alerts.ts` | アラートを非表示にする | ADMIN |
| 8 | `updateAlertSettings` | `actions/admin/alerts.ts` | アラート設定を更新 | ADMIN |
| 9 | `exportDashboardCSV` | `actions/admin/export.ts` | ダッシュボードデータをCSV出力 | ADMIN |

### 11.2 ダッシュボード一括取得

```typescript
// actions/admin/dashboard.ts
'use server';

import { auth } from '@/lib/auth';
import { getDashboardKPIs } from '@/lib/db/queries/admin-dashboard';
import { getSalesChartData } from '@/lib/db/queries/admin-sales-chart';
import { getCategoryBreakdown } from '@/lib/db/queries/admin-category-breakdown';
import { getCreatorRanking } from '@/lib/db/queries/admin-creator-ranking';
import { getRecentOrders } from '@/lib/db/queries/admin-recent-orders';
import { getUnreadAlerts } from '@/lib/db/queries/admin-alerts';
import { unstable_cache } from 'next/cache';

export type DashboardPageData = {
  kpis: DashboardKPIs;
  salesChart: SalesChartResponse;
  categoryBreakdown: CategoryBreakdownResponse;
  creatorRanking: CreatorRankingItem[];
  recentOrders: RecentOrder[];
  alerts: AdminAlert[];
};

/** ダッシュボード全体データ取得（キャッシュ付き） */
export async function getDashboardData(
  targetMonth?: string,
): Promise<DashboardPageData> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('権限がありません');
  }

  const now = new Date();
  const month =
    targetMonth ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 各データを並列取得
  const [kpis, salesChart, categoryBreakdown, creatorRanking, recentOrders, alerts] =
    await Promise.all([
      getCachedKPIs(month),
      getCachedSalesChart('monthly'),
      getCachedCategoryBreakdown(month),
      getCreatorRanking(month, 5),
      getRecentOrders(5),
      getUnreadAlerts(),
    ]);

  return {
    kpis,
    salesChart,
    categoryBreakdown,
    creatorRanking,
    recentOrders,
    alerts,
  };
}

/** KPIデータのキャッシュ（60秒） */
const getCachedKPIs = unstable_cache(
  async (month: string) => getDashboardKPIs(month),
  ['admin-dashboard-kpis'],
  { revalidate: 60, tags: ['admin-kpis'] },
);

/** 売上チャートのキャッシュ（5分） */
const getCachedSalesChart = unstable_cache(
  async (granularity: 'monthly' | 'weekly' | 'daily') =>
    getSalesChartData(granularity),
  ['admin-sales-chart'],
  { revalidate: 300, tags: ['admin-sales-chart'] },
);

/** カテゴリ別内訳のキャッシュ（5分） */
const getCachedCategoryBreakdown = unstable_cache(
  async (month: string) => getCategoryBreakdown(month),
  ['admin-category-breakdown'],
  { revalidate: 300, tags: ['admin-category-breakdown'] },
);
```

### 11.3 アナリティクス Server Actions

```typescript
// actions/admin/analytics.ts
'use server';

import { auth } from '@/lib/auth';
import { getSalesChartData } from '@/lib/db/queries/admin-sales-chart';
import { getOrderTrendData } from '@/lib/db/queries/admin-order-trend';
import { getCategoryBreakdown } from '@/lib/db/queries/admin-category-breakdown';
import { getCreatorRanking } from '@/lib/db/queries/admin-creator-ranking';

export async function getSalesChartAction(
  granularity: 'monthly' | 'weekly' | 'daily',
  range?: number,
): Promise<SalesChartResponse> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('権限がありません');
  }
  return getSalesChartData(granularity, range);
}

export async function getOrderTrendAction(
  days?: number,
): Promise<OrderTrendResponse> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('権限がありません');
  }
  return getOrderTrendData(days);
}

export async function getCategoryBreakdownAction(
  targetMonth: string,
): Promise<CategoryBreakdownResponse> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('権限がありません');
  }
  return getCategoryBreakdown(targetMonth);
}

export async function getCreatorRankingAction(
  targetMonth: string,
  limit?: number,
): Promise<CreatorRankingItem[]> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('権限がありません');
  }
  return getCreatorRanking(targetMonth, limit);
}
```

### 11.4 アラート Server Actions

```typescript
// actions/admin/alerts.ts
'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { adminAlerts, adminAlertSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import type { AlertSettings } from '@/lib/types/admin-alerts';

type ActionState = {
  success?: string;
  error?: string;
};

export async function markAlertAsRead(alertId: string): Promise<ActionState> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return { error: '権限がありません' };
  }

  await db
    .update(adminAlerts)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(adminAlerts.id, alertId));

  revalidateTag('admin-alerts');
  return { success: 'アラートを既読にしました' };
}

export async function markAllAlertsAsRead(): Promise<ActionState> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return { error: '権限がありません' };
  }

  await db
    .update(adminAlerts)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(adminAlerts.isRead, false));

  revalidateTag('admin-alerts');
  return { success: 'すべてのアラートを既読にしました' };
}

export async function dismissAlert(alertId: string): Promise<ActionState> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return { error: '権限がありません' };
  }

  await db
    .update(adminAlerts)
    .set({ isDismissed: true })
    .where(eq(adminAlerts.id, alertId));

  revalidateTag('admin-alerts');
  return { success: 'アラートを非表示にしました' };
}

export async function updateAlertSettings(
  settings: AlertSettings,
): Promise<ActionState> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    return { error: '権限がありません' };
  }

  await db
    .update(adminAlertSettings)
    .set({
      settings: JSON.stringify(settings),
      updatedAt: new Date(),
      updatedBy: session.user.id,
    })
    .where(eq(adminAlertSettings.id, 'default'));

  return { success: 'アラート設定を更新しました' };
}
```

### 11.5 CSV エクスポート

```typescript
// actions/admin/export.ts
'use server';

import { auth } from '@/lib/auth';
import { getDashboardKPIs } from '@/lib/db/queries/admin-dashboard';
import { getSalesChartData } from '@/lib/db/queries/admin-sales-chart';

export async function exportDashboardCSV(
  targetMonth: string,
): Promise<string> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('権限がありません');
  }

  const salesData = await getSalesChartData('daily', 30);

  const header = '日付,売上(円),注文数,平均注文額(円)\n';
  const rows = salesData.data
    .map(
      (d) =>
        `${d.period},${d.sales},${d.orderCount},${d.avgOrderAmount}`,
    )
    .join('\n');

  return header + rows;
}
```

### 11.6 SSE エンドポイント

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/admin/dashboard/stream` | `GET` | ダッシュボードリアルタイム更新ストリーム |

詳細は [6. リアルタイム更新仕様](#6-リアルタイム更新仕様) を参照。

---

## 12. コンポーネント設計

### 12.1 ファイル構成

```
app/
  (admin)/
    admin/
      layout.tsx                        # 管理者レイアウト（サイドバー + ヘッダー）
      page.tsx                          # ダッシュボードトップ（Server Component）
      loading.tsx                       # Suspense フォールバック
      analytics/
        page.tsx
        sales/page.tsx
        users/page.tsx
        creators/page.tsx
      alerts/
        page.tsx

components/
  admin/
    dashboard/
      dashboard-page.tsx                # ダッシュボードページ全体（Client Component ラッパー）
      kpi-card.tsx                      # KPIカード単体
      kpi-grid.tsx                      # KPIカード6枚のグリッド配置
      sparkline.tsx                     # スパークラインミニグラフ
      sales-chart.tsx                   # 売上推移チャート
      order-trend-chart.tsx             # 注文トレンドチャート
      category-pie-chart.tsx            # カテゴリ別円グラフ
      recent-orders-table.tsx           # 最近の注文テーブル
      creator-ranking-table.tsx         # クリエーター売上ランキング
      period-selector.tsx               # 期間選択セレクタ
      granularity-toggle.tsx            # 月別/週別/日別切替
      connection-status.tsx             # SSE接続状態表示
    alerts/
      alert-list.tsx                    # アラート一覧
      alert-card.tsx                    # アラートカード単体
      alert-badge.tsx                   # 未読件数バッジ
      alert-settings-dialog.tsx         # アラート設定ダイアログ
    shared/
      admin-sidebar.tsx                 # サイドバーナビゲーション
      admin-header.tsx                  # ヘッダー
      stat-change-indicator.tsx         # 変化率インジケーター（▲▼）
```

### 12.2 ダッシュボードページ（Server Component）

```typescript
// app/(admin)/admin/page.tsx

import { Suspense } from 'react';
import { getDashboardData } from '@/actions/admin/dashboard';
import { DashboardPage } from '@/components/admin/dashboard/dashboard-page';
import { DashboardSkeleton } from '@/components/admin/dashboard/dashboard-skeleton';

export const metadata = {
  title: '管理ダッシュボード | KyaraInnovate',
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent month={month} />
    </Suspense>
  );
}

async function DashboardContent({ month }: { month?: string }) {
  const data = await getDashboardData(month);
  return <DashboardPage initialData={data} />;
}
```

### 12.3 KPIカードコンポーネント

```typescript
// components/admin/dashboard/kpi-card.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkline } from './sparkline';
import { StatChangeIndicator } from '../shared/stat-change-indicator';
import type { KPICardData } from '@/lib/types/admin-dashboard';
import type { LucideIcon } from 'lucide-react';

type KPICardProps = {
  data: KPICardData;
  icon: LucideIcon;
};

export function KPICard({ data, icon: Icon }: KPICardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {data.label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{data.formattedValue}</div>
        <div className="flex items-center justify-between mt-2">
          <StatChangeIndicator
            change={data.change}
            changeType={data.changeType}
            trend={data.trend}
          />
          {data.sparklineData.length > 0 && (
            <Sparkline data={data.sparklineData} trend={data.trend} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 12.4 KPIグリッドコンポーネント

```typescript
// components/admin/dashboard/kpi-grid.tsx
'use client';

import { KPICard } from './kpi-card';
import {
  DollarSign,
  ShoppingCart,
  UserPlus,
  Palette,
  TrendingUp,
  Target,
} from 'lucide-react';
import type { DashboardKPIs } from '@/lib/types/admin-dashboard';

type KPIGridProps = {
  kpis: DashboardKPIs;
};

const kpiConfig = [
  { key: 'sales' as const, icon: DollarSign },
  { key: 'orders' as const, icon: ShoppingCart },
  { key: 'newUsers' as const, icon: UserPlus },
  { key: 'activeCreators' as const, icon: Palette },
  { key: 'avgOrderAmount' as const, icon: TrendingUp },
  { key: 'conversionRate' as const, icon: Target },
];

export function KPIGrid({ kpis }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {kpiConfig.map(({ key, icon }) => (
        <KPICard key={key} data={kpis[key]} icon={icon} />
      ))}
    </div>
  );
}
```

### 12.5 売上推移チャートコンポーネント

```typescript
// components/admin/dashboard/sales-chart.tsx
'use client';

import { useState, useTransition } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GranularityToggle } from './granularity-toggle';
import { getSalesChartAction } from '@/actions/admin/analytics';
import { CHART_COLORS, CHART_COMMON_PROPS, TOOLTIP_STYLE } from '@/lib/constants/chart-config';
import { formatCompactCurrency } from '@/lib/utils/format';
import type { SalesChartResponse } from '@/lib/types/admin-dashboard';

type SalesChartProps = {
  initialData: SalesChartResponse;
};

export function SalesChart({ initialData }: SalesChartProps) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const handleGranularityChange = (
    granularity: 'monthly' | 'weekly' | 'daily',
  ) => {
    startTransition(async () => {
      const range = granularity === 'monthly' ? 12 : granularity === 'weekly' ? 12 : 30;
      const result = await getSalesChartAction(granularity, range);
      setData(result);
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>売上推移</CardTitle>
        <GranularityToggle
          value={data.granularity}
          onChange={handleGranularityChange}
          disabled={isPending}
        />
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.data} {...CHART_COMMON_PROPS}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS.primaryGradientStart}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS.primaryGradientEnd}
                    stopOpacity={0.6}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="period" className="text-xs" />
              <YAxis
                yAxisId="sales"
                tickFormatter={(v) => formatCompactCurrency(v)}
                className="text-xs"
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                className="text-xs"
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) => {
                  if (name === '売上') return [formatCompactCurrency(value), name];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar
                yAxisId="sales"
                dataKey="sales"
                name="売上"
                fill="url(#salesGradient)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orderCount"
                name="注文数"
                stroke={CHART_COLORS.secondary}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.secondary, r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 12.6 変化率インジケーター

```typescript
// components/admin/shared/stat-change-indicator.tsx
'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatChangeIndicatorProps = {
  change: number;
  changeType: 'percent' | 'absolute';
  trend: 'up' | 'down' | 'neutral';
};

export function StatChangeIndicator({
  change,
  changeType,
  trend,
}: StatChangeIndicatorProps) {
  const Icon =
    trend === 'up'
      ? TrendingUp
      : trend === 'down'
        ? TrendingDown
        : Minus;

  const sign = change > 0 ? '+' : '';
  const suffix = changeType === 'percent' ? '%' : '';
  const display = `${sign}${change}${suffix}`;

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        trend === 'up' && 'text-green-600 dark:text-green-400',
        trend === 'down' && 'text-red-600 dark:text-red-400',
        trend === 'neutral' && 'text-muted-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{display}</span>
      <span className="text-muted-foreground">前月比</span>
    </div>
  );
}
```

### 12.7 スケルトンローディング

```typescript
// components/admin/dashboard/dashboard-skeleton.tsx

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* KPIカードスケルトン */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* チャートスケルトン */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
      </div>

      {/* テーブルスケルトン */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 13. 権限・アクセス制御

### 13.1 ロール定義

| ロール | ダッシュボードアクセス | 説明 |
|--------|-------------------|------|
| `ADMIN` | 全機能利用可 | 全KPI閲覧・設定変更・CSV出力・アラート管理 |
| `CREATOR` | アクセス不可 | `/admin/*` へのアクセスは `/` にリダイレクト |
| `CUSTOMER` | アクセス不可 | `/admin/*` へのアクセスは `/` にリダイレクト |
| 未認証 | アクセス不可 | `/auth/signin` にリダイレクト |

### 13.2 ミドルウェアによるルート保護

```typescript
// middleware.ts（関連部分のみ）

// /admin/* へのアクセスは ADMIN ロールを要求
if (pathname.startsWith('/admin')) {
  if (!session) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/', req.url));
  }
}
```

### 13.3 Server Action レベルの権限チェック

すべての管理者 Server Action は冒頭でセッション検証を行う。

```typescript
// lib/auth/admin-guard.ts

import { auth } from '@/lib/auth';

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('認証が必要です');
  }
  if (session.user.role !== 'ADMIN') {
    throw new Error('管理者権限が必要です');
  }
  return session;
}
```

**使用例:**

```typescript
export async function getDashboardData(targetMonth?: string) {
  const session = await requireAdmin();
  // ... データ取得ロジック
}
```

### 13.4 将来拡張: 細粒度権限

将来的に複数の管理者ロール（例: `SUPER_ADMIN`, `MANAGER`, `SUPPORT`）を導入する場合に備え、パーミッションベースの権限管理を検討する。

```typescript
// 将来拡張用の型定義
export type AdminPermission =
  | 'dashboard:view'
  | 'dashboard:export'
  | 'alerts:manage'
  | 'alerts:settings'
  | 'orders:manage'
  | 'users:manage'
  | 'creators:manage'
  | 'products:manage';

export type AdminRole = {
  name: string;
  permissions: AdminPermission[];
};
```

---

## 14. DB関連テーブル

### 14.1 既存テーブル参照

ダッシュボードのデータ集計は以下の既存テーブルを参照する。

| テーブル | スキーマファイル | 用途 |
|---------|----------------|------|
| `users` | `packages/db/src/schema/users.ts` | ユーザー数・新規ユーザー・ロール別集計 |
| `orders` | `packages/db/src/schema/commerce.ts` | 売上・注文数・ステータス別集計 |
| `order_items` | `packages/db/src/schema/commerce.ts` | カテゴリ別売上・クリエーター別売上 |
| `products` | `packages/db/src/schema/commerce.ts` | 在庫管理・商品別売上 |
| `blend_requests` | `packages/db/src/schema/blends.ts` | クリエーター別集計（user_id で紐付け） |
| `blend_results` | `packages/db/src/schema/blends.ts` | products → blend_results → blend_requests の結合 |
| `blend_request_keywords` | `packages/db/src/schema/blends.ts` | カテゴリ別集計 |
| `keywords` | `packages/db/src/schema/keywords.ts` | カテゴリマスタ |

### 14.2 新規テーブル: admin_alerts

```typescript
// packages/db/src/schema/admin.ts

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const adminAlerts = pgTable('admin_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 30 }).notNull(),
    // LOW_STOCK | PENDING_ORDER | LOW_RATING_REVIEW | FLAGGED_REVIEW
    // | CREATOR_APPLICATION | PAYMENT_FAILED | SALES_ANOMALY
  priority: varchar('priority', { length: 10 }).notNull(),
    // HIGH | MEDIUM | LOW
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  link: varchar('link', { length: 500 }).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  isRead: boolean('is_read').notNull().default(false),
  isDismissed: boolean('is_dismissed').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_admin_alerts_type').on(table.type),
  index('idx_admin_alerts_priority').on(table.priority),
  index('idx_admin_alerts_is_read').on(table.isRead),
  index('idx_admin_alerts_created_at').on(table.createdAt),
  index('idx_admin_alerts_unread').on(table.isRead, table.isDismissed),
]);
```

### 14.3 新規テーブル: admin_alert_settings

```typescript
export const adminAlertSettings = pgTable('admin_alert_settings', {
  id: varchar('id', { length: 50 }).primaryKey(),
    // 'default' をシングルトンキーとして使用
  settings: jsonb('settings').notNull(),
    // AlertSettings 型の JSON
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### 14.4 新規テーブル: dashboard_cache

日次集計の結果をキャッシュし、ダッシュボード表示を高速化する。

```typescript
export const dashboardCache = pgTable('dashboard_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  cacheKey: varchar('cache_key', { length: 100 }).notNull().unique(),
    // 例: "kpi:2026-01", "sales-chart:monthly:2026-01"
  data: jsonb('data').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_dashboard_cache_key').on(table.cacheKey),
  index('idx_dashboard_cache_expires').on(table.expiresAt),
]);
```

### 14.5 マイグレーション SQL

```sql
-- 20260215_admin_dashboard_tables.sql

CREATE TABLE admin_alerts (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type          VARCHAR(30)  NOT NULL,
  priority      VARCHAR(10)  NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT         NOT NULL,
  link          VARCHAR(500) NOT NULL,
  metadata      JSONB        NOT NULL DEFAULT '{}',
  is_read       BOOLEAN      NOT NULL DEFAULT FALSE,
  is_dismissed  BOOLEAN      NOT NULL DEFAULT FALSE,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_alerts_type ON admin_alerts (type);
CREATE INDEX idx_admin_alerts_priority ON admin_alerts (priority);
CREATE INDEX idx_admin_alerts_is_read ON admin_alerts (is_read);
CREATE INDEX idx_admin_alerts_created_at ON admin_alerts (created_at DESC);
CREATE INDEX idx_admin_alerts_unread ON admin_alerts (is_read, is_dismissed)
  WHERE is_read = FALSE AND is_dismissed = FALSE;

CREATE TABLE admin_alert_settings (
  id          VARCHAR(50)  PRIMARY KEY,
  settings    JSONB        NOT NULL,
  updated_by  UUID         REFERENCES users(id),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO admin_alert_settings (id, settings) VALUES ('default', '{
  "lowStock": { "enabled": true, "threshold": 5, "checkIntervalMinutes": 15 },
  "pendingOrder": { "enabled": true, "thresholdHours": 24, "checkIntervalMinutes": 30 },
  "lowRatingReview": { "enabled": true, "ratingThreshold": 2 },
  "flaggedReview": { "enabled": true, "flagCountThreshold": 2 },
  "salesAnomaly": { "enabled": true, "dropPercentThreshold": 50 }
}');

CREATE TABLE dashboard_cache (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   VARCHAR(100) NOT NULL UNIQUE,
  data        JSONB        NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dashboard_cache_key ON dashboard_cache (cache_key);
CREATE INDEX idx_dashboard_cache_expires ON dashboard_cache (expires_at);
```

### 14.6 ER図（ダッシュボード関連）

```
┌──────────┐      ┌──────────────┐      ┌──────────────┐
│  users   │      │   orders     │      │ order_items  │
│          │◄─────│  userId      │──────►│  orderId     │
│  id      │      │  totalYen    │      │  productId   │
│  role    │      │  status      │      │  priceYen    │
│  name    │      │  createdAt   │      │  quantity    │
└──────────┘      └──────────────┘      └──────┬───────┘
                                               │
                                               │ productId
                                               ▼
                                        ┌──────────────┐
                                        │  products    │
                                        │  blendResultId├───┐
                                        └──────────────┘   │
                                                           │
                  ┌──────────────┐      ┌──────────────┐   │
                  │blend_requests│◄─────│blend_results │◄──┘
                  │  userId      │      │blendRequestId│
                  └──────┬───────┘      └──────────────┘
                         │
                         │
              ┌──────────▼──────────┐
              │blend_request_keywords│
              │  keywordId          │───►┌───────────┐
              └─────────────────────┘    │ keywords  │
                                         │ category  │
                                         └───────────┘

┌──────────────────┐     ┌──────────────────────┐
│  admin_alerts    │     │ admin_alert_settings  │
│                  │     │                       │
│  type            │     │  settings (JSONB)     │
│  priority        │     │  updatedBy → users    │
│  isRead          │     └──────────────────────┘
│  metadata (JSONB)│
└──────────────────┘

┌──────────────────┐
│ dashboard_cache  │
│                  │
│  cacheKey        │
│  data (JSONB)    │
│  expiresAt       │
└──────────────────┘
```

---

## 15. パフォーマンス考慮事項

### 15.1 キャッシュ戦略

| レイヤー | 方式 | TTL | 無効化トリガー |
|---------|------|-----|-------------|
| Next.js `unstable_cache` | KPIデータ | 60秒 | 注文ステータス変更時 `revalidateTag('admin-kpis')` |
| Next.js `unstable_cache` | 売上チャート | 300秒 | 新規注文作成時 `revalidateTag('admin-sales-chart')` |
| Next.js `unstable_cache` | カテゴリ別 | 300秒 | 新規注文作成時 `revalidateTag('admin-category-breakdown')` |
| DB `dashboard_cache` | 日次集計結果 | 24時間 | 日次バッチ処理で更新 |
| HTTP `Cache-Control` | 静的アセット | 1年 | デプロイ時 |

### 15.2 キャッシュ無効化

注文関連の状態が変更された際に、関連するキャッシュタグを無効化する。

```typescript
// lib/cache/invalidation.ts

import { revalidateTag } from 'next/cache';

/** 注文ステータス変更時に呼び出す */
export function invalidateOrderRelatedCaches() {
  revalidateTag('admin-kpis');
  revalidateTag('admin-sales-chart');
  revalidateTag('admin-category-breakdown');
  revalidateTag('admin-recent-orders');
}

/** ユーザー登録時に呼び出す */
export function invalidateUserRelatedCaches() {
  revalidateTag('admin-kpis');
}
```

### 15.3 データベース最適化

#### インデックス設計

```sql
-- ダッシュボード集計に必要な複合インデックス
CREATE INDEX idx_orders_status_created
  ON orders (status, created_at DESC);

CREATE INDEX idx_orders_paid_created
  ON orders (created_at DESC)
  WHERE status NOT IN ('PENDING', 'CANCELLED');

CREATE INDEX idx_order_items_order_product
  ON order_items (order_id, product_id);

CREATE INDEX idx_users_role_created
  ON users (role, created_at DESC);

-- 部分インデックス: 未読アラートのみ
CREATE INDEX idx_admin_alerts_active
  ON admin_alerts (created_at DESC)
  WHERE is_read = FALSE AND is_dismissed = FALSE;
```

#### クエリ最適化方針

| 方針 | 説明 |
|------|------|
| 集約クエリの最小化 | `Promise.all` で並列実行し、レスポンスタイムを短縮 |
| 部分インデックス | 頻繁にフィルタされるカラム（`status`, `is_read`）に部分インデックスを作成 |
| マテリアライズドビュー | 日次集計は `dashboard_cache` テーブルに事前計算結果を格納 |
| EXPLAIN ANALYZE | 本番投入前にすべての集計クエリの実行計画を検証 |

### 15.4 日次バッチ処理

```typescript
// lib/jobs/daily-dashboard-aggregation.ts

/**
 * 日次集計バッチ（毎日 AM 3:00 JST に cron で実行）
 * - 前日までの確定データを集計して dashboard_cache に格納
 * - 過去12ヶ月分の月次サマリーを更新
 */
export async function runDailyDashboardAggregation() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // 月次サマリーの更新
  const months = getLast12Months();
  for (const month of months) {
    const kpis = await getDashboardKPIs(month);
    await upsertDashboardCache(
      `kpi:${month}`,
      kpis,
      new Date(Date.now() + 24 * 60 * 60 * 1000), // 24時間後に期限切れ
    );
  }

  // 売上チャートデータの更新
  for (const granularity of ['monthly', 'weekly', 'daily'] as const) {
    const data = await getSalesChartData(granularity);
    await upsertDashboardCache(
      `sales-chart:${granularity}`,
      data,
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
  }

  // 期限切れキャッシュの削除
  await db
    .delete(dashboardCache)
    .where(lt(dashboardCache.expiresAt, new Date()));
}

async function upsertDashboardCache(
  key: string,
  data: unknown,
  expiresAt: Date,
) {
  await db
    .insert(dashboardCache)
    .values({
      cacheKey: key,
      data: JSON.stringify(data),
      expiresAt,
    })
    .onConflictDoUpdate({
      target: dashboardCache.cacheKey,
      set: {
        data: JSON.stringify(data),
        expiresAt,
        createdAt: new Date(),
      },
    });
}
```

### 15.5 ページネーション

ダッシュボード上のテーブル（最近の注文・クリエーターランキング）は件数を制限して表示する。「全て見る」リンクから遷移する各管理画面ではカーソルベースページネーションを使用する。

```typescript
// lib/db/queries/pagination.ts

export type PaginationParams = {
  cursor?: string;      // 最後のアイテムの ID
  limit: number;        // 1ページあたりの件数（デフォルト: 20, 最大: 100）
  direction: 'next' | 'prev';
};

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  totalCount: number;
};

/** カーソルベースページネーション付き注文一覧 */
export async function getOrdersPaginated(
  params: PaginationParams & {
    status?: string;
    dateRange?: { start: Date; end: Date };
  },
): Promise<PaginatedResult<Order>> {
  const { cursor, limit, direction, status, dateRange } = params;
  const effectiveLimit = Math.min(limit, 100);

  const conditions = [];
  if (status) {
    conditions.push(eq(orders.status, status));
  }
  if (dateRange) {
    conditions.push(gte(orders.createdAt, dateRange.start));
    conditions.push(lte(orders.createdAt, dateRange.end));
  }
  if (cursor && direction === 'next') {
    conditions.push(lt(orders.id, cursor));
  }
  if (cursor && direction === 'prev') {
    conditions.push(gt(orders.id, cursor));
  }

  const items = await db
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(effectiveLimit + 1); // +1 で次ページの存在を判定

  const hasMore = items.length > effectiveLimit;
  if (hasMore) items.pop();

  const [{ count: totalCount }] = await db
    .select({ count: count() })
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    prevCursor: cursor ?? null,
    hasMore,
    totalCount,
  };
}
```

### 15.6 バンドルサイズ最適化

| 対策 | 説明 |
|------|------|
| Recharts の動的インポート | チャートコンポーネントを `next/dynamic` で遅延読み込み |
| Server Components 活用 | データフェッチはServer Component側で行い、Client Componentに渡す |
| Tree Shaking | Recharts から必要なコンポーネントのみ個別インポート |
| 画像最適化 | `next/image` によるアバター画像の最適化 |

```typescript
// components/admin/dashboard/lazy-charts.tsx

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const LazySalesChart = dynamic(
  () => import('./sales-chart').then((mod) => mod.SalesChart),
  {
    loading: () => <Skeleton className="h-[350px] w-full" />,
    ssr: false,
  },
);

export const LazyOrderTrendChart = dynamic(
  () => import('./order-trend-chart').then((mod) => mod.OrderTrendChart),
  {
    loading: () => <Skeleton className="h-[350px] w-full" />,
    ssr: false,
  },
);

export const LazyCategoryPieChart = dynamic(
  () => import('./category-pie-chart').then((mod) => mod.CategoryPieChart),
  {
    loading: () => <Skeleton className="h-[350px] w-full" />,
    ssr: false,
  },
);
```

### 15.7 エラーハンドリング

```typescript
// app/(admin)/admin/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">
        ダッシュボードの読み込みに失敗しました
      </h2>
      <p className="text-muted-foreground text-sm">
        {error.message || 'データの取得中にエラーが発生しました。'}
      </p>
      <Button onClick={reset} variant="outline">
        再試行
      </Button>
    </div>
  );
}
```

---

## 変更履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-02-15 | 1.0 | 初版作成（KPIダッシュボード・注文管理・ユーザー管理・商品管理・クリエーター管理） |
| 2026-02-15 | 2.0 | アナリティクス・リアルタイム更新・アラートシステム・コンポーネント設計・パフォーマンス最適化を追加 |
| 2026-02-15 | 3.0 | 受注生産EC特化に再設計。調香パイプライン・クリエーターティア分布・レビュー状況セクション追加。KPI昨対比追加。最近の注文をニックネーム表示に変更。 |

---

*最終更新: 2026年2月15日*
