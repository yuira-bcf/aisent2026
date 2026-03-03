# KyaraInnovate テスト戦略

> FM-043（RPN=720）への対応として、テストピラミッド、フェーズ別カバレッジ目標、優先テスト対象、CI統合方針を定義する。

| 項目 | 内容 |
|------|------|
| プロジェクト名 | KyaraInnovate（オーダーメイド香水プラットフォーム） |
| 作成日 | 2026-02-17 |
| テストフレームワーク | Vitest + Testing Library + Playwright |

---

## 1. テストピラミッド

### 1.1 構成比率

```
        ╱╲
       ╱E2E╲          10% — Playwright
      ╱──────╲
     ╱ Integration ╲    20% — Vitest + DB
    ╱────────────────╲
   ╱      Unit        ╲  70% — Vitest
  ╱────────────────────╲
```

| レイヤー | 比率 | ツール | 実行環境 | 対象 |
|---------|------|--------|---------|------|
| Unit | 70% | Vitest | Node.js | サービス関数、ユーティリティ、バリデーション |
| Integration | 20% | Vitest + テストDB | Node.js + PostgreSQL | APIルート、Server Actions、DB操作 |
| E2E | 10% | Playwright | ブラウザ | ユーザーフロー、クリティカルパス |

### 1.2 テストの責務

| レイヤー | テスト対象 | テストしないこと |
|---------|-----------|---------------|
| Unit | 純粋関数、計算ロジック、バリデーション、状態遷移 | DB接続、外部API、UI描画 |
| Integration | DB CRUD操作、APIレスポンス、認証フロー、トランザクション | ブラウザ操作、CSS |
| E2E | 完全なユーザーフロー、複数画面遷移、決済フロー | 境界値テスト、エラーケースの網羅 |

---

## 2. フェーズ別カバレッジ目標

### 2.1 目標一覧

| フェーズ | 完了時期（目安） | カバレッジ目標 | 主な対象 |
|---------|---------------|-------------|---------|
| Phase 1 | Sprint 4 完了時 | **40%** | サービス層 + APIルート |
| Phase 2 | Sprint 8 完了時 | **60%** | + コンポーネント + クリエーター機能 |
| Phase 3 | Sprint 12 完了時 | **80%** | + E2E + 決済フロー + 全APIルート |

### 2.2 Phase 1 カバレッジ内訳

| 対象 | 目標カバレッジ | 根拠 |
|------|-------------|------|
| `services/*.ts` | 80% | ビジネスロジックの中心 |
| `app/api/**/*.ts` | 70% | 外部公開インターフェース |
| `lib/*.ts` | 60% | ユーティリティ |
| `components/*.tsx` | 20% | Phase 2で拡充 |

### 2.3 Phase 2 受け入れ基準（Sprint 8 完了時）

#### 機能要件

| # | 基準 | 検証方法 | 合格条件 |
|---|------|---------|---------|
| P2-F01 | クリエーターレシピCRUD | Integration テスト | 作成・更新・公開・アーカイブの全ステータス遷移をテスト。所有権チェック含む |
| P2-F02 | クリエーターキーワードルール管理 | Integration テスト | ルール追加・更新・AI提案取得の各操作が正常動作 |
| P2-F03 | クリエータープロフィール・スタイル | Integration テスト | プロフィール更新、スタイル設定、スラッグ一意性チェック |
| P2-F04 | レビュー投稿・表示 | Integration テスト | 投稿条件（配達済み・未投稿）の検証、統計更新の整合性 |
| P2-F05 | お気に入り機能 | Integration テスト | 商品・クリエーターお気に入りのトグル動作、重複防止 |
| P2-F06 | 通知システム | Integration テスト | 通知作成・既読・一括既読・削除・未読カウント |
| P2-F07 | クーポン適用 | Integration テスト | 有効期限・利用回数・最低金額・対象商品の各条件を検証 |
| P2-F08 | コンポーネント表示 | Component テスト | FlavorChart, OrderTimeline, ReviewForm の表示・インタラクション |

#### 非機能要件

| # | 基準 | 合格条件 |
|---|------|---------|
| P2-N01 | カバレッジ | lines/functions/statements ≥ 60%, branches ≥ 55% |
| P2-N02 | テスト実行時間 | 全 Unit + Integration テスト < 120秒 (CI環境) |
| P2-N03 | テスト安定性 | Flaky テスト率 < 2% (10回連続実行で全パス) |
| P2-N04 | セキュリティテスト | 認証・認可の境界テスト。未認証/権限不足の全パターンを網羅 |

### 2.4 Phase 3 受け入れ基準（Sprint 12 完了時）

#### 機能要件

| # | 基準 | 検証方法 | 合格条件 |
|---|------|---------|---------|
| P3-F01 | 決済フロー E2E | Playwright | Stripe テスト決済→Webhook→注文確定→ステータス遷移の全フロー |
| P3-F02 | 調合フロー E2E | Playwright | キーワード選択→調合→結果表示→注文の全フロー |
| P3-F03 | 認証フロー E2E | Playwright | 新規登録→ログイン→パスワードリセットの全フロー |
| P3-F04 | クリエーターフロー E2E | Playwright | 申請→承認→レシピ作成→公開→購入→ロイヤリティの全フロー |
| P3-F05 | 全APIルート | Integration テスト | 84エンドポイントの正常系・異常系・認証チェック |
| P3-F06 | Webhookリプレイ | Integration テスト | Stripe Webhook署名検証、冪等性、ステータス遷移 |
| P3-F07 | バッチジョブ | Integration テスト | ロイヤリティ計算、注文タイムアウト、ティア再計算 |
| P3-F08 | レート制限 | Unit テスト | IP/ユーザー別レート制限の閾値テスト |

#### 非機能要件

| # | 基準 | 合格条件 |
|---|------|---------|
| P3-N01 | カバレッジ | lines/functions/statements ≥ 80%, branches ≥ 75% |
| P3-N02 | E2E テスト実行時間 | 全 E2E テスト < 300秒 (CI環境, Chromium) |
| P3-N03 | テスト安定性 | Flaky テスト率 0% (E2E含む) |
| P3-N04 | パフォーマンス | k6 Load Test (50VU/10min) で SLO を満たすこと |
| P3-N05 | アクセシビリティ | axe-core による主要ページの自動スキャン (Critical/Serious = 0) |
| P3-N06 | セキュリティ | OWASP Top 10 の主要項目（XSS, CSRF, SQLi）のテスト網羅 |

---

## 3. 優先テスト対象

### 3.1 Critical（最優先）

| # | ファイル | テスト種別 | 理由 | 期待テスト数 |
|---|---------|-----------|------|------------|
| 1 | `services/blend-calculator.ts` | Unit | 計算精度が商品品質に直結。Decimal.js精度、加重平均、ノート正規化 | 30+ |
| 2 | `services/order-service.ts` | Integration | 決済フロー、トランザクション整合性、在庫減算 | 20+ |
| 3 | `lib/auth.ts` + `middleware.ts` | Integration | 認証・認可、ロール制御、JWT検証 | 15+ |

### 3.2 High（高優先）

| # | ファイル | テスト種別 | 理由 | 期待テスト数 |
|---|---------|-----------|------|------------|
| 4 | `services/blend-service.ts` | Integration | トランザクション設計の検証 | 15+ |
| 5 | `lib/validations/*.ts` | Unit | Zodスキーマの境界値テスト | 20+ |
| 6 | `services/recipe-service.ts` | Integration | CRUD操作、所有権チェック | 15+ |
| 7 | `services/review-service.ts` | Integration | レビュー投稿条件、統計更新 | 10+ |

### 3.3 Medium（中優先）

| # | ファイル | テスト種別 | 理由 | 期待テスト数 |
|---|---------|-----------|------|------------|
| 8 | `lib/rate-limit.ts` | Unit | レート制限ロジック | 5+ |
| 9 | `lib/audit-logger.ts` | Integration | 監査ログ記録 | 5+ |
| 10 | `app/api/webhooks/stripe/route.ts` | Integration | Webhook署名検証、冪等性 | 10+ |

---

## 4. テストツール構成

### 4.1 Vitest 設定

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules',
        '.next',
        'tests',
        '**/*.config.*',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 40,       // Phase 1 目標
        functions: 40,
        branches: 35,
        statements: 40,
      },
    },
    include: [
      'services/**/*.test.ts',
      'lib/**/*.test.ts',
      'app/api/**/*.test.ts',
    ],
  },
});
```

### 4.2 テストDB設定

```typescript
// tests/setup.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// テスト用DBは docker compose の db サービスを使用
// DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kyarainnovate_test
beforeAll(async () => {
  await migrate(testDb, { migrationsFolder: './drizzle' });
});

afterEach(async () => {
  // テーブルデータのクリーンアップ（トランザクション方式）
  await testDb.execute(sql`
    TRUNCATE TABLE users, orders, order_items, blend_requests,
    blend_results, recipe_reviews CASCADE
  `);
});
```

### 4.3 Playwright 設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 5. テスト例

### 5.1 Unit テスト例: blend-calculator

```typescript
// services/__tests__/blend-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateWeightedAverage, normalizeNotes } from '../blend-calculator';
import Decimal from 'decimal.js';

describe('calculateWeightedAverage', () => {
  it('キーワード1つ、ルール2つで正しい比率を計算する', () => {
    const rules = [
      { flavorId: 'f1', weight: new Decimal('0.7'), note: 'TOP' },
      { flavorId: 'f2', weight: new Decimal('0.3'), note: 'MIDDLE' },
    ];
    const result = calculateWeightedAverage([{ rules, weight: 1.0 }]);

    expect(result.find(r => r.flavorId === 'f1')?.ratio.toNumber()).toBe(0.7);
    expect(result.find(r => r.flavorId === 'f2')?.ratio.toNumber()).toBe(0.3);
  });

  it('合計比率が100%になることを保証する', () => {
    const result = calculateWeightedAverage(testKeywordsWithRules);
    const total = result.reduce((sum, r) => sum.plus(r.ratio), new Decimal(0));

    expect(total.toNumber()).toBeCloseTo(1.0, 10);
  });
});

describe('normalizeNotes', () => {
  it('TOP:MIDDLE:LAST の比率を正規化する', () => {
    const result = normalizeNotes(flavors, { top: 40, middle: 35, last: 25 });

    expect(result.topRatio).toBe(40);
    expect(result.middleRatio).toBe(35);
    expect(result.lastRatio).toBe(25);
  });
});
```

### 5.2 Integration テスト例: order-service

```typescript
// services/__tests__/order-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createOrder, updateOrderStatus } from '../order-service';
import { testDb } from '@/tests/setup';

describe('createOrder', () => {
  beforeEach(async () => {
    // テストデータ投入
    await seedTestUser(testDb);
    await seedTestProducts(testDb);
    await seedTestCartItems(testDb);
  });

  it('トランザクション内で注文を正常に作成する', async () => {
    const result = await createOrder('test-user-id', {
      shippingAddressId: 'test-address-id',
    });

    expect(result.order.status).toBe('PENDING');
    expect(result.order.totalYen).toBeGreaterThan(0);
    expect(result.clientSecret).toBeDefined();
  });

  it('在庫不足時にトランザクションがロールバックする', async () => {
    // 在庫を0に設定
    await testDb.update(products).set({ stock: 0 });

    await expect(
      createOrder('test-user-id', { shippingAddressId: 'test-address-id' })
    ).rejects.toThrow('在庫不足');

    // ロールバック確認: 注文が作成されていないこと
    const orders = await testDb.query.orders.findMany();
    expect(orders).toHaveLength(0);
  });
});

describe('updateOrderStatus', () => {
  it('無効な遷移を拒否する', async () => {
    await expect(
      updateOrderStatus('order-id', 'SHIPPED', 'admin-id')
    ).rejects.toThrow('Invalid status transition');
  });
});
```

### 5.3 E2E テスト例: 調合フロー

```typescript
// e2e/blend-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('調合フロー', () => {
  test('キーワード選択→調合→結果表示', async ({ page }) => {
    // ログイン
    await page.goto('/auth/signin');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 調合ページへ
    await page.goto('/blend');

    // キーワード選択
    await page.click('[data-keyword="citrus"]');
    await page.click('[data-keyword="floral"]');

    // 調合実行
    await page.click('[data-action="execute-blend"]');

    // 結果表示を待機
    await expect(page.locator('[data-testid="blend-result"]')).toBeVisible({
      timeout: 10000,
    });

    // ドーナツチャートが表示されること
    await expect(page.locator('[data-testid="flavor-chart"]')).toBeVisible();

    // ストーリーが生成されること
    await expect(page.locator('[data-testid="ai-story"]')).not.toBeEmpty();
  });
});
```

---

## 6. CI統合

### 6.1 ci.yml テストジョブ

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: kyarainnovate_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npx drizzle-kit push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/kyarainnovate_test

      - name: Run unit & integration tests
        run: npx vitest run --coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/kyarainnovate_test
          AUTH_SECRET: test-auth-secret-for-ci-minimum-16
          AUTH_URL: http://localhost:3000
          STRIPE_SECRET_KEY: sk_test_dummy
          STRIPE_WEBHOOK_SECRET: whsec_test_dummy
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_dummy
          INTERNAL_SERVICE_TOKEN: test-internal-token-minimum-32-chars-long

      - name: Check coverage thresholds
        run: |
          npx vitest run --coverage --coverage.thresholds.lines=40

      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

### 6.2 カバレッジしきい値の段階的引き上げ

| タイミング | lines | functions | branches | statements |
|-----------|-------|-----------|----------|------------|
| Phase 1 Sprint 2 | 20% | 20% | 15% | 20% |
| Phase 1 Sprint 4 | 40% | 40% | 35% | 40% |
| Phase 2 完了時 | 60% | 60% | 55% | 60% |
| Phase 3 完了時 | 80% | 80% | 75% | 80% |

---

## 7. テスト命名規約

### 7.1 ファイル配置

```
services/
  blend-calculator.ts
  __tests__/
    blend-calculator.test.ts
lib/
  validations/
    auth.ts
    __tests__/
      auth.test.ts
e2e/
  blend-flow.spec.ts
  order-flow.spec.ts
  auth-flow.spec.ts
```

### 7.2 テスト記述規約

```typescript
// describe: 機能名 or 関数名
describe('calculateWeightedAverage', () => {
  // it: 日本語で期待動作を記述
  it('キーワード1つで正しい比率を返す', () => {});
  it('重複香料のウェイトを合算する', () => {});
  it('空のルールセットでエラーを返す', () => {});
});
```

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-17 | 初版作成（FMEA FM-043 対応） |

---

*最終更新: 2026年2月17日*
