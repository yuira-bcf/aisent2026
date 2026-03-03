# あしあと機能 設計書

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate |
| 対象機能 | あしあと（訪問者追跡・閲覧履歴） |
| バージョン | 1.0 |
| 作成日 | 2026-02-15 |

---

## 1. 概要

クリエーターが自分のページ（プロフィール・商品・調合結果）への訪問者を確認できる機能。
マーケティング・集客分析のための情報提供を目的とする。

- 閲覧権限: クリエーターのみ
- 追跡対象: クリエータープロフィール / ショップ商品 / 調合結果ページ
- 訪問者表示: ニックネーム + アバター
- プライバシー: ユーザーが「あしあとを残す/残さない」を設定可能

---

## 2. あしあと記録ロジック

### 2.1 記録タイミング

| イベント | 条件 | 記録 |
|---------|------|------|
| ページ閲覧 | ログインユーザーがクリエーター関連ページを閲覧 | page_visits に INSERT |
| 同一ユーザー同一ページ | 同日中に同一ユーザーが同一ページを再閲覧 | 既存レコードの visited_at を UPDATE（重複カウントしない） |
| 未ログインユーザー | ゲスト閲覧 | 記録しない |
| あしあとOFFユーザー | settings.footprint_enabled = false | 記録しない |
| クリエーター本人 | 自分のページを閲覧 | 記録しない |

### 2.2 記録処理 (Server Action)

```typescript
// actions/footprint.ts

const recordFootprintSchema = z.object({
  pageType: z.enum(['PROFILE', 'PRODUCT', 'BLEND_RESULT']),
  targetId: z.string().uuid(), // creator_id, product_id, or blend_request_id
});

export async function recordFootprint(input: RecordFootprintInput): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return; // ゲストは記録しない

  const { pageType, targetId } = input;

  // クリエーターIDを解決
  const creatorId = await resolveCreatorId(pageType, targetId);
  if (!creatorId) return;

  // 自分のページは記録しない
  if (creatorId === session.user.id) return;

  // あしあと設定を確認
  const userSettings = await getUserSettings(session.user.id);
  if (!userSettings.footprintEnabled) return;

  // 同日重複チェック（UPSERT）
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db
    .insert(pageVisits)
    .values({
      visitorId: session.user.id,
      creatorId,
      pageType,
      targetId,
      visitedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [pageVisits.visitorId, pageVisits.creatorId, pageVisits.pageType, pageVisits.targetId, pageVisits.visitDate],
      set: { visitedAt: new Date(), visitCount: sql`${pageVisits.visitCount} + 1` },
    });
}
```

### 2.3 クリエーターID解決

```typescript
async function resolveCreatorId(pageType: PageType, targetId: string): Promise<string | null> {
  switch (pageType) {
    case 'PROFILE':
      return targetId; // targetId = creator_id
    case 'PRODUCT':
      const product = await db.query.products.findFirst({
        where: eq(products.id, targetId),
        columns: { creatorId: true },
      });
      return product?.creatorId ?? null;
    case 'BLEND_RESULT':
      const blend = await db.query.blendRequests.findFirst({
        where: eq(blendRequests.id, targetId),
        columns: { creatorId: true },
      });
      return blend?.creatorId ?? null;
  }
}
```

---

## 3. DBスキーマ

### 3.1 page_visits テーブル

```typescript
// packages/db/src/schema/page-visits.ts

import { pgTable, uuid, varchar, integer, timestamp, date, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';

export const pageTypeEnum = ['PROFILE', 'PRODUCT', 'BLEND_RESULT'] as const;
export type PageType = (typeof pageTypeEnum)[number];

export const pageVisits = pgTable(
  'page_visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // 訪問者
    visitorId: uuid('visitor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // 訪問先クリエーター
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // ページ種別
    pageType: varchar('page_type', { length: 20 }).notNull().$type<PageType>(),

    // 対象ID（creator_id / product_id / blend_request_id）
    targetId: uuid('target_id').notNull(),

    // 訪問日（日単位の重複制御用）
    visitDate: date('visit_date').notNull().defaultNow(),

    // 同日内の訪問回数
    visitCount: integer('visit_count').notNull().default(1),

    // 最終訪問時刻
    visitedAt: timestamp('visited_at').notNull().defaultNow(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    // 同日・同ユーザー・同ページの重複防止
    unique('uq_page_visits_daily').on(
      table.visitorId,
      table.creatorId,
      table.pageType,
      table.targetId,
      table.visitDate,
    ),
    index('idx_page_visits_creator').on(table.creatorId),
    index('idx_page_visits_visitor').on(table.visitorId),
    index('idx_page_visits_visited_at').on(table.visitedAt),
    index('idx_page_visits_creator_date').on(table.creatorId, table.visitDate),
  ],
);

export const pageVisitsRelations = relations(pageVisits, ({ one }) => ({
  visitor: one(users, {
    fields: [pageVisits.visitorId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [pageVisits.creatorId],
    references: [users.id],
  }),
}));
```

### 3.2 users テーブル追加カラム

```typescript
// 既存の users テーブルに追加
footprintEnabled: boolean('footprint_enabled').notNull().default(true),
```

### 3.3 ER図

```
page_visits
  ├── visitor_id → users (CUSTOMER/CREATOR)
  ├── creator_id → users (CREATOR)
  ├── page_type (PROFILE / PRODUCT / BLEND_RESULT)
  ├── target_id (polymorphic FK)
  ├── visit_date (日単位)
  ├── visit_count (同日訪問回数)
  └── visited_at (最終時刻)

users
  └── footprint_enabled (boolean, default: true)
```

---

## 4. データ取得 (Server Actions)

### 4.1 あしあと一覧取得

```typescript
// actions/footprint.ts

const getFootprintsSchema = z.object({
  pageType: z.enum(['PROFILE', 'PRODUCT', 'BLEND_RESULT']).optional(), // フィルター
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export async function getFootprints(input: GetFootprintsInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('認証が必要です');

  const conditions = [eq(pageVisits.creatorId, session.user.id)];
  if (input.pageType) {
    conditions.push(eq(pageVisits.pageType, input.pageType));
  }

  const visits = await db.query.pageVisits.findMany({
    where: and(...conditions),
    with: {
      visitor: { columns: { id: true, nickname: true, image: true } },
    },
    orderBy: [desc(pageVisits.visitedAt)],
    limit: input.limit,
    offset: input.offset,
  });

  return visits;
}
```

### 4.2 訪問サマリー取得

```typescript
export async function getFootprintSummary() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('認証が必要です');

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const lastYearMonthStart = subYears(monthStart, 1);
  const lastYearMonthEnd = endOfMonth(lastYearMonthStart);

  const [today, thisWeek, thisMonth, lastYearMonth] = await Promise.all([
    countVisitors(session.user.id, todayStart, now),
    countVisitors(session.user.id, weekStart, now),
    countVisitors(session.user.id, monthStart, now),
    countVisitors(session.user.id, lastYearMonthStart, lastYearMonthEnd),
  ]);

  return { today, thisWeek, thisMonth, lastYearMonth };
}

async function countVisitors(creatorId: string, from: Date, to: Date): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(distinct ${pageVisits.visitorId})` })
    .from(pageVisits)
    .where(and(
      eq(pageVisits.creatorId, creatorId),
      gte(pageVisits.visitedAt, from),
      lte(pageVisits.visitedAt, to),
    ));
  return Number(result[0].count);
}
```

### 4.3 リピート訪問者取得

```typescript
export async function getRepeatVisitors(limit = 10) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('認証が必要です');

  const monthStart = startOfMonth(new Date());

  const result = await db
    .select({
      visitorId: pageVisits.visitorId,
      visitCount: sql<number>`count(*)`,
      lastVisit: sql<Date>`max(${pageVisits.visitedAt})`,
    })
    .from(pageVisits)
    .where(and(
      eq(pageVisits.creatorId, session.user.id),
      gte(pageVisits.visitedAt, monthStart),
    ))
    .groupBy(pageVisits.visitorId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  // Enrich with user info (nickname, avatar)
  // ...

  return result;
}
```

### 4.4 人気ページランキング

```typescript
export async function getPopularPages(limit = 5) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('認証が必要です');

  const monthStart = startOfMonth(new Date());

  const result = await db
    .select({
      pageType: pageVisits.pageType,
      targetId: pageVisits.targetId,
      viewCount: sql<number>`count(*)`,
    })
    .from(pageVisits)
    .where(and(
      eq(pageVisits.creatorId, session.user.id),
      gte(pageVisits.visitedAt, monthStart),
    ))
    .groupBy(pageVisits.pageType, pageVisits.targetId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return result;
}
```

---

## 5. UI仕様

### 5.1 あしあと画面

| セクション | 内容 |
|-----------|------|
| 訪問サマリー | 今日・今週・今月の訪問者数（昨年同月比付き） |
| フィルタータブ | 全て / プロフィール / 商品 / 調合結果 |
| 時間帯別アクセス | 6スロットの棒グラフ |
| 今日の訪問者 | タイムライン形式（アバター・ニックネーム・閲覧ページ・時間） |
| リピート訪問者 | 今月の訪問回数順リスト（常連バッジ付き） |
| 人気ページ TOP 5 | ページ名・閲覧回数・比率バー |

### 5.2 ページ種別バッジ

| ページ種別 | ラベル | 背景色 | 文字色 |
|-----------|--------|--------|--------|
| PROFILE | プロフィール | #eff6ff | #3b82f6 |
| PRODUCT | 商品 | #fdf2f8 | #ec4899 |
| BLEND_RESULT | 調合結果 | #f5f3ff | #7c3aed |

### 5.3 アクセス元

- クリエーターダッシュボード Quick Links に「あしあと」ボタンを追加
- マイページのクリエーターメニューにも追加

---

## 6. プライバシー設定

### 6.1 ユーザー設定

| 設定項目 | キー | 型 | デフォルト | 説明 |
|---------|------|---|----------|------|
| あしあとを残す | footprint_enabled | boolean | true | false の場合、訪問が記録されない |

### 6.2 設定画面への追加

マイページ → 設定 に以下のトグルを追加:

```
あしあとを残す
  ON: あなたがクリエーターのページを訪問した際に、
      クリエーターにニックネームが表示されます
  OFF: 訪問が記録されません（完全匿名）
```

### 6.3 データ保持期間

| 期間 | 処理 |
|------|------|
| 90日以上経過 | 月次バッチで自動削除（個人特定情報） |
| 集計データ | 月次サマリーとして永続保持（匿名化済み） |

---

## 7. パフォーマンス考慮

### 7.1 書き込み負荷

| 対策 | 説明 |
|------|------|
| UPSERT | 同日の重複訪問は UPDATE のみ（INSERT 不要） |
| 非同期記録 | `recordFootprint` はレスポンスをブロックしない（fire-and-forget） |
| バッチ挿入 | 高トラフィック時はキューイングを検討（Phase 2） |

### 7.2 読み込み負荷

| 対策 | 説明 |
|------|------|
| インデックス | creator_id + visited_at の複合インデックス |
| ページネーション | デフォルト20件、無限スクロール |
| キャッシュ | サマリーデータは5分間キャッシュ |

---

## 8. 将来の拡張

| 機能 | フェーズ | 説明 |
|------|---------|------|
| プッシュ通知 | Phase 2 | 「〇〇さんがあなたのプロフィールを閲覧しました」 |
| 訪問者分析 | Phase 2 | 訪問者の属性分析（新規/リピーター比率の推移） |
| 離脱分析 | Phase 3 | どのページで離脱したかの追跡 |
| コンバージョン追跡 | Phase 3 | 閲覧→購入のファネル分析 |
| あしあと返し | Phase 3 | クリエーターが訪問者のプロフィールを確認できる |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-15 | 初版作成 |

---

*最終更新: 2026年2月15日*
