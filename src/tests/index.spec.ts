import {test, expect} from "@playwright/test";
import { AUTHOR_NAME } from "../constant";

test('meta is correct', async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(`${AUTHOR_NAME}'s Site`);
});