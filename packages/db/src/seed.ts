import bcryptjs from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
const { hash } = bcryptjs;
import {
	creatorProfiles,
	flavors,
	keywords,
	platformSettings,
	products,
	signatureRecipes,
	users,
} from "./schema/index.js";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
	console.log("Seeding flavors...");

	// 26 flavors
	await db
		.insert(flavors)
		.values([
			// TOP notes (8)
			{
				nameJa: "ライム",
				nameEn: "Lime",
				noteType: "TOP",
				description: "シャープで爽やかな柑橘系の香り",
				sortOrder: 1,
			},
			{
				nameJa: "グレープフルーツ",
				nameEn: "Grapefruit",
				noteType: "TOP",
				description: "みずみずしくほろ苦い柑橘系の香り",
				sortOrder: 2,
			},
			{
				nameJa: "レモン",
				nameEn: "Lemon",
				noteType: "TOP",
				description: "フレッシュで明るい柑橘系の香り",
				sortOrder: 3,
			},
			{
				nameJa: "オレンジ",
				nameEn: "Orange",
				noteType: "TOP",
				description: "甘くて温かみのある柑橘系の香り",
				sortOrder: 4,
			},
			{
				nameJa: "ベルガモット",
				nameEn: "Bergamot",
				noteType: "TOP",
				description: "上品で華やかな柑橘系の香り",
				sortOrder: 5,
			},
			{
				nameJa: "シーブルー",
				nameEn: "Sea Blue",
				noteType: "TOP",
				description: "海を思わせる爽やかなマリン系の香り",
				sortOrder: 6,
			},
			{
				nameJa: "アッサムティ",
				nameEn: "Assam Tea",
				noteType: "TOP",
				description: "深みのある紅茶の芳醇な香り",
				sortOrder: 7,
			},
			{
				nameJa: "カシス",
				nameEn: "Cassis",
				noteType: "TOP",
				description: "甘酸っぱいベリー系の香り",
				sortOrder: 8,
			},

			// MIDDLE notes (10)
			{
				nameJa: "ラベンダー",
				nameEn: "Lavender",
				noteType: "MIDDLE",
				description: "穏やかで落ち着くハーバルな香り",
				sortOrder: 9,
			},
			{
				nameJa: "ダフネ",
				nameEn: "Daphne",
				noteType: "MIDDLE",
				description: "甘く優美な花の香り",
				sortOrder: 10,
			},
			{
				nameJa: "ミュゲ",
				nameEn: "Muguet",
				noteType: "MIDDLE",
				description: "すずらんの清楚で透明感のある香り",
				sortOrder: 11,
			},
			{
				nameJa: "マグノリア",
				nameEn: "Magnolia",
				noteType: "MIDDLE",
				description: "華やかで芳醇なマグノリアの香り",
				sortOrder: 12,
			},
			{
				nameJa: "ガーデニア",
				nameEn: "Gardenia",
				noteType: "MIDDLE",
				description: "濃厚で甘美なくちなしの香り",
				sortOrder: 13,
			},
			{
				nameJa: "チュベローズ",
				nameEn: "Tuberose",
				noteType: "MIDDLE",
				description: "官能的で濃密なフローラルの香り",
				sortOrder: 14,
			},
			{
				nameJa: "ジャスミン",
				nameEn: "Jasmine",
				noteType: "MIDDLE",
				description: "華やかで甘美なジャスミンの香り",
				sortOrder: 15,
			},
			{
				nameJa: "カーネーション",
				nameEn: "Carnation",
				noteType: "MIDDLE",
				description: "スパイシーで甘いフローラルの香り",
				sortOrder: 16,
			},
			{
				nameJa: "スウィートローズ",
				nameEn: "Sweet Rose",
				noteType: "MIDDLE",
				description: "甘く優しいバラの香り",
				sortOrder: 17,
			},
			{
				nameJa: "ダマスククラシックローズ",
				nameEn: "Damascus Classic Rose",
				noteType: "MIDDLE",
				description: "気品ある古典的なバラの香り",
				sortOrder: 18,
			},

			// LAST notes (8)
			{
				nameJa: "ブラックペッパー",
				nameEn: "Black Pepper",
				noteType: "LAST",
				description: "スパイシーで力強いアクセント",
				sortOrder: 19,
			},
			{
				nameJa: "パチュリ",
				nameEn: "Patchouli",
				noteType: "LAST",
				description: "深みのあるエキゾチックなウッディの香り",
				sortOrder: 20,
			},
			{
				nameJa: "シダーウッド",
				nameEn: "Cedarwood",
				noteType: "LAST",
				description: "落ち着いた温かみのあるウッディの香り",
				sortOrder: 21,
			},
			{
				nameJa: "サンダルウッド",
				nameEn: "Sandalwood",
				noteType: "LAST",
				description: "クリーミーで甘いウッディの香り",
				sortOrder: 22,
			},
			{
				nameJa: "レザー",
				nameEn: "Leather",
				noteType: "LAST",
				description: "重厚で洗練されたレザーの香り",
				sortOrder: 23,
			},
			{
				nameJa: "アンバー",
				nameEn: "Amber",
				noteType: "LAST",
				description: "甘く温かみのある樹脂系の香り",
				sortOrder: 24,
			},
			{
				nameJa: "ムスク",
				nameEn: "Musk",
				noteType: "LAST",
				description: "柔らかく包み込むような肌に近い香り",
				sortOrder: 25,
			},
			{
				nameJa: "バニラ",
				nameEn: "Vanilla",
				noteType: "LAST",
				description: "甘く温かみのあるグルマン系の香り",
				sortOrder: 26,
			},
		])
		.onConflictDoNothing();

	console.log("Seeding keywords...");

	// 16 preset keywords
	await db
		.insert(keywords)
		.values([
			// SEASON (4)
			{ word: "春", category: "SEASON", isPreset: true },
			{ word: "夏", category: "SEASON", isPreset: true },
			{ word: "秋", category: "SEASON", isPreset: true },
			{ word: "冬", category: "SEASON", isPreset: true },

			// PLACE (3)
			{ word: "まろやか", category: "PLACE", isPreset: true },
			{ word: "さわやか", category: "PLACE", isPreset: true },
			{ word: "ナチュラル", category: "PLACE", isPreset: true },

			// MOOD (9)
			{ word: "陽気", category: "MOOD", isPreset: true },
			{ word: "優雅", category: "MOOD", isPreset: true },
			{ word: "高級", category: "MOOD", isPreset: true },
			{ word: "リラックス", category: "MOOD", isPreset: true },
			{ word: "ロマンティック", category: "MOOD", isPreset: true },
			{ word: "セクシー", category: "MOOD", isPreset: true },
			{ word: "クール", category: "MOOD", isPreset: true },
			{ word: "フレッシュ", category: "MOOD", isPreset: true },
			{ word: "ミステリアス", category: "MOOD", isPreset: true },
		])
		.onConflictDoNothing();

	console.log("Seeding admin user...");

	const adminPasswordHash = await hash("Admin123!", 12);
	await db
		.insert(users)
		.values({
			email: "admin@kyarainnovate.com",
			passwordHash: adminPasswordHash,
			name: "System Admin",
			role: "ADMIN",
		})
		.onConflictDoNothing();

	// ------------------------------------------------------------------
	// Platform Settings
	// ------------------------------------------------------------------
	console.log("Seeding platform settings...");

	await db
		.insert(platformSettings)
		.values({
			key: "royalty_rate_default",
			value: "0.1000",
		})
		.onConflictDoNothing();

	// ------------------------------------------------------------------
	// Test Creator Users
	// ------------------------------------------------------------------
	console.log("Seeding test creator users...");

	const creatorPasswordHash = await hash("creator123", 12);

	await db
		.insert(users)
		.values([
			{
				email: "hanaka@test.com",
				passwordHash: creatorPasswordHash,
				name: "香月 花",
				role: "CREATOR",
			},
			{
				email: "kaoru@test.com",
				passwordHash: creatorPasswordHash,
				name: "森田 薫",
				role: "CREATOR",
			},
		])
		.onConflictDoNothing();

	// Fetch creator user rows (whether just inserted or already existing)
	const [creator1] = await db
		.select()
		.from(users)
		.where(eq(users.email, "hanaka@test.com"));
	const [creator2] = await db
		.select()
		.from(users)
		.where(eq(users.email, "kaoru@test.com"));

	// ------------------------------------------------------------------
	// Creator Profiles
	// ------------------------------------------------------------------
	console.log("Seeding creator profiles...");

	await db
		.insert(creatorProfiles)
		.values([
			{
				userId: creator1.id,
				displayName: "香月 花",
				creatorIdSlug: "hanaka",
				bio: "花と果実をテーマにした香りを創作",
				styleDescription:
					"フローラル系を得意とし、トップノートに華やかさを加える",
			},
			{
				userId: creator2.id,
				displayName: "森田 薫",
				creatorIdSlug: "kaoru",
				bio: "ウッディ・スパイシー系の調香師",
				styleDescription: "落ち着いた大人の香りを追求",
			},
		])
		.onConflictDoNothing();

	// ------------------------------------------------------------------
	// Signature Recipes
	// ------------------------------------------------------------------
	console.log("Seeding signature recipes...");

	// Check if recipes already exist to keep seed idempotent
	const existingRecipe1 = await db
		.select()
		.from(signatureRecipes)
		.where(
			and(
				eq(signatureRecipes.creatorId, creator1.id),
				eq(signatureRecipes.name, "春の花束"),
			),
		);
	const existingRecipe2 = await db
		.select()
		.from(signatureRecipes)
		.where(
			and(
				eq(signatureRecipes.creatorId, creator2.id),
				eq(signatureRecipes.name, "夜の森林"),
			),
		);

	let recipe1Id: string;
	let recipe2Id: string;

	if (existingRecipe1.length > 0) {
		recipe1Id = existingRecipe1[0].id;
	} else {
		const [inserted] = await db
			.insert(signatureRecipes)
			.values({
				creatorId: creator1.id,
				name: "春の花束",
				description: "桜と薔薇を基調とした華やかなフレグランス",
				status: "PUBLISHED",
				topRatio: "30.00",
				middleRatio: "50.00",
				lastRatio: "20.00",
				publishedAt: new Date(),
			})
			.returning();
		recipe1Id = inserted.id;
	}

	if (existingRecipe2.length > 0) {
		recipe2Id = existingRecipe2[0].id;
	} else {
		const [inserted] = await db
			.insert(signatureRecipes)
			.values({
				creatorId: creator2.id,
				name: "夜の森林",
				description: "ヒノキとサンダルウッドの深い香り",
				status: "PUBLISHED",
				topRatio: "20.00",
				middleRatio: "30.00",
				lastRatio: "50.00",
				publishedAt: new Date(),
			})
			.returning();
		recipe2Id = inserted.id;
	}

	// ------------------------------------------------------------------
	// Products (linked to recipes)
	// ------------------------------------------------------------------
	console.log("Seeding products...");

	const existingProduct1 = await db
		.select()
		.from(products)
		.where(eq(products.name, "春の花束 30ml"));
	if (existingProduct1.length === 0) {
		await db.insert(products).values({
			name: "春の花束 30ml",
			priceYen: 4980,
			recipeId: recipe1Id,
		});
	}

	const existingProduct2 = await db
		.select()
		.from(products)
		.where(eq(products.name, "夜の森林 30ml"));
	if (existingProduct2.length === 0) {
		await db.insert(products).values({
			name: "夜の森林 30ml",
			priceYen: 5480,
			recipeId: recipe2Id,
		});
	}

	console.log("Seed complete!");
	await client.end();
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
