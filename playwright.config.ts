import { test, expect } from '@playwright/test';

test.describe('Fluxo de Login', () => {
  test('deve carregar a página de login e seus elementos corretamente', async ({ page }) => {
    await page.goto('/');

    // Mude de getByPlaceholder para getByRole ou getByLabel
    // Se o seu input tiver uma label "E-mail" ou "Email", o getByLabel é o mais preciso:
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    
    // Se não tiver label, tente encontrar pelo nome ou tipo:
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });
});
