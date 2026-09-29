import { describe, expect, test } from "bun:test"
import type { SessionInfo } from "@opencode/client"
import { groupSessions, mergeSessions, paginateSessions } from "../../src/component/project-session-navigation-model"

function session(id: string, projectID: string, created: number, parentID?: string): SessionInfo {
  return {
    id,
    projectID,
    parentID,
    title: id,
    version: "1",
    time: { created, updated: created },
    location: { directory: `/projects/${projectID}` },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  } as unknown as SessionInfo
}

describe("project session navigation", () => {
  test("merges local sessions over remote sessions and filters child sessions", () => {
    const result = mergeSessions(
      [session("remote", "project", 1), session("child", "project", 2, "remote")],
      [session("remote", "project", 3)],
    )

    expect(result).toEqual([session("remote", "project", 3)])
  })

  test("groups root sessions by project in creation order", () => {
    const result = groupSessions(
      [session("old", "a", 1), session("new", "a", 3), session("other", "b", 2)],
      () => undefined,
    )

    expect(result.map((group) => [group.projectID, group.sessions.map((item) => item.id)])).toEqual([
      ["a", ["new", "old"]],
      ["b", ["other"]],
    ])
  })

  test("paginates independently at the requested page size", () => {
    const sessions = Array.from({ length: 12 }, (_, index) => session(String(index), "a", index))
    expect(paginateSessions(sessions, 10)).toHaveLength(10)
    expect(paginateSessions(sessions, 15)).toHaveLength(12)
    expect(paginateSessions(sessions, 5)).toHaveLength(5)
  })
})
