import { test, expect, type Response } from '@playwright/test';

test.describe('Game Listing and Navigation', () => {
  test('should display games with titles on index page', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify games grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify game cards are displayed', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first()).toBeVisible();
      expect(await gameCards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify game cards show a rating out of 5', async () => {
      const rating = page.getByTestId('game-card').first().getByTestId('game-card-rating');
      await expect(rating).toHaveText(/^([0-5]\.\d \/ 5|No rating yet)$/);
    });

    await test.step('Verify game cards have titles with content', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first().getByTestId('game-title')).toBeVisible();
      await expect(gameCards.first().getByTestId('game-title')).not.toBeEmpty();
    });
  });

  test('should navigate to correct game details page when clicking on a game', async ({ page }) => {
    let gameId: string | null;
    let gameTitle: string | null;

    await test.step('Navigate to homepage and wait for games to load', async () => {
      await page.goto('/');
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Get first game information and click it', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      gameId = await firstGameCard.getAttribute('data-game-id');
      gameTitle = await firstGameCard.getAttribute('data-game-title');
      await firstGameCard.click();
    });

    await test.step('Verify navigation to game details page', async () => {
      await expect(page).toHaveURL(`/game/${gameId}`);
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title matches clicked game', async () => {
      if (gameTitle) {
        await expect(page.getByTestId('game-details-title')).toHaveText(gameTitle);
      }
    });
  });

  test('should display game details with all required information', async ({ page }) => {
    await test.step('Navigate to specific game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title is displayed', async () => {
      const gameTitle = page.getByTestId('game-details-title');
      await expect(gameTitle).toBeVisible();
      await expect(gameTitle).not.toBeEmpty();
    });

    await test.step('Verify game description is displayed', async () => {
      const gameDescription = page.getByTestId('game-details-description');
      await expect(gameDescription).toBeVisible();
      await expect(gameDescription).not.toBeEmpty();
    });

    await test.step('Verify publisher or category information is present', async () => {
      const publisherExists = await page.getByTestId('game-details-publisher').isVisible();
      const categoryExists = await page.getByTestId('game-details-category').isVisible();
      expect(publisherExists || categoryExists).toBeTruthy();

      if (publisherExists) {
        await expect(page.getByTestId('game-details-publisher')).not.toBeEmpty();
      }

      if (categoryExists) {
        await expect(page.getByTestId('game-details-category')).not.toBeEmpty();
      }
    });
  });

  test('should display a button to back the game', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify back game button is visible and enabled', async () => {
      const backButton = page.getByTestId('back-game-button');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Support This Game');
      await expect(backButton).toBeEnabled();
    });
  });

  test('should be able to navigate back to home from game details', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Click back to all games link', async () => {
      const backLink = page.getByRole('link', { name: /back to all games/i });
      await expect(backLink).toBeVisible();
      await backLink.click();
    });

    await test.step('Verify navigation back to homepage', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });
  });

  test('should return a 404 page for a non-existent game', async ({ page }) => {
    let response: Response | null;

    await test.step('Navigate to non-existent game', async () => {
      response = await page.goto('/game/99999');
    });

    await test.step('Verify a branded 404 page is served', async () => {
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/Page Not Found - Tailspin Toys/);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(page.getByTestId('not-found-heading')).not.toBeEmpty();
      await expect(page.getByTestId('not-found-home-link')).toBeVisible();
    });
  });
});

test.describe('Game Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('games-grid')).toBeVisible();
  });

  test('should filter games by one or more categories (OR)', async ({ page }) => {
    const cards = page.getByTestId('game-card');
    const total = await cards.count();
    const filters = page.getByTestId('game-filters');

    await filters.getByLabel('Strategy').check();
    const strategyCount = await cards.filter({ visible: true }).count();
    expect(strategyCount).toBeGreaterThan(0);
    expect(strategyCount).toBeLessThan(total);
    await expect(page.getByTestId('game-category').filter({ visible: true }).first()).toHaveText('Strategy');

    await filters.locator('input[name="category"]:not(:checked)').first().check();
    expect(await cards.filter({ visible: true }).count()).toBeGreaterThan(strategyCount);
    await expect(page).toHaveURL(/category=\d+&category=\d+/);
  });

  test('should filter games by publisher and combine with categories', async ({ page }) => {
    const visibleCards = page.getByTestId('game-card').filter({ visible: true });
    const total = await visibleCards.count();

    await page.getByTestId('filter-publisher').selectOption({ label: 'CodeForge Studios' });
    const publisherCount = await visibleCards.count();
    expect(publisherCount).toBeGreaterThan(0);
    expect(publisherCount).toBeLessThan(total);
    for (const text of await visibleCards.getByTestId('game-publisher').allTextContents()) {
      expect(text.trim()).toBe('CodeForge Studios');
    }

    await page.getByTestId('game-filters').getByLabel('Strategy').check();
    expect(await visibleCards.count()).toBeLessThanOrEqual(publisherCount);
  });

  test('should clear filters', async ({ page }) => {
    const visibleCards = page.getByTestId('game-card').filter({ visible: true });
    const total = await visibleCards.count();

    await page.getByTestId('filter-publisher').selectOption({ label: 'CodeForge Studios' });
    await expect(visibleCards).not.toHaveCount(total);

    await page.getByTestId('filter-clear').click();
    await expect(visibleCards).toHaveCount(total);
    await expect(page.getByTestId('filter-empty')).toBeHidden();
    await expect(page.getByTestId('filter-publisher')).toHaveValue('');
    await expect(page).toHaveURL('/');
  });

  test('should be operable with the keyboard and announce results', async ({ page }) => {
    const firstCategory = page.getByTestId('game-filters').locator('input[name="category"]').first();
    await firstCategory.focus();
    await expect(firstCategory).toBeFocused();
    await page.keyboard.press('Space');
    await expect(firstCategory).toBeChecked();
    await expect(page.getByTestId('filter-result-count')).toHaveText(/^Showing \d+ of \d+ games$/);
  });

  test('should restore filters from the URL', async ({ page }) => {
    const first = page.getByTestId('game-filters').locator('input[name="category"]').first();
    const id = await first.getAttribute('value');
    await page.goto(`/?category=${id}`);
    await expect(first).toBeChecked();
  });
});
