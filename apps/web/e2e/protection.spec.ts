import { expect, test } from "@playwright/test"
import { storageStatePath } from "./users"

test.describe("signed out", () => {
  test("the console sends the visitor to the sign-in page", async ({ page }) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/login$/)
  })

  test("the account pages send the visitor to the sign-in page", async ({ page }) => {
    await page.goto("/accounts/settings")
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe("as a user", () => {
  test.use({ storageState: storageStatePath.user })

  test("the console is a 404", async ({ page }) => {
    const response = await page.goto("/admin")
    expect(response?.status()).toBe(404)
  })

  test("the account pages render", async ({ page }) => {
    const response = await page.goto("/accounts/settings")
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: /account settings/i })).toBeVisible()
  })

  test("the sign-in page bounces to the home page", async ({ page }) => {
    const response = await page.request.get("/login", { maxRedirects: 0 })
    expect(response.status()).toBe(307)
    expect(new URL(response.headers().location ?? "", response.url()).pathname).toBe("/")
  })
})

test.describe("as an admin", () => {
  test.use({ storageState: storageStatePath.admin })

  test("the console renders", async ({ page }) => {
    const response = await page.goto("/admin")
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: /admin dashboard/i })).toBeVisible()
  })
})
