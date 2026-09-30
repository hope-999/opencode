import { createEffect, createMemo, For, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { Icon } from "@opencode/ui/icon"
import { ServerConnection } from "@/runtime/server/registry"
import { useGlobal } from "@/runtime/server/runtime"
import { useLanguage } from "@/runtime/i18n/language"
import { useTabs, tabKey, type Tab } from "@/shell/tabs/tabs"
import { projectForDirectory, groupProjectTabs, mergeProjectTabOrder, type ProjectTabGroup } from "./project-tabs-model"
import { TitlebarTabStrip } from "./tab-strip"

export function ProjectNavigation(props: {
  tabs: Tab[]
  currentTab: Tab | undefined
  sideMount?: () => HTMLElement | undefined
  onNavigate: (tab: Tab) => void
  onClose: (tab: Tab) => void
  onReorder: (keys: string[]) => void
}) {
  const global = useGlobal()
  const language = useLanguage()
  const tabs = useTabs()
  const requested = new Set<string>()

  const server = (tab: Tab) =>
    global.servers.list().find((item) => ServerConnection.key(item) === tab.server)
  const metadata = (tab: Tab) => {
    const conn = server(tab)
    if (!conn) return
    const ctx = global.ensureServerCtx(conn)
    if (tab.type === "draft") {
      const directory = tab.worktree ?? tab.directory
      return {
        directory,
        project: projectForDirectory(directory, ctx.projects.list()),
      }
    }
    const session = ctx.data.session.get(tab.sessionId)
    const directory = session?.location.directory ?? tabs.info[tabKey(tab)]?.directory
    return {
      session,
      directory,
      project: session
        ? ctx.projects.forSession(session)
        : directory
          ? projectForDirectory(directory, ctx.projects.list())
          : undefined,
    }
  }

  createEffect(() => {
    for (const tab of props.tabs) {
      if (tab.type !== "session") continue
      const conn = server(tab)
      const ctx = conn ? global.ensureServerCtx(conn) : undefined
      if (!ctx || ctx.data.session.get(tab.sessionId) || requested.has(`${tab.server}\0${tab.sessionId}`)) continue
      requested.add(`${tab.server}\0${tab.sessionId}`)
      void ctx.data.session.sync(tab.sessionId).catch(() => undefined)
    }
  })

  const groups = createMemo(() =>
    groupProjectTabs(props.tabs, {
      fallbackTitle: language.t("session.tab.session"),
      resolve: metadata,
    }),
  )
  const currentGroup = createMemo(() => {
    const current = props.currentTab
    if (!current) return
    const key = tabKey(current)
    return groups().find((group) => group.tabs.some((tab) => tabKey(tab) === key))
  })

  const selectGroup = (group: ProjectTabGroup) => {
    const current = props.currentTab
    const selected = current && group.tabs.some((tab) => tabKey(tab) === tabKey(current)) ? current : group.tabs[0]
    if (selected) props.onNavigate(selected)
  }

  return (
    <>
      <div data-slot="project-tabs" class="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar [app-region:no-drag]">
        <For each={groups()}>
          {(group) => (
            <button
              type="button"
              data-slot="project-tab"
              data-active={currentGroup()?.key === group.key}
              class="flex h-7 min-w-0 max-w-56 shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-[13px] font-medium text-v2-text-text-faint hover:bg-v2-overlay-simple-overlay-hover data-[active=true]:text-v2-text-text-base data-[active=true]:bg-v2-overlay-simple-overlay-pressed focus-visible:outline-none"
              aria-label={group.title}
              aria-pressed={currentGroup()?.key === group.key}
              onClick={() => selectGroup(group)}
            >
              <Icon name="folder" size="small" class="shrink-0 text-v2-icon-icon-muted" />
              <span class="min-w-0 truncate" dir="auto">{group.title}</span>
            </button>
          )}
        </For>
      </div>
      <Show when={props.sideMount?.()} keyed>
        {(mount) => {
          const group = () => currentGroup()
          const groupTabs = () => group()?.tabs ?? []
          return (
            <Portal mount={mount}>
              <div data-slot="horizontal-project-session-sidebar" class="flex size-full min-h-0 flex-col overflow-hidden">
                <Show
                  when={group()}
                  fallback={<div class="p-2 text-[13px] leading-[var(--line-height-compact)] text-v2-text-text-muted" />}
                >
                  <TitlebarTabStrip
                    orientation="vertical"
                    tabs={groupTabs()}
                    currentTab={props.currentTab}
                    onNavigate={props.onNavigate}
                    onClose={props.onClose}
                    onReorder={(keys) => {
                      const current = groupTabs().map(tabKey)
                      props.onReorder(mergeProjectTabOrder(props.tabs.map(tabKey), current, keys))
                    }}
                  />
                </Show>
              </div>
            </Portal>
          )
        }}
      </Show>
    </>
  )
}
