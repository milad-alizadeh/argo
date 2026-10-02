// Written by `bun run record:vendor-history`; do not edit by hand.

import type { CodexRecording } from '../../../cli/codex/recorded-codex-threads'
import type { Recorded } from '../../recorded'

export const codexRecording: Recorded<CodexRecording> = {
  producer: 'codex-app-server',
  version: '0.157.0',
  recordedAt: '2026-10-01T23:28:48.984Z',
  calls: [
    {
      method: 'thread/list',
      params: {
        limit: 50,
      },
      result: {
        data: [
          {
            id: '01a0f9cc-83f0-7482-895d-6b54873c24fa',
            environments: [
              {
                environmentId: 'local',
                cwd: '/Users/x/project-codex',
                runtimeWorkspaceRoots: ['/Users/x/project-codex'],
              },
            ],
            extra: null,
            sessionId: '01a0f9cc-83f0-7482-895d-6b54873c24fa',
            forkedFromId: null,
            parentThreadId: null,
            preview:
              '<task-notification><task-id>corpus-task</task-id><status>completed</status><summary>Task finished</summary></task-notification>',
            ephemeral: false,
            section: null,
            sectionEnteredAt: null,
            projectId: null,
            historyMode: 'paginated',
            modelProvider: 'openai',
            model: 'gpt-5.6-luna',
            reasoningEffort: 'low',
            createdAt: 1790897325,
            updatedAt: 1790897328,
            recencyAt: 1790897325,
            status: {
              type: 'idle',
            },
            path: '/Users/x/home/.codex/sessions/2026/10/02/rollout-2026-10-02T00-28-45-01a0f9cc-83f0-7482-895d-6b54873c24fa.jsonl',
            cwd: '/Users/x/project-codex',
            cliVersion: '0.157.0',
            originator: 'argo',
            source: 'vscode',
            canAcceptDirectInput: null,
            threadSource: null,
            agentNickname: null,
            agentRole: null,
            gitInfo: null,
            name: null,
            daybreakEnabled: null,
            turns: [],
          },
          {
            id: '01a0f9cc-3476-72d3-abb2-97dc3e9119ac',
            environments: [
              {
                environmentId: 'local',
                cwd: '/Users/x/project-codex',
                runtimeWorkspaceRoots: ['/Users/x/project-codex'],
              },
            ],
            extra: null,
            sessionId: '01a0f9cc-3476-72d3-abb2-97dc3e9119ac',
            forkedFromId: null,
            parentThreadId: null,
            preview: 'Continue the check',
            ephemeral: false,
            section: null,
            sectionEnteredAt: null,
            projectId: null,
            historyMode: 'paginated',
            modelProvider: 'openai',
            model: 'gpt-5.6-luna',
            reasoningEffort: 'low',
            createdAt: 1790897304,
            updatedAt: 1790897325,
            recencyAt: 1790897304,
            status: {
              type: 'idle',
            },
            path: '/Users/x/home/.codex/sessions/2026/10/02/rollout-2026-10-02T00-28-24-01a0f9cc-3476-72d3-abb2-97dc3e9119ac.jsonl',
            cwd: '/Users/x/project-codex',
            cliVersion: '0.157.0',
            originator: 'argo',
            source: 'vscode',
            canAcceptDirectInput: null,
            threadSource: null,
            agentNickname: null,
            agentRole: null,
            gitInfo: null,
            name: null,
            daybreakEnabled: null,
            turns: [],
          },
          {
            id: '01a0f9cb-ce68-7b93-a700-5e2289e63956',
            environments: [
              {
                environmentId: 'local',
                cwd: '/Users/x/project-codex',
                runtimeWorkspaceRoots: ['/Users/x/project-codex'],
              },
            ],
            extra: null,
            sessionId: '01a0f9cb-ce68-7b93-a700-5e2289e63956',
            forkedFromId: null,
            parentThreadId: null,
            preview: 'Run Codex check',
            ephemeral: false,
            section: null,
            sectionEnteredAt: null,
            projectId: null,
            historyMode: 'paginated',
            modelProvider: 'openai',
            model: 'gpt-5.6-luna',
            reasoningEffort: 'low',
            createdAt: 1790897278,
            updatedAt: 1790897304,
            recencyAt: 1790897303,
            status: {
              type: 'idle',
            },
            path: '/Users/x/home/.codex/sessions/2026/10/02/rollout-2026-10-02T00-27-58-01a0f9cb-ce68-7b93-a700-5e2289e63956.jsonl',
            cwd: '/Users/x/project-codex',
            cliVersion: '0.157.0',
            originator: 'argo',
            source: 'vscode',
            canAcceptDirectInput: null,
            threadSource: null,
            agentNickname: null,
            agentRole: null,
            gitInfo: null,
            name: null,
            daybreakEnabled: null,
            turns: [],
          },
        ],
        nextCursor: null,
        backwardsCursor: '2026-10-01T23:28:45.064Z',
      },
    },
    {
      method: 'thread/read',
      params: {
        threadId: '01a0f9cc-83f0-7482-895d-6b54873c24fa',
        includeTurns: false,
      },
      result: {
        thread: {
          id: '01a0f9cc-83f0-7482-895d-6b54873c24fa',
          environments: [
            {
              environmentId: 'local',
              cwd: '/Users/x/project-codex',
              runtimeWorkspaceRoots: ['/Users/x/project-codex'],
            },
          ],
          extra: null,
          sessionId: '01a0f9cc-83f0-7482-895d-6b54873c24fa',
          forkedFromId: null,
          parentThreadId: null,
          preview:
            '<task-notification><task-id>corpus-task</task-id><status>completed</status><summary>Task finished</summary></task-notification>',
          ephemeral: false,
          section: null,
          sectionEnteredAt: null,
          projectId: null,
          historyMode: 'paginated',
          modelProvider: 'openai',
          model: 'gpt-5.6-luna',
          reasoningEffort: 'low',
          createdAt: 1790897325,
          updatedAt: 1790897328,
          recencyAt: 1790897325,
          status: {
            type: 'idle',
          },
          path: '/Users/x/home/.codex/sessions/2026/10/02/rollout-2026-10-02T00-28-45-01a0f9cc-83f0-7482-895d-6b54873c24fa.jsonl',
          cwd: '/Users/x/project-codex',
          cliVersion: '0.157.0',
          originator: 'argo',
          source: 'vscode',
          canAcceptDirectInput: true,
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: null,
          daybreakEnabled: null,
          turns: [],
        },
      },
    },
    {
      method: 'thread/turns/list',
      params: {
        threadId: '01a0f9cc-83f0-7482-895d-6b54873c24fa',
        limit: 1,
        itemsView: 'full',
        sortDirection: 'asc',
        cursor: null,
      },
      result: {
        data: [
          {
            id: '01a0f9cc-842f-7493-8def-c2687afda229',
            items: [
              {
                type: 'userMessage',
                id: '01a0f9cc-8a33-7232-a8b2-df9b8ea149f4',
                clientId: null,
                content: [
                  {
                    type: 'text',
                    text: '<task-notification><task-id>corpus-task</task-id><status>completed</status><summary>Task finished</summary></task-notification>',
                    text_elements: [],
                  },
                ],
              },
              {
                type: 'reasoning',
                id: 'rs_05c5d23e97d44e88016abeecaffae487d2a71674bc980cf08b',
                summary: [],
                content: [],
              },
              {
                type: 'agentMessage',
                id: 'msg_05c5d23e97d44e88016abeecb069ac87d2a0c1ffca2df73d4c',
                text: 'The corpus task has completed successfully.',
                phase: 'final_answer',
                memoryCitation: null,
                delivery: null,
                questions: null,
              },
            ],
            itemsView: 'full',
            status: 'completed',
            error: null,
            startedAt: 1790897325,
            completedAt: 1790897328,
            durationMs: 3702,
          },
        ],
        nextCursor: null,
        backwardsCursor:
          '{"requestedThreadId":"01a0f9cc-83f0-7482-895d-6b54873c24fa","rolloutOrdinal":1,"includeAnchor":true,"scope":{"kind":"turns"}}',
      },
    },
    {
      method: 'thread/read',
      params: {
        threadId: '01a0f9cc-3476-72d3-abb2-97dc3e9119ac',
        includeTurns: false,
      },
      result: {
        thread: {
          id: '01a0f9cc-3476-72d3-abb2-97dc3e9119ac',
          environments: [
            {
              environmentId: 'local',
              cwd: '/Users/x/project-codex',
              runtimeWorkspaceRoots: ['/Users/x/project-codex'],
            },
          ],
          extra: null,
          sessionId: '01a0f9cc-3476-72d3-abb2-97dc3e9119ac',
          forkedFromId: null,
          parentThreadId: null,
          preview: 'Continue the check',
          ephemeral: false,
          section: null,
          sectionEnteredAt: null,
          projectId: null,
          historyMode: 'paginated',
          modelProvider: 'openai',
          model: 'gpt-5.6-luna',
          reasoningEffort: 'low',
          createdAt: 1790897304,
          updatedAt: 1790897325,
          recencyAt: 1790897304,
          status: {
            type: 'idle',
          },
          path: '/Users/x/home/.codex/sessions/2026/10/02/rollout-2026-10-02T00-28-24-01a0f9cc-3476-72d3-abb2-97dc3e9119ac.jsonl',
          cwd: '/Users/x/project-codex',
          cliVersion: '0.157.0',
          originator: 'argo',
          source: 'vscode',
          canAcceptDirectInput: true,
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: null,
          daybreakEnabled: null,
          turns: [],
        },
      },
    },
    {
      method: 'thread/turns/list',
      params: {
        threadId: '01a0f9cc-3476-72d3-abb2-97dc3e9119ac',
        limit: 1,
        itemsView: 'full',
        sortDirection: 'asc',
        cursor: null,
      },
      result: {
        data: [
          {
            id: '01a0f9cc-34af-7f92-b79d-432657bcce12',
            items: [
              {
                type: 'userMessage',
                id: '01a0f9cc-3a3d-7012-926b-5dfe2d8c3ca2',
                clientId: null,
                content: [
                  {
                    type: 'text',
                    text: 'Continue the check',
                    text_elements: [],
                  },
                ],
              },
              {
                type: 'reasoning',
                id: 'rs_0389a8b5bf1a4176016abeec9aece887d2918f991917ff72cf',
                summary: [],
                content: [],
              },
              {
                type: 'agentMessage',
                id: 'msg_0389a8b5bf1a4176016abeec9b983087d280ba8fe50aa5a781',
                text: 'I’m picking up the check from the current workspace state and will inspect what’s present before proceeding.',
                phase: 'commentary',
                memoryCitation: null,
                delivery: null,
                questions: null,
              },
              {
                type: 'commandExecution',
                id: 'exec-6522f1bd-f76a-4642-a7a8-80d0376f547f',
                pluginId: null,
                scriptPath: null,
                command:
                  "/bin/zsh -lc \"pwd && rg --files -g '\"'!node_modules'\"' -g '\"'!dist'\"' | head -80 && git status --short 2>/dev/null || true\"",
                cwd: '/Users/x/project-codex',
                processId: '98417',
                source: 'unifiedExecStartup',
                status: 'completed',
                commandActions: [
                  {
                    type: 'unknown',
                    command:
                      "pwd && rg --files -g '!node_modules' -g '!dist' | head -80 && git status --short 2>/dev/null || true",
                  },
                ],
                aggregatedOutput: null,
                exitCode: 0,
                durationMs: 1656,
              },
              {
                type: 'reasoning',
                id: 'rs_0389a8b5bf1a4176016abeeca0c79887d289414cd5f17ab821',
                summary: [],
                content: [],
              },
              {
                type: 'commandExecution',
                id: 'exec-7898d8de-0021-4dc5-aadc-845cbfb26b52',
                pluginId: null,
                scriptPath: null,
                command: "/bin/zsh -lc 'ls -la'",
                cwd: '/Users/x/project-codex',
                processId: '94942',
                source: 'unifiedExecStartup',
                status: 'completed',
                commandActions: [
                  {
                    type: 'listFiles',
                    command: 'ls -la',
                    path: null,
                  },
                ],
                aggregatedOutput:
                  'total 0\ndrwxr-xr-x@ 3 x  staff   96 Oct  2 00:27 .\ndrwx------@ 9 x  staff  288 Oct  2 00:27 ..\ndrwxr-xr-x@ 9 x  staff  288 Oct  2 00:27 .git\n',
                exitCode: 0,
                durationMs: 0,
              },
              {
                type: 'reasoning',
                id: 'rs_0389a8b5bf1a4176016abeeca3793487d2a74adbb8a8020818',
                summary: [],
                content: [],
              },
              {
                type: 'commandExecution',
                id: 'exec-e5a7293b-52a5-4e60-98f7-b62a35457907',
                pluginId: null,
                scriptPath: null,
                command:
                  "/bin/zsh -lc 'git status --short --branch && git log --oneline -5 && git branch -a'",
                cwd: '/Users/x/project-codex',
                processId: '83071',
                source: 'unifiedExecStartup',
                status: 'failed',
                commandActions: [
                  {
                    type: 'unknown',
                    command: 'git status --short --branch && git log --oneline -5 && git branch -a',
                  },
                ],
                aggregatedOutput:
                  "2026-10-02 00:28:37.780 xcodebuild[68160:254091949]  DVTFilePathFSEvents: Failed to start fs event stream.\n2026-10-02 00:28:37.961 xcodebuild[68160:254091917] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 \"Input/output error\". Using NSCachesDirectory instead.\ngit: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead\ngit: error: couldn't create cache file '/tmp/xcrun_db-pXpn57sb' (errno=Operation not permitted)\n2026-10-02 00:28:38.455 xcodebuild[68868:254093482]  DVTFilePathFSEvents: Failed to start fs event stream.\n2026-10-02 00:28:38.619 xcodebuild[68868:254093460] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 \"Input/output error\". Using NSCachesDirectory instead.\n## No commits yet on main\ngit: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead\ngit: error: couldn't create cache file '/tmp/xcrun_db-VEhSAXFl' (errno=Operation not permitted)\n2026-10-02 00:28:40.379 xcodebuild[70528:254097083]  DVTFilePathFSEvents: Failed to start fs event stream.\n2026-10-02 00:28:40.640 xcodebuild[70528:254097034] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 \"Input/output error\". Using NSCachesDirectory instead.\ngit: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead\ngit: error: couldn't create cache file '/tmp/xcrun_db-CaCE0cGp' (errno=Operation not permitted)\n2026-10-02 00:28:41.316 xcodebuild[71469:254099018]  DVTFilePathFSEvents: Failed to start fs event stream.\n2026-10-02 00:28:41.563 xcodebuild[71469:254098993] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 \"Input/output error\". Using NSCachesDirectory instead.\nfatal: your current branch 'main' does not have any commits yet\n",
                exitCode: 128,
                durationMs: 5930,
              },
              {
                type: 'agentMessage',
                id: 'msg_0389a8b5bf1a4176016abeecac531087d2b92f331edd66d6a1',
                text: 'The workspace is empty: there are no project files and no Git commits to continue checking. Please provide or restore the files, or tell me what specific check you meant.',
                phase: 'final_answer',
                memoryCitation: null,
                delivery: null,
                questions: null,
              },
            ],
            itemsView: 'full',
            status: 'completed',
            error: null,
            startedAt: 1790897304,
            completedAt: 1790897325,
            durationMs: 20283,
          },
        ],
        nextCursor: null,
        backwardsCursor:
          '{"requestedThreadId":"01a0f9cc-3476-72d3-abb2-97dc3e9119ac","rolloutOrdinal":1,"includeAnchor":true,"scope":{"kind":"turns"}}',
      },
    },
    {
      method: 'thread/read',
      params: {
        threadId: '01a0f9cb-ce68-7b93-a700-5e2289e63956',
        includeTurns: false,
      },
      result: {
        thread: {
          id: '01a0f9cb-ce68-7b93-a700-5e2289e63956',
          environments: [
            {
              environmentId: 'local',
              cwd: '/Users/x/project-codex',
              runtimeWorkspaceRoots: ['/Users/x/project-codex'],
            },
          ],
          extra: null,
          sessionId: '01a0f9cb-ce68-7b93-a700-5e2289e63956',
          forkedFromId: null,
          parentThreadId: null,
          preview: 'Run Codex check',
          ephemeral: false,
          section: null,
          sectionEnteredAt: null,
          projectId: null,
          historyMode: 'paginated',
          modelProvider: 'openai',
          model: 'gpt-5.6-luna',
          reasoningEffort: 'low',
          createdAt: 1790897278,
          updatedAt: 1790897304,
          recencyAt: 1790897303,
          status: {
            type: 'idle',
          },
          path: '/Users/x/home/.codex/sessions/2026/10/02/rollout-2026-10-02T00-27-58-01a0f9cb-ce68-7b93-a700-5e2289e63956.jsonl',
          cwd: '/Users/x/project-codex',
          cliVersion: '0.157.0',
          originator: 'argo',
          source: 'vscode',
          canAcceptDirectInput: true,
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: null,
          daybreakEnabled: null,
          turns: [],
        },
      },
    },
    {
      method: 'thread/turns/list',
      params: {
        threadId: '01a0f9cb-ce68-7b93-a700-5e2289e63956',
        limit: 1,
        itemsView: 'full',
        sortDirection: 'asc',
        cursor: null,
      },
      result: {
        data: [
          {
            id: '01a0f9cb-cea6-78f3-92ac-201ec11a5574',
            items: [
              {
                type: 'userMessage',
                id: '01a0f9cb-d9f3-78b3-9b2c-e68d6358823a',
                clientId: null,
                content: [
                  {
                    type: 'text',
                    text: 'Run Codex check',
                    text_elements: [],
                  },
                ],
              },
              {
                type: 'reasoning',
                id: 'rs_0a7fab01931f9d9c016abeec82da7c87d2b233a3484fe50539',
                summary: [],
                content: [],
              },
              {
                type: 'agentMessage',
                id: 'msg_0a7fab01931f9d9c016abeec834c2887d28815de55fc42f7f3',
                text: 'I’ll inspect the repository’s available check/test commands, then run the most appropriate Codex check and report the result.',
                phase: 'commentary',
                memoryCitation: null,
                delivery: null,
                questions: null,
              },
              {
                type: 'commandExecution',
                id: 'exec-904d96e7-cf17-41be-a531-5cc71fe54f5c',
                pluginId: null,
                scriptPath: null,
                command:
                  "/bin/zsh -lc \"pwd && rg --files -g '\"'!*node_modules*'\"' -g '\"'!*.lock'\"' | head -80 && (test -f package.json && sed -n '1,220p' package.json || true) && (test -f pyproject.toml && sed -n '1,180p' pyproject.toml || true) && (test -f Makefile && sed -n '1,160p' Makefile || true)\"",
                cwd: '/Users/x/project-codex',
                processId: '99021',
                source: 'unifiedExecStartup',
                status: 'completed',
                commandActions: [
                  {
                    type: 'unknown',
                    command:
                      "pwd && rg --files -g '!*node_modules*' -g '!*.lock' | head -80 && (test -f package.json && sed -n '1,220p' package.json || true) && (test -f pyproject.toml && sed -n '1,180p' pyproject.toml || true) && (test -f Makefile && sed -n '1,160p' Makefile || true)",
                  },
                ],
                aggregatedOutput: '/Users/x/project-codex\n',
                exitCode: 0,
                durationMs: 0,
              },
              {
                type: 'reasoning',
                id: 'rs_0a7fab01931f9d9c016abeec88548487d295b5d793476de880',
                summary: [],
                content: [],
              },
              {
                type: 'commandExecution',
                id: 'exec-b41c9b4b-2c29-4830-8e6c-0913d3b89777',
                pluginId: null,
                scriptPath: null,
                command: "/bin/zsh -lc 'ls -la && find . -maxdepth 2 -type f -print'",
                cwd: '/Users/x/project-codex',
                processId: '48177',
                source: 'unifiedExecStartup',
                status: 'completed',
                commandActions: [
                  {
                    type: 'listFiles',
                    command: 'ls -la',
                    path: null,
                  },
                  {
                    type: 'listFiles',
                    command: 'find . -maxdepth 2 -type f -print',
                    path: '.',
                  },
                ],
                aggregatedOutput:
                  'total 0\ndrwxr-xr-x@ 3 x  staff   96 Oct  2 00:27 .\ndrwx------@ 9 x  staff  288 Oct  2 00:27 ..\ndrwxr-xr-x@ 9 x  staff  288 Oct  2 00:27 .git\n./.git/config\n./.git/HEAD\n./.git/description\n',
                exitCode: 0,
                durationMs: 0,
              },
              {
                type: 'reasoning',
                id: 'rs_0a7fab01931f9d9c016abeec8b9a0087d2af8bd173c35edbba',
                summary: [],
                content: [],
              },
              {
                type: 'agentMessage',
                id: 'msg_0a7fab01931f9d9c016abeec8c160487d280f9e8939e4ea9c3',
                text: 'The workspace is an empty Git repository with no source files, manifests, or test configuration, so there’s no project-specific test command to run. I’m doing the remaining repository-level sanity check now.',
                phase: 'commentary',
                memoryCitation: null,
                delivery: null,
                questions: null,
              },
              {
                type: 'commandExecution',
                id: 'exec-6ba63799-bcc7-45eb-8dc7-b94143bd8a77',
                pluginId: null,
                scriptPath: null,
                command:
                  "/bin/zsh -lc 'git status --short --branch && git log -1 --oneline 2>/dev/null || true && git fsck --no-progress --full'",
                cwd: '/Users/x/project-codex',
                processId: '93299',
                source: 'unifiedExecStartup',
                status: 'completed',
                commandActions: [
                  {
                    type: 'unknown',
                    command:
                      'git status --short --branch && git log -1 --oneline 2>/dev/null || true && git fsck --no-progress --full',
                  },
                ],
                aggregatedOutput:
                  "2026-10-02 00:28:15.808 xcodebuild[41075:254038989]  DVTFilePathFSEvents: Failed to start fs event stream.\n2026-10-02 00:28:16.084 xcodebuild[41075:254038960] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 \"Input/output error\". Using NSCachesDirectory instead.\ngit: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead\ngit: error: couldn't create cache file '/tmp/xcrun_db-ZHBfKG02' (errno=Operation not permitted)\n2026-10-02 00:28:16.630 xcodebuild[42373:254041703]  DVTFilePathFSEvents: Failed to start fs event stream.\n2026-10-02 00:28:16.807 xcodebuild[42373:254041678] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 \"Input/output error\". Using NSCachesDirectory instead.\n## No commits yet on main\ngit: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead\ngit: error: couldn't create cache file '/tmp/xcrun_db-makCOc8I' (errno=Operation not permitted)\n2026-10-02 00:28:19.640 xcodebuild[45523:254048244]  DVTFilePathFSEvents: Failed to start fs event stream.\n2026-10-02 00:28:19.791 xcodebuild[45523:254048212] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 \"Input/output error\". Using NSCachesDirectory instead.\ngit: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead\ngit: error: couldn't create cache file '/tmp/xcrun_db-M9kEgR4x' (errno=Operation not permitted)\n2026-10-02 00:28:20.229 xcodebuild[46153:254049579]  DVTFilePathFSEvents: Failed to start fs event stream.\n2026-10-02 00:28:20.370 xcodebuild[46153:254049550] [MT] DVTDeveloperPaths: Failed to get length of DARWIN_USER_CACHE_DIR from confstr(3), error = Error Domain=NSPOSIXErrorDomain Code=5 \"Input/output error\". Using NSCachesDirectory instead.\nnotice: HEAD points to an unborn branch (main)\nnotice: No default references\n",
                exitCode: 0,
                durationMs: 5892,
              },
              {
                type: 'agentMessage',
                id: 'msg_0a7fab01931f9d9c016abeec95f3e887d2b485468a3f2301c8',
                text: 'Codex check complete:\n\n- Repository is empty: no source files, tests, or project configuration.\n- Git status: clean, unborn `main` branch.\n- No commits or references exist.\n- `git fsck`: no repository integrity issues; only environment-related Xcode cache warnings.',
                phase: 'final_answer',
                memoryCitation: null,
                delivery: null,
                questions: null,
              },
            ],
            itemsView: 'full',
            status: 'completed',
            error: null,
            startedAt: 1790897278,
            completedAt: 1790897303,
            durationMs: 24462,
          },
        ],
        nextCursor:
          '{"requestedThreadId":"01a0f9cb-ce68-7b93-a700-5e2289e63956","rolloutOrdinal":1,"includeAnchor":false,"scope":{"kind":"turns"}}',
        backwardsCursor:
          '{"requestedThreadId":"01a0f9cb-ce68-7b93-a700-5e2289e63956","rolloutOrdinal":1,"includeAnchor":true,"scope":{"kind":"turns"}}',
      },
    },
    {
      method: 'thread/turns/list',
      params: {
        threadId: '01a0f9cb-ce68-7b93-a700-5e2289e63956',
        limit: 1,
        itemsView: 'full',
        sortDirection: 'asc',
        cursor:
          '{"requestedThreadId":"01a0f9cb-ce68-7b93-a700-5e2289e63956","rolloutOrdinal":1,"includeAnchor":false,"scope":{"kind":"turns"}}',
      },
      result: {
        data: [
          {
            id: '01a0f9cc-2e36-7c01-bddc-0ab0ec919a47',
            items: [
              {
                type: 'userMessage',
                id: '01a0f9cc-2e64-7561-9e64-ff734c2cd131',
                clientId: null,
                content: [
                  {
                    type: 'text',
                    text: 'Confirm the check',
                    text_elements: [],
                  },
                ],
              },
              {
                type: 'agentMessage',
                id: 'msg_0a7fab01931f9d9c016abeec98137c87d295f8fc2f4cbc951d',
                text: 'Confirmed: the Codex check completed successfully. The repository is empty and clean, with no tests or project checks available to run.',
                phase: 'final_answer',
                memoryCitation: null,
                delivery: null,
                questions: null,
              },
            ],
            itemsView: 'full',
            status: 'completed',
            error: null,
            startedAt: 1790897303,
            completedAt: 1790897304,
            durationMs: 1587,
          },
        ],
        nextCursor: null,
        backwardsCursor:
          '{"requestedThreadId":"01a0f9cb-ce68-7b93-a700-5e2289e63956","rolloutOrdinal":41,"includeAnchor":true,"scope":{"kind":"turns"}}',
      },
    },
    {
      method: 'config/read',
      params: {
        includeLayers: true,
      },
      result: {
        layers: [
          {
            name: {
              type: 'sessionFlags',
            },
            version: 'sha256:3c1b644d79b901ddaac637b4fd5ed2f16fcb8c94cd97084beb805de61ce277c9',
            config: {
              features: {
                default_mode_request_user_input: true,
              },
            },
          },
          {
            name: {
              type: 'user',
              file: '/Users/x/home/.codex/config.toml',
              profile: null,
            },
            version: 'sha256:c65c5d21d338f2f4c81635e563b893598aeee470bfa78585fd515c45acbfd484',
            config: {
              model: 'gpt-5.5',
              hooks: {
                Stop: [
                  {
                    hooks: [
                      {
                        type: 'command',
                        command: 'say done',
                      },
                    ],
                  },
                ],
                PreToolUse: [
                  {
                    matcher: '^Bash$',
                    hooks: [
                      {
                        type: 'command',
                        command: './check.sh',
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            name: {
              type: 'system',
              file: '/etc/codex/config.toml',
            },
            version: 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
            config: {},
          },
        ],
      },
    },
  ],
}
