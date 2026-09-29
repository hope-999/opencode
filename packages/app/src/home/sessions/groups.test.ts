import { describe, expect, test } from "bun:test"
import type { SessionInfo } from "@opencode/client/promise"
import type { HomeSessionRecord } from "./records"
import { groupSessionsByProject } from "./groups"

const record = (id: string, projectID: string, updated: number, projectName = projectID): HomeSessionRecord => ({
  session: {
    id,
    projectID,
    title: id,
    location: { directory: `/repo/${projectID}` },
    time: { created: updated, updated },
  } as SessionInfo,
  project: { id: projectID, worktree: `/repo/${projectID}`, expanded: false },
  projectName,
})

describe("groupSessionsByProject", () => {
  test("groups sessions by project and orders groups by their latest session", () => {
    const groups = groupSessionsByProject([
      record("a-old", "project-a", 1),
      record("b", "project-b", 3),
      record("a-new", "project-a", 2),
    ])

    expect(groups.map((group) => [group.projectID, group.sessions.map((item) => item.session.id)])).toEqual([
      ["project-b", ["b"]],
      ["project-a", ["a-new", "a-old"]],
    ])
  })

  test("uses a stable project ID when project names collide", () => {
    const groups = groupSessionsByProject([
      record("a", "project-a", 2, "Shared name"),
      record("b", "project-b", 1, "Shared name"),
    ])

    expect(groups.map((group) => group.id)).toEqual(["project:project-a", "project:project-b"])
    expect(groups.map((group) => group.title)).toEqual(["Shared name", "Shared name"])
  })

  test("returns no groups for an empty list", () => {
    expect(groupSessionsByProject([])).toEqual([])
  })
})
