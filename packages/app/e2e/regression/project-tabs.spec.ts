import { expect, test, type Page, type Route } from "@playwright/test"
import { base64Encode } from "@opencode/util/encode"
import { currentSession } from "../utils/mock-server"

const server = `http://${process.env.PLAYWRIGHT_SERVER_HOST ?? "127.0.0.1"}:${process.env.PLAYWRIGHT_SERVER_PORT ?? "4096"}`
const projectAlpha = project("project_alpha", "Alpha Project", "C:/projects/alpha")
const projectBeta = project("project_beta", "Beta Project", "C:/projects/beta")
const sessionA = session("ses_project_alpha_a", "Alpha first session", projectAlpha.id, projectAlpha.canonical)
const sessionA2 = session("ses_project_alpha_a2", "Alpha second session", projectAlpha.id, projectAlpha.canonical)
const sessionB = session("ses_project_beta_b", "Beta session", projectBeta.id, projectBeta.canonical)
const unopened = session(
  "ses_project_alpha_unopened",
  "Alpha unopened session",
  projectAlpha.id,
  projectAlpha.canonical,
)

const href = (sessionID: string) => `/server/${base64Encode(server)}/session/${sessionID}`
const draftHref = (draftID: string) => `/new-session?draftId=${encodeURIComponent(draftID)}`

test("horizontal project tabs name projects and show only opened sessions and drafts", async ({ page }) => {
  await mockServer(page)
  await seedTabs(page, [
    { type: "session", server, sessionId: sessionA.id },
    { type: "draft", server, directory: projectAlpha.canonical, draftID: "draft_alpha" },
    { type: "session", server, sessionId: sessionA2.id },
    { type: "session", server, sessionId: sessionB.id },
  ])

  await page.goto(href(sessionA.id))

  const projectTabs = page.locator('[data-slot="project-tabs"]')
  await expect(projectTabs.locator('[data-slot="project-tab"]')).toHaveCount(2)
  await expect(projectTabs.locator('[data-slot="project-tab"]')).toHaveText([projectAlpha.name, projectBeta.name])

  const sidebar = page.locator('[data-slot="horizontal-project-sidebar"]')
  await expect(sidebar).toBeVisible()
  await expect(sidebar.locator("[data-titlebar-tab-slot]")).toHaveCount(3)
  await expect(sidebar.locator("[data-titlebar-tab-title]")).toHaveText([sessionA.title, "Session", sessionA2.title])
  await expect(sidebar.locator(`[data-titlebar-tab-link][href="${href(unopened.id)}"]`)).toHaveCount(0)
  await expect(sidebar.locator(`[data-titlebar-tab-link][href="${draftHref("draft_alpha")}"]`)).toHaveCount(1)

  await projectTabs.getByRole("button", { name: projectBeta.name, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${sessionB.id}$`))
  await expect(sidebar.locator("[data-titlebar-tab-slot]")).toHaveCount(1)
  await expect(sidebar.locator(`[data-titlebar-tab-link][href="${href(sessionB.id)}"]`)).toBeVisible()
  await expect(sidebar.locator(`[data-titlebar-tab-link][href="${href(sessionA.id)}"]`)).toHaveCount(0)
})

test("horizontal project tabs switch projects and sessions with mouse and keyboard", async ({ page }) => {
  await mockServer(page)
  await seedTabs(page, [
    { type: "session", server, sessionId: sessionA.id },
    { type: "session", server, sessionId: sessionA2.id },
    { type: "session", server, sessionId: sessionB.id },
  ])

  await page.goto(href(sessionA.id))
  const projectTabs = page.locator('[data-slot="project-tabs"]')
  const sidebar = page.locator('[data-slot="horizontal-project-sidebar"]')

  await projectTabs.getByRole("button", { name: projectBeta.name, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${sessionB.id}$`))

  await projectTabs.getByRole("button", { name: projectAlpha.name, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${sessionA.id}$`))
  const linkA2 = sidebar.locator(`[data-titlebar-tab-link][href="${href(sessionA2.id)}"]`)
  await expect(linkA2).toBeVisible()
  const box = await linkA2.boundingBox()
  if (!box) throw new Error("project session tab has no bounding box")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page).toHaveURL(new RegExp(`${sessionA2.id}$`))
  await page.mouse.up()

  await page.keyboard.press("Control+Alt+ArrowRight")
  await expect(page).toHaveURL(new RegExp(`${sessionA.id}$`))
})

test("closing and reopening a horizontal project session restores its project", async ({ page }) => {
  await mockServer(page)
  await seedTabs(page, [
    { type: "session", server, sessionId: sessionA.id },
    { type: "session", server, sessionId: sessionB.id },
  ])

  await page.goto(href(sessionA.id))
  const projectTabs = page.locator('[data-slot="project-tabs"]')
  const sidebar = page.locator('[data-slot="horizontal-project-sidebar"]')
  await projectTabs.getByRole("button", { name: projectBeta.name, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${sessionB.id}$`))

  const tabB = sidebar.locator(`[data-titlebar-tab-slot]:has(a[href="${href(sessionB.id)}"])`)
  await tabB.locator('[data-slot="tab-close"] button').click()
  await expect(page).toHaveURL(new RegExp(`${sessionA.id}$`))
  await expect(projectTabs.getByRole("button", { name: projectBeta.name, exact: true })).toHaveCount(0)
  await expect(sidebar.locator(`[data-titlebar-tab-link][href="${href(sessionB.id)}"]`)).toHaveCount(0)

  await page.keyboard.press("ControlOrMeta+Shift+T")
  await expect(page).toHaveURL(new RegExp(`${sessionB.id}$`))
  await expect(projectTabs.getByRole("button", { name: projectBeta.name, exact: true })).toBeVisible()
  await expect(sidebar.locator(`[data-titlebar-tab-link][href="${href(sessionB.id)}"]`)).toBeVisible()
})

test("horizontal project session sidebar resizes at a narrow width", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 720 })
  await mockServer(page)
  await seedTabs(page, [
    { type: "session", server, sessionId: sessionA.id },
    { type: "draft", server, directory: projectAlpha.canonical, draftID: "draft_alpha_resize" },
    { type: "session", server, sessionId: sessionA2.id },
  ])

  await page.goto(href(sessionA.id))

  const sidebar = page.locator('[data-slot="horizontal-project-sidebar"]')
  await expect(sidebar).toHaveCSS("width", "260px")
  await expect(sidebar.locator("[data-titlebar-tab-slot]")).toHaveCount(3)
  const handle = sidebar.locator('[data-component="resize-handle"]')
  const box = await handle.boundingBox()
  if (!box) throw new Error("project sidebar resize handle has no bounding box")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 120, box.y + box.height / 2)
  await page.mouse.up()
  await expect(sidebar).toHaveCSS("width", "140px")
  await expect(sidebar.locator(`[data-titlebar-tab-link][href="${href(sessionA2.id)}"]`)).toBeVisible()
})

async function seedTabs(page: Page, tabs: Array<Record<string, unknown>>) {
  await page.addInitScript(
    ({ server, tabs }) => {
      localStorage.setItem(
        "settings.v3",
        JSON.stringify({ appearance: { tabLayout: "horizontal", groupTabsByProject: true } }),
      )
      localStorage.setItem("opencode.window.browser.dat:tabs", JSON.stringify(tabs.map((tab) => ({ ...tab, server }))))
    },
    { server, tabs },
  )
}

async function mockServer(page: Page) {
  const sessions = [sessionA, sessionA2, sessionB, unopened]
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== server) return route.fallback()
    if (url.pathname === "/api/event") return sse(route)
    if (url.pathname === "/api/config") return json(route, [])
    if (url.pathname === "/api/session")
      return json(route, { data: sessions.map((item) => currentSession(item)), cursor: {} })
    if (url.pathname === "/api/session/active") return json(route, { data: {} })
    const current = sessions.find((item) => url.pathname === `/api/session/${item.id}`)
    if (current) return json(route, { data: currentSession(current) })
    if (sessions.some((item) => url.pathname === `/api/session/${item.id}/message`))
      return json(route, { data: [], cursor: {} })
    if (sessions.some((item) => url.pathname === `/api/session/${item.id}/inbox`)) return json(route, { data: [] })
    if (["/api/agent", "/api/provider", "/api/model", "/api/command", "/api/reference"].includes(url.pathname))
      return json(route, { location: locationFor(url), data: [] })
    if (url.pathname === "/api/model/default") return json(route, { location: locationFor(url), data: null })
    if (url.pathname === "/api/permission/request" || url.pathname === "/api/form")
      return json(route, { location: locationFor(url), data: [] })
    if (url.pathname === "/api/mcp") return json(route, { location: locationFor(url), data: [] })
    if (url.pathname === "/api/mcp/resource")
      return json(route, { location: locationFor(url), data: { resources: [], templates: [] } })
    if (url.pathname === "/api/project") return json(route, [projectAlpha, projectBeta])
    if (url.pathname === "/api/location") {
      const project = projectForDirectory(url.searchParams.get("directory"))
      return json(route, {
        directory: project.canonical,
        project: { id: project.id, directory: project.canonical, canonical: project.canonical },
      })
    }
    if (url.pathname === "/api/worktree")
      return json(route, [{ directory: projectForDirectory(url.searchParams.get("directory")).canonical }])
    if (url.pathname === "/api/vcs")
      return json(route, {
        location: locationFor(url),
        data: { branch: "main", defaultBranch: "main" },
      })
    return json(route, {})
  })
}

function project(id: string, name: string, canonical: string) {
  return {
    id,
    name,
    canonical,
    vcs: "git",
    time: { created: 1, updated: 1 },
    sandboxes: [],
  }
}

function session(id: string, title: string, projectID: string, directory: string) {
  return {
    id,
    slug: id,
    projectID,
    directory,
    title,
    version: "dev",
    time: { created: 1, updated: 1 },
  }
}

function projectForDirectory(directory: string | null) {
  return directory === projectBeta.canonical ? projectBeta : projectAlpha
}

function locationFor(url: URL) {
  const project = projectForDirectory(url.searchParams.get("directory"))
  return {
    directory: project.canonical,
    project: { id: project.id, directory: project.canonical, canonical: project.canonical },
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  })
}

function sse(route: Route) {
  return route.fulfill({ status: 200, contentType: "text/event-stream", body: ": ok\n\n" })
}
