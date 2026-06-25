import { test, expect } from '@playwright/test';

test.describe('Fluxo de Login', () => {
  test('deve carregar a página de login e seus elementos corretamente', async ({ page }) => {
    // Acessa a raiz da aplicação
    await page.goto('/');

    // Verifica se os inputs visuais estão na tela
    await expect(page.getByPlaceholder('E-mail')).toBeVisible();
    await expect(page.getByPlaceholder('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });
});
