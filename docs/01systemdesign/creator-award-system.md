# クリエーターアワードシステム設計書

## 概要

クリエーターの実績を多角的に評価し、モチベーション向上と差別化を促進するアワード制度。
フレグランスマップの4象限アワードを軸に、品質・人気・革新性など複数カテゴリの賞を設定する。

---

## アワード期間

| 期間 | コード | 範囲 | 選定時期 |
|------|--------|------|---------|
| 🌸 春 | `SPRING` | 4月1日 〜 6月30日 | 7月第1週 |
| ☀️ 夏 | `SUMMER` | 7月1日 〜 9月30日 | 10月第1週 |
| 🍂 秋 | `AUTUMN` | 10月1日 〜 12月31日 | 1月第1週 |
| ❄️ 冬 | `WINTER` | 1月1日 〜 3月31日 | 4月第1週 |

**年4回のアワード選定**を行い、各期間ごとに全賞の順位を決定する。

---

## A. フレグランスマップ領域賞（4象限）

### 賞定義

| 賞名 | 象限 | マップ座標範囲 | 代表的な香調 |
|------|------|-------------|------------|
| **Fresh Floral Award** | 左上 | x < 0, y > 0 | シトラス×フローラル、軽やかな花 |
| **Warm Floral Award** | 右上 | x > 0, y > 0 | リッチフローラル、パウダリー |
| **Fresh Woody Award** | 左下 | x < 0, y < 0 | マリン、アロマティック、シトラスウッド |
| **Warm Woody Award** | 右下 | x > 0, y < 0 | オリエンタル、スパイス、アンバー |

### 選定ロジック

```typescript
interface MapAreaAwardInput {
  creatorId: string;
  period: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
  quadrant: 'FRESH_FLORAL' | 'WARM_FLORAL' | 'FRESH_WOODY' | 'WARM_WOODY';
}

function selectMapAreaAward(quadrant: Quadrant, period: Period): AwardResult {
  // 1. 期間内の全調合結果を取得
  const blends = getBlendsByPeriod(period);

  // 2. マップ座標が該当象限に含まれる調合をフィルタ
  const quadrantBlends = blends.filter(b => isInQuadrant(b.position, quadrant));

  // 3. クリエーターごとに集計
  const creatorScores = groupByCreator(quadrantBlends).map(group => {
    const avgRating = average(group.blends.map(b => b.rating));
    const blendCount = group.blends.length;
    const avgSimilarityDepth = average(group.blends.map(b => b.mapDistanceFromCenter));

    // スコア = 評価(50%) + 調合数の対数(25%) + 象限内の深度(25%)
    // 深度: 象限の中心に近いほど、そのエリアの専門性が高いと評価
    const score =
      normalize(avgRating, 1, 5) * 0.50 +
      logNormalize(blendCount, 50) * 0.25 +
      normalize(avgSimilarityDepth, 0, 1.414) * 0.25;

    return { creatorId: group.creatorId, score, avgRating, blendCount };
  });

  // 4. 足切り: 該当象限で最低5調合 + ★3.5以上
  const eligible = creatorScores.filter(c =>
    c.blendCount >= 5 && c.avgRating >= 3.5
  );

  // 5. スコア降順でソート → 1位が受賞
  return eligible.sort((a, b) => b.score - a.score)[0];
}

// 象限判定
function isInQuadrant(pos: {x: number, y: number}, quadrant: Quadrant): boolean {
  switch (quadrant) {
    case 'FRESH_FLORAL': return pos.x <= 0 && pos.y >= 0;
    case 'WARM_FLORAL':  return pos.x >= 0 && pos.y >= 0;
    case 'FRESH_WOODY':  return pos.x <= 0 && pos.y <= 0;
    case 'WARM_WOODY':   return pos.x >= 0 && pos.y <= 0;
  }
}

// 象限中心からの距離（深度）— 象限の中心 = (±0.5, ±0.5)
function mapDistanceFromCenter(pos: {x: number, y: number}, quadrant: Quadrant): number {
  const centers = {
    FRESH_FLORAL: { x: -0.5, y: 0.5 },
    WARM_FLORAL:  { x: 0.5, y: 0.5 },
    FRESH_WOODY:  { x: -0.5, y: -0.5 },
    WARM_WOODY:   { x: 0.5, y: -0.5 },
  };
  const c = centers[quadrant];
  return Math.sqrt((pos.x - c.x) ** 2 + (pos.y - c.y) ** 2);
}
```

### 重み内訳

| 指標 | 重み | 理由 |
|------|------|------|
| 平均評価 | 50% | 品質が最も重要 |
| 調合数（対数） | 25% | 一定の経験を評価（対数で大量生産有利を抑制） |
| 象限深度 | 25% | そのエリアの専門性を評価 |

---

## B. Golden Blend Award（品質賞）

期間内の全調合における★平均が最も高いクリエーター。

### 選定ロジック

```typescript
function selectGoldenBlend(period: Period): AwardResult {
  const stats = getCreatorStatsByPeriod(period);

  // 足切り: 最低20調合 + 最低10レビュー
  const eligible = stats.filter(s =>
    s.blendCount >= 20 && s.reviewCount >= 10
  );

  // ★平均の降順。同率の場合はレビュー数が多い方を優先
  return eligible.sort((a, b) =>
    b.avgRating - a.avgRating || b.reviewCount - a.reviewCount
  )[0];
}
```

| 指標 | 基準 |
|------|------|
| ソートキー | ★平均（降順） |
| 足切り | 期間内20調合以上、10レビュー以上 |
| タイブレーク | レビュー数が多い方 |

---

## C. Most Loved Award（人気賞）

期間内に獲得した♥（お気に入り）数が最も多いクリエーター。

### 選定ロジック

```typescript
function selectMostLoved(period: Period): AwardResult {
  const favorites = getFavoritesByPeriod(period);

  // クリエーターごとの期間内♥獲得数を集計
  const counts = groupByCreator(favorites).map(g => ({
    creatorId: g.creatorId,
    favoriteCount: g.items.length,
    uniqueUsers: new Set(g.items.map(f => f.userId)).size,
  }));

  // 足切り: 最低10ユニークユーザーから♥
  const eligible = counts.filter(c => c.uniqueUsers >= 10);

  // ♥数の降順。同率はユニークユーザー数で判定
  return eligible.sort((a, b) =>
    b.favoriteCount - a.favoriteCount || b.uniqueUsers - a.uniqueUsers
  )[0];
}
```

| 指標 | 基準 |
|------|------|
| ソートキー | ♥獲得数（降順） |
| 足切り | 10ユニークユーザー以上から♥ |
| タイブレーク | ユニークユーザー数 |

---

## D. Signature Scent Award（リピート賞）

リピート率（同じクリエーターに再注文したユーザーの割合）が最も高いクリエーター。

### 選定ロジック

```typescript
function selectSignatureScent(period: Period): AwardResult {
  const orders = getOrdersByPeriod(period);

  const creatorRepeat = groupByCreator(orders).map(g => {
    const userOrders = groupBy(g.orders, 'userId');
    const totalUsers = Object.keys(userOrders).length;
    const repeatUsers = Object.values(userOrders).filter(o => o.length >= 2).length;
    const repeatRate = totalUsers > 0 ? (repeatUsers / totalUsers) * 100 : 0;

    return { creatorId: g.creatorId, repeatRate, totalUsers, repeatUsers };
  });

  // 足切り: 最低15ユニークユーザー（少数サンプルで高リピート率になるのを防止）
  const eligible = creatorRepeat.filter(c => c.totalUsers >= 15);

  // リピート率の降順
  return eligible.sort((a, b) =>
    b.repeatRate - a.repeatRate || b.totalUsers - a.totalUsers
  )[0];
}
```

| 指標 | 基準 |
|------|------|
| ソートキー | リピート率（降順） |
| 足切り | 期間内15ユニークユーザー以上 |
| タイブレーク | 総ユーザー数 |

---

## E. Rising Star Award（新人賞）

登録1年以内のクリエーターで、最も急成長したクリエーター。

### 選定ロジック

```typescript
function selectRisingStar(period: Period): AwardResult {
  const newCreators = getCreatorsRegisteredWithin(365); // 登録1年以内

  const scores = newCreators.map(c => {
    const stats = getCreatorStatsByPeriod(period, c.id);
    const monthsActive = monthsSinceRegistration(c.createdAt);

    // 成長スコア = (調合数/月) × ★平均 × (1 + ♥数の対数/10)
    const blendsPerMonth = monthsActive > 0 ? stats.blendCount / monthsActive : 0;
    const growthScore = blendsPerMonth * stats.avgRating * (1 + Math.log(stats.favoriteCount + 1) / 10);

    return { creatorId: c.id, growthScore, ...stats };
  });

  // 足切り: 最低10調合 + ★3.0以上
  const eligible = scores.filter(s =>
    s.blendCount >= 10 && s.avgRating >= 3.0
  );

  return eligible.sort((a, b) => b.growthScore - a.growthScore)[0];
}
```

| 指標 | 基準 |
|------|------|
| スコア | `(調合数/活動月数) × ★平均 × (1 + ln(♥+1)/10)` |
| 対象 | 登録1年以内 |
| 足切り | 10調合以上、★3.0以上 |

---

## F. Innovation Award（革新賞）

既存リファレンスや他クリエーターの調合と最も異なるユニークな配合で、かつ高評価を得たクリエーター。

### 選定ロジック

```typescript
function selectInnovation(period: Period): AwardResult {
  const blends = getBlendsByPeriod(period);

  const scores = groupByCreator(blends).map(group => {
    // 各調合について、全リファレンス + 他クリエーター調合とのコサイン類似度の最大値を取得
    // → 最大類似度が低い = よりユニーク
    const uniquenessScores = group.blends.map(b => {
      const maxSimilarity = Math.max(
        ...referenceFragrances.map(r => cosineSimilarity(b.vector, r.vector)),
        ...otherBlends.map(o => cosineSimilarity(b.vector, o.vector))
      );
      return 1 - maxSimilarity; // 反転: 類似度が低い方が高スコア
    });

    const avgUniqueness = average(uniquenessScores);
    const avgRating = average(group.blends.map(b => b.rating));

    // 革新スコア = ユニークネス(60%) × 評価(40%)
    // 評価を掛けることで「変わってるだけ」の低評価を除外
    const innovationScore = avgUniqueness * 0.60 + normalize(avgRating, 1, 5) * 0.40;

    return { creatorId: group.creatorId, innovationScore, avgUniqueness, avgRating };
  });

  // 足切り: 最低10調合 + ★3.5以上
  const eligible = scores.filter(s =>
    s.blendCount >= 10 && s.avgRating >= 3.5
  );

  return eligible.sort((a, b) => b.innovationScore - a.innovationScore)[0];
}
```

| 指標 | 重み | 理由 |
|------|------|------|
| ユニークネス（1 - 最大コサイン類似度） | 60% | 独自性を重視 |
| ★平均 | 40% | 品質の担保 |
| 足切り | - | 10調合以上、★3.5以上 |

---

## G. Versatile Creator Award（万能賞）

フレグランスマップの4象限すべてで一定以上の品質を維持したクリエーター。

### 選定ロジック

```typescript
function selectVersatile(period: Period): AwardResult {
  const blends = getBlendsByPeriod(period);
  const quadrants: Quadrant[] = ['FRESH_FLORAL', 'WARM_FLORAL', 'FRESH_WOODY', 'WARM_WOODY'];

  const scores = groupByCreator(blends).map(group => {
    const quadrantStats = quadrants.map(q => {
      const qBlends = group.blends.filter(b => isInQuadrant(b.position, q));
      return {
        quadrant: q,
        count: qBlends.length,
        avgRating: qBlends.length > 0 ? average(qBlends.map(b => b.rating)) : 0,
      };
    });

    // 全4象限で3調合以上 かつ ★3.5以上
    const allCovered = quadrantStats.every(qs => qs.count >= 3 && qs.avgRating >= 3.5);
    if (!allCovered) return null;

    // 万能スコア = 4象限の★平均の最小値(40%) + 4象限の★平均の平均(30%) + 総調合数の対数(30%)
    const minRating = Math.min(...quadrantStats.map(qs => qs.avgRating));
    const avgRating = average(quadrantStats.map(qs => qs.avgRating));
    const totalCount = group.blends.length;

    const versatileScore =
      normalize(minRating, 1, 5) * 0.40 +
      normalize(avgRating, 1, 5) * 0.30 +
      logNormalize(totalCount, 200) * 0.30;

    return { creatorId: group.creatorId, versatileScore, quadrantStats };
  }).filter(Boolean);

  return scores.sort((a, b) => b.versatileScore - a.versatileScore)[0];
}
```

| 指標 | 重み | 理由 |
|------|------|------|
| 4象限の★最小値 | 40% | 弱点がないことを重視 |
| 4象限の★平均 | 30% | 全体的な品質 |
| 総調合数（対数） | 30% | 十分な経験 |
| 必須条件 | - | 全4象限で3調合以上 + ★3.5以上 |

---

## H. Season Master（季節賞 × 4）

各季節タグの調合で最も高評価のクリエーター。春・夏・秋・冬の4賞。

### 選定ロジック

```typescript
function selectSeasonMaster(season: 'spring' | 'summer' | 'autumn' | 'winter', period: Period): AwardResult {
  const blends = getBlendsByPeriod(period)
    .filter(b => b.seasonTags.includes(season));

  const scores = groupByCreator(blends).map(group => ({
    creatorId: group.creatorId,
    avgRating: average(group.blends.map(b => b.rating)),
    blendCount: group.blends.length,
  }));

  // 足切り: 該当季節で8調合以上 + ★3.5以上
  const eligible = scores.filter(s =>
    s.blendCount >= 8 && s.avgRating >= 3.5
  );

  // ★平均降順、同率は調合数で判定
  return eligible.sort((a, b) =>
    b.avgRating - a.avgRating || b.blendCount - a.blendCount
  )[0];
}
```

| 指標 | 基準 |
|------|------|
| ソートキー | ★平均（降順） |
| 足切り | 該当季節8調合以上、★3.5以上 |

---

## I. Best Story Award（ストーリー賞）

AI生成ストーリー付き調合の満足度が最も高いクリエーター。
ストーリーの満足度はユーザーの「いいね」or 5段階評価で計測。

### 選定ロジック

```typescript
function selectBestStory(period: Period): AwardResult {
  const stories = getStoryRatingsByPeriod(period);

  const scores = groupByCreator(stories).map(group => ({
    creatorId: group.creatorId,
    avgStoryRating: average(group.stories.map(s => s.storyRating)),
    storyCount: group.stories.length,
    // ストーリーの「いいね」率
    likeRate: group.stories.filter(s => s.liked).length / group.stories.length,
  }));

  // 足切り: 10ストーリー以上
  const eligible = scores.filter(s => s.storyCount >= 10);

  // スコア = ストーリー評価(60%) + いいね率(40%)
  return eligible.map(s => ({
    ...s,
    score: normalize(s.avgStoryRating, 1, 5) * 0.60 + s.likeRate * 0.40,
  })).sort((a, b) => b.score - a.score)[0];
}
```

| 指標 | 重み |
|------|------|
| ストーリー評価 | 60% |
| いいね率 | 40% |
| 足切り | 10ストーリー以上 |

---

## J. Hall of Fame（殿堂入り）

3年連続で、毎年4期中3期以上いずれかの賞を受賞したクリエーター。

### 選定ロジック

```typescript
function checkHallOfFame(creatorId: string): boolean {
  const currentYear = getCurrentFiscalYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  // 直近3年連続で、毎年4期中3期以上で受賞しているか
  return years.every(year => {
    const seasons: AwardPeriod[] = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
    const wonSeasons = seasons.filter(season =>
      getAwardsByPeriod(year, season).some(a => a.creatorId === creatorId && a.rank === 1)
    );
    return wonSeasons.length >= 3; // 4期中3期以上で受賞
  });
}
```

| 基準 | 条件 |
|------|------|
| 対象 | 全季節の受賞を考慮 |
| 連続年数 | 3年（各年4期中3期以上で受賞） |
| 賞の種類 | 問わない（異なる賞でも可） |

---

## K. Community Choice（コミュニティ賞）

各季節の終了時にユーザー投票で決定。

### 選定ロジック

```typescript
function selectCommunityChoice(fiscalYear: number, season: AwardPeriod): AwardResult {
  // 投票期間: 各季節の最終3週間
  // 春: 6月上旬〜21日, 夏: 9月上旬〜21日, 秋: 12月上旬〜21日, 冬: 3月上旬〜21日
  const votes = getVotesBySeason(fiscalYear, season);

  // 1ユーザー1票（最も好きなクリエーターに投票）
  // 投票資格: 該当季節に1回以上調合を注文したユーザー
  const eligibleVoters = votes.filter(v => hasOrderedInSeason(v.userId, fiscalYear, season));

  const counts = groupBy(eligibleVoters, 'creatorId')
    .map(g => ({ creatorId: g.key, voteCount: g.items.length }));

  return counts.sort((a, b) => b.voteCount - a.voteCount)[0];
}
```

| 基準 | 条件 |
|------|------|
| 投票期間 | 各季節の最終3週間（〜21日） |
| 投票資格 | 該当季節に1注文以上 |
| 投票数 | 1ユーザー1票/期 |

---

## DB スキーマ

### 新規テーブル: `creator_awards`

```typescript
// packages/db/src/schema/creator-awards.ts

export const awardTypeEnum = [
  'FRESH_FLORAL', 'WARM_FLORAL', 'FRESH_WOODY', 'WARM_WOODY',
  'GOLDEN_BLEND', 'MOST_LOVED', 'SIGNATURE_SCENT',
  'RISING_STAR', 'INNOVATION', 'VERSATILE',
  'SEASON_SPRING', 'SEASON_SUMMER', 'SEASON_AUTUMN', 'SEASON_WINTER',
  'BEST_STORY', 'HALL_OF_FAME', 'COMMUNITY_CHOICE',
] as const;

export type AwardType = (typeof awardTypeEnum)[number];

export const awardPeriodEnum = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;
export type AwardPeriod = (typeof awardPeriodEnum)[number];

export const creatorAwards = pgTable(
  'creator_awards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    awardType: varchar('award_type', { length: 30 }).notNull().$type<AwardType>(),
    period: varchar('period', { length: 20 }).notNull().$type<AwardPeriod>(),
    fiscalYear: integer('fiscal_year').notNull(), // 2026, 2027, ...
    score: decimal('score', { precision: 7, scale: 4 }).notNull(),
    rank: integer('rank').notNull().default(1), // 1位 = 受賞
    metadata: jsonb('metadata'), // 追加情報（象限スコア、投票数など）
    awardedAt: timestamp('awarded_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_creator_awards_creator').on(table.creatorId),
    index('idx_creator_awards_type_period').on(table.awardType, table.period, table.fiscalYear),
    unique('uq_creator_awards').on(table.awardType, table.period, table.fiscalYear, table.rank),
  ],
);
```

### 新規テーブル: `community_votes`（Community Choice 用）

```typescript
export const communityVotes = pgTable(
  'community_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    voterId: uuid('voter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    fiscalYear: integer('fiscal_year').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('uq_community_votes').on(table.voterId, table.fiscalYear), // 1人1票
    index('idx_community_votes_creator').on(table.creatorId, table.fiscalYear),
  ],
);
```

---

## アワード一覧サマリー

| # | 賞名 | コード | 期間 | 主要指標 | 足切り |
|---|------|--------|------|---------|--------|
| 1 | Fresh Floral Award | `FRESH_FLORAL` | 春/夏/秋/冬 | ★50% + 数25% + 深度25% | 象限内5調合, ★3.5+ |
| 2 | Warm Floral Award | `WARM_FLORAL` | 春/夏/秋/冬 | 同上 | 同上 |
| 3 | Fresh Woody Award | `FRESH_WOODY` | 春/夏/秋/冬 | 同上 | 同上 |
| 4 | Warm Woody Award | `WARM_WOODY` | 春/夏/秋/冬 | 同上 | 同上 |
| 5 | Golden Blend Award | `GOLDEN_BLEND` | 春/夏/秋/冬 | ★平均1位 | 20調合, 10レビュー |
| 6 | Most Loved Award | `MOST_LOVED` | 春/夏/秋/冬 | ♥数1位 | 10ユニークユーザー |
| 7 | Signature Scent Award | `SIGNATURE_SCENT` | 春/夏/秋/冬 | リピート率1位 | 15ユニークユーザー |
| 8 | Rising Star Award | `RISING_STAR` | 春/夏/秋/冬 | 成長スコア1位 | 登録1年以内, 10調合, ★3.0+ |
| 9 | Innovation Award | `INNOVATION` | 春/夏/秋/冬 | ユニーク60%+★40% | 10調合, ★3.5+ |
| 10 | Versatile Creator Award | `VERSATILE` | 春/夏/秋/冬 | 最小★40%+平均★30%+数30% | 全象限3調合+★3.5+ |
| 11 | Season Master × 4 | `SEASON_*` | 春/夏/秋/冬 | ★平均1位 | 該当季節8調合, ★3.5+ |
| 12 | Best Story Award | `BEST_STORY` | 春/夏/秋/冬 | 評価60%+いいね率40% | 10ストーリー |
| 13 | Hall of Fame | `HALL_OF_FAME` | 年次判定 | 3年連続(各年3期以上受賞) | 自動判定 |
| 14 | Community Choice | `COMMUNITY_CHOICE` | 春/夏/秋/冬 | ユーザー投票1位 | 各季節末投票 |

**合計: 最大 15賞/期 × 年4期 = 年間最大60賞**

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-14 | 初版作成 |
| 2026-02-14 | アワード期間を前期/後期/年間から春/夏/秋/冬の4期制に変更。ランキング表示機能追加 |

---

*最終更新: 2026年2月14日*
