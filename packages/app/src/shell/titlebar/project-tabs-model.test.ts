import { describe, expect, test } from "bun:test"
import { groupProjectTabs, mergeProjectTabOrder } from "./project-tabs-model"
import type { Tab } from "@/shell/tabs/tabs"

const serverA = "http://server-a" as Tab["server"]
const serverB = "http://server-b" as Tab["server"]

function session(server: Tab["server"], sessionId: string, projectID: string, directory: string): Tab {
  return { type: "session", server, sessionId }
}

function draft(server: Tab["server"], draftID: string, directory: string): Tab {
  return { type: "draft", server, draftID, directory }
}

describe("project tab model", () => {
  test("groups opened sessions by server-scoped project identity", () => {
    const tabs = [session(serverA, "a", "project", "C:/projects/one"), session(serverB, "b", "project", "C:/projects/two")]
    const groups = groupProjectTabs(tabs, {
      fallbackTitle: "Session",
      resolve: (tab) => ({
        session: { projectID: "project", location: { directory: tab.server === serverA ? "C:/projects/one" : "C:/projects/two" } } as never,
      }),
    })
    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.tabs)).toEqual([[tabs[0]], [tabs[1]]])
  })

  test("keeps drafts in the directory project group", () => {
    const tab = draft(serverA, "draft", "C:/projects/one")
    const groups = groupProjectTabs([tab], {
      fallbackTitle: "Session",
      resolve: () => ({ directory: "C:/projects/one", project: { id: "project", worktree: "C:/projects/one" } }),
    })
    expect(groups[0]?.projectID).toBe("project")
    expect(groups[0]?.tabs).toEqual([tab])
  })

  test("merges reordered project rows back into the global tab order", () => {
    expect(mergeProjectTabOrder(["a", "x", "b", "c"], ["a", "b", "c"], ["c", "a", "b"])).toEqual([
      "c",
      "x",
      "a",
      "b",
    ])
  })
})
