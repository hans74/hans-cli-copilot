import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getAllCategories,
    getAllPublishers,
    filterGames,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
    describe('filtering', () => {
        let ids: { strategy: number; puzzle: number; racing: number; pubA: number; pubB: number };

        beforeEach(async () => {
            const cats = await db
                .insert(categories)
                .values([{ name: 'Strategy' }, { name: 'Puzzle' }, { name: 'Racing' }])
                .returning({ id: categories.id });
            const pubs = await db
                .insert(publishers)
                .values([{ name: 'Pub A' }, { name: 'Pub B' }])
                .returning({ id: publishers.id });
            ids = {
                strategy: cats[0].id,
                puzzle: cats[1].id,
                racing: cats[2].id,
                pubA: pubs[0].id,
                pubB: pubs[1].id,
            };
            await db.insert(games).values([
                { title: 'Alpha', description: 'd', categoryId: ids.strategy, publisherId: ids.pubA },
                { title: 'Bravo', description: 'd', categoryId: ids.puzzle, publisherId: ids.pubA },
                { title: 'Charlie', description: 'd', categoryId: ids.puzzle, publisherId: ids.pubB },
                { title: 'Delta', description: 'd', categoryId: ids.racing, publisherId: ids.pubB },
            ]);
        });

        const titles = async (filters?: Parameters<typeof filterGames>[1]): Promise<string[]> =>
            (await filterGames(db, filters)).map((g) => g.title);

        it('returns all games when no filters are given', async () => {
            expect(await titles()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
            expect(await titles({ categoryIds: [] })).toHaveLength(4);
        });

        it('ORs multiple categories together', async () => {
            expect(await titles({ categoryIds: [ids.strategy, ids.racing] })).toEqual(['Alpha', 'Delta']);
        });

        it('filters by publisher', async () => {
            expect(await titles({ publisherId: ids.pubB })).toEqual(['Charlie', 'Delta']);
        });

        it('ANDs the publisher with the selected categories', async () => {
            expect(await titles({ categoryIds: [ids.puzzle, ids.racing], publisherId: ids.pubB })).toEqual([
                'Charlie',
                'Delta',
            ]);
            expect(await titles({ categoryIds: [ids.strategy], publisherId: ids.pubB })).toEqual([]);
        });

        it('lists categories and publishers ordered by name', async () => {
            expect((await getAllCategories(db)).map((c) => c.name)).toEqual(['Puzzle', 'Racing', 'Strategy']);
            expect((await getAllPublishers(db)).map((p) => p.name)).toEqual(['Pub A', 'Pub B']);
        });
    });
});
