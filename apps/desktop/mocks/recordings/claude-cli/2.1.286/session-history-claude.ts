// Written by `bun run record:vendor-history`; do not edit by hand.

import type { ClaudeRecording } from '../../../cli/claude/recorded-claude-sessions'
import type { Recorded } from '../../recorded'

export const claudeRecording: Recorded<ClaudeRecording> = {
  producer: 'claude-cli',
  version: '2.1.286',
  recordedAt: '2026-10-01',
  agentSdk: '0.3.278',
  calls: [
    {
      method: 'listSessions',
      params: {
        includeProgrammatic: true,
      },
      result: [
        {
          sessionId: '75bb51e0-fcfe-4e45-a46f-fc35096b453a',
          summary: 'Start the parent work: reply with one short sentence.',
          lastModified: 1790869131923,
          fileSize: 166640,
          firstPrompt: 'Start the parent work: reply with one short sentence.',
          gitBranch: 'main',
          cwd: '/Users/x/resume',
          createdAt: 1790869120099,
        },
        {
          sessionId: '1f793961-810d-4b35-a1ef-ddfff7e8921d',
          summary: 'Continue the work: reply with one short sentence.',
          lastModified: 1790869125997,
          fileSize: 162798,
          firstPrompt: 'Start the parent work: reply with one short sentence.',
          gitBranch: 'main',
          cwd: '/Users/x/resume',
          createdAt: 1790869120050,
        },
        {
          sessionId: 'a822112b-065b-4018-b27e-c36f5f839f94',
          summary:
            'Run the composer check: run the shell command echo argo-recorded with the Bash tool, then edit notes.txt to replace old with new. Reply with one short sentence.',
          lastModified: 1790869119085,
          fileSize: 178510,
          firstPrompt:
            'Run the composer check: run the shell command echo argo-recorded with the Bash tool, then edit notes.txt to replace old with new. Reply with one short sentence.',
          gitBranch: 'main',
          cwd: '/Users/x/command',
          createdAt: 1790869112324,
        },
        {
          sessionId: '2ec58e51-e24c-4d94-bfc4-77f1b2a8af12',
          summary:
            'Ultrathink: is 221 prime? Reason before answering, then answer in one sentence.',
          lastModified: 1790869111137,
          fileSize: 161804,
          firstPrompt:
            'Ultrathink: is 221 prime? Reason before answering, then answer in one sentence.',
          gitBranch: 'main',
          cwd: '/Users/x/thought',
          createdAt: 1790869106972,
        },
        {
          sessionId: 'd7fc2a10-ccdd-4d0e-a56b-a3cb05073835',
          summary: 'Say hello, then confirm.',
          lastModified: 1790869105371,
          fileSize: 154688,
          firstPrompt: 'Say hello, then confirm.',
          gitBranch: 'main',
          cwd: '/Users/x/prose',
          createdAt: 1790869102288,
        },
      ],
    },
    {
      method: 'getSessionMessages',
      params: {
        sessionId: '75bb51e0-fcfe-4e45-a46f-fc35096b453a',
      },
      result: [
        {
          type: 'user',
          uuid: 'b2550a1d-c2ad-43e0-a7a8-8d6433b92db2',
          session_id: '75bb51e0-fcfe-4e45-a46f-fc35096b453a',
          message: {
            role: 'user',
            content: 'Start the parent work: reply with one short sentence.',
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:40.087Z',
        },
        {
          type: 'assistant',
          uuid: 'f0adadcd-37c0-4396-ad62-77a9b9587803',
          session_id: '75bb51e0-fcfe-4e45-a46f-fc35096b453a',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmTmAw9ires4m1sjTnk',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Starting the parent work now.',
              },
            ],
            container: null,
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 8338,
              cache_read_input_tokens: 21954,
              output_tokens: 11,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 8338,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 11,
                  cache_read_input_tokens: 21954,
                  cache_creation_input_tokens: 8338,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 8338,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: null,
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:41.859Z',
        },
        {
          type: 'user',
          uuid: '182d23c7-c8f0-4049-b54e-49aacc1fe97f',
          session_id: '75bb51e0-fcfe-4e45-a46f-fc35096b453a',
          message: {
            role: 'user',
            content: 'Continue the work: reply with one short sentence.',
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:43.124Z',
        },
        {
          type: 'assistant',
          uuid: '666c327d-80d2-4057-bf7a-507af55c9ed4',
          session_id: '75bb51e0-fcfe-4e45-a46f-fc35096b453a',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmTyYpHHhp2d3trvzfQ',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: "Continuing, though I haven't been given a specific task yet, so tell me what you'd like me to work on in this repo.",
              },
            ],
            container: null,
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 6807,
              cache_read_input_tokens: 23537,
              output_tokens: 39,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 6807,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 39,
                  cache_read_input_tokens: 23537,
                  cache_creation_input_tokens: 6807,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 6807,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: {
              cache_miss_reason: {
                type: 'messages_changed',
                cache_missed_input_tokens: 6455,
              },
            },
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:45.106Z',
        },
        {
          type: 'user',
          uuid: '953a94fe-48de-4ce5-ad2c-5ad695a7792a',
          session_id: '75bb51e0-fcfe-4e45-a46f-fc35096b453a',
          message: {
            role: 'user',
            content: 'Branch off: reply with one short sentence.',
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:47.063Z',
        },
        {
          type: 'assistant',
          uuid: 'd6ea5a52-2dce-4974-a6cc-f34dd0a72dd9',
          session_id: '75bb51e0-fcfe-4e45-a46f-fc35096b453a',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmUGxaG3xuSwo67T1SZ',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: "Branching off, but I still don't have a concrete task, so tell me what the branch should do (or a branch name) and I'll start.",
              },
            ],
            container: null,
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 7102,
              cache_read_input_tokens: 23537,
              output_tokens: 42,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 7102,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 42,
                  cache_read_input_tokens: 23537,
                  cache_creation_input_tokens: 7102,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 7102,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: {
              cache_miss_reason: {
                type: 'messages_changed',
                cache_missed_input_tokens: 6519,
              },
            },
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:50.950Z',
        },
      ],
    },
    {
      method: 'getSessionMessages',
      params: {
        sessionId: '1f793961-810d-4b35-a1ef-ddfff7e8921d',
      },
      result: [
        {
          type: 'user',
          uuid: 'b2550a1d-c2ad-43e0-a7a8-8d6433b92db2',
          session_id: '1f793961-810d-4b35-a1ef-ddfff7e8921d',
          message: {
            role: 'user',
            content: 'Start the parent work: reply with one short sentence.',
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:40.087Z',
        },
        {
          type: 'assistant',
          uuid: 'f0adadcd-37c0-4396-ad62-77a9b9587803',
          session_id: '1f793961-810d-4b35-a1ef-ddfff7e8921d',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmTmAw9ires4m1sjTnk',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Starting the parent work now.',
              },
            ],
            container: null,
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 8338,
              cache_read_input_tokens: 21954,
              output_tokens: 11,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 8338,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 11,
                  cache_read_input_tokens: 21954,
                  cache_creation_input_tokens: 8338,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 8338,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: null,
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:41.859Z',
        },
        {
          type: 'user',
          uuid: '182d23c7-c8f0-4049-b54e-49aacc1fe97f',
          session_id: '1f793961-810d-4b35-a1ef-ddfff7e8921d',
          message: {
            role: 'user',
            content: 'Continue the work: reply with one short sentence.',
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:43.124Z',
        },
        {
          type: 'assistant',
          uuid: '666c327d-80d2-4057-bf7a-507af55c9ed4',
          session_id: '1f793961-810d-4b35-a1ef-ddfff7e8921d',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmTyYpHHhp2d3trvzfQ',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: "Continuing, though I haven't been given a specific task yet, so tell me what you'd like me to work on in this repo.",
              },
            ],
            container: null,
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 6807,
              cache_read_input_tokens: 23537,
              output_tokens: 39,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 6807,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 39,
                  cache_read_input_tokens: 23537,
                  cache_creation_input_tokens: 6807,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 6807,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: {
              cache_miss_reason: {
                type: 'messages_changed',
                cache_missed_input_tokens: 6455,
              },
            },
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:45.106Z',
        },
      ],
    },
    {
      method: 'getSessionMessages',
      params: {
        sessionId: 'a822112b-065b-4018-b27e-c36f5f839f94',
      },
      result: [
        {
          type: 'user',
          uuid: 'eca65778-314f-4d3c-baf5-dddc1fd26e98',
          session_id: 'a822112b-065b-4018-b27e-c36f5f839f94',
          message: {
            role: 'user',
            content:
              'Run the composer check: run the shell command echo argo-recorded with the Bash tool, then edit notes.txt to replace old with new. Reply with one short sentence.',
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:32.376Z',
        },
        {
          type: 'assistant',
          uuid: 'a0e2b7a2-bd85-4722-bf27-418264bfb0f3',
          session_id: 'a822112b-065b-4018-b27e-c36f5f839f94',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmTBLhtrAboWb3H2emL',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'toolu_01Lqw6xGeoGghu6hAkQS7rzA',
                name: 'Bash',
                input: {
                  command: 'echo argo-recorded',
                  description: 'Echo recorded marker',
                },
                caller: {
                  type: 'direct',
                },
              },
            ],
            container: null,
            stop_reason: 'tool_use',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 8372,
              cache_read_input_tokens: 21954,
              output_tokens: 189,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 8372,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 189,
                  cache_read_input_tokens: 21954,
                  cache_creation_input_tokens: 8372,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 8372,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: null,
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:34.146Z',
        },
        {
          type: 'user',
          uuid: '4f17ef57-525c-4f14-bfd3-f6167788aab1',
          session_id: 'a822112b-065b-4018-b27e-c36f5f839f94',
          message: {
            role: 'user',
            content: [
              {
                tool_use_id: 'toolu_01Lqw6xGeoGghu6hAkQS7rzA',
                type: 'tool_result',
                content: 'argo-recorded',
                is_error: false,
              },
            ],
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:34.181Z',
        },
        {
          type: 'assistant',
          uuid: 'f985f7e8-4002-4605-a761-43078309a3b1',
          session_id: 'a822112b-065b-4018-b27e-c36f5f839f94',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmTBLhtrAboWb3H2emL',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'toolu_018GFpGTmBAthRdgofoYEUhj',
                name: 'Read',
                input: {
                  file_path: '/Users/x/command/notes.txt',
                },
                caller: {
                  type: 'direct',
                },
              },
            ],
            container: null,
            stop_reason: 'tool_use',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 8372,
              cache_read_input_tokens: 21954,
              output_tokens: 189,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 8372,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 189,
                  cache_read_input_tokens: 21954,
                  cache_creation_input_tokens: 8372,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 8372,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: null,
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:35.231Z',
        },
        {
          type: 'user',
          uuid: 'edcbf518-9f20-48e3-9479-e6a1398a6cb2',
          session_id: 'a822112b-065b-4018-b27e-c36f5f839f94',
          message: {
            role: 'user',
            content: [
              {
                tool_use_id: 'toolu_018GFpGTmBAthRdgofoYEUhj',
                type: 'tool_result',
                content: '1\told\n2\t',
              },
            ],
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:35.239Z',
        },
        {
          type: 'assistant',
          uuid: 'b1c2be8b-beb5-4a12-893d-b5b736144971',
          session_id: 'a822112b-065b-4018-b27e-c36f5f839f94',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmTPSyZF2fFbgDWqZvV',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'toolu_01KR4PzWjh5rmEgHMnHfn217',
                name: 'Edit',
                input: {
                  replace_all: false,
                  file_path: '/Users/x/command/notes.txt',
                  old_string: 'old',
                  new_string: 'new',
                },
                caller: {
                  type: 'direct',
                },
              },
            ],
            container: null,
            stop_reason: 'tool_use',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 1608,
              cache_read_input_tokens: 30326,
              output_tokens: 157,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 1608,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 157,
                  cache_read_input_tokens: 30326,
                  cache_creation_input_tokens: 1608,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 1608,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: null,
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:36.958Z',
        },
        {
          type: 'user',
          uuid: 'bd17ae92-6cd5-4ba0-877e-41a3520d7a4d',
          session_id: 'a822112b-065b-4018-b27e-c36f5f839f94',
          message: {
            role: 'user',
            content: [
              {
                tool_use_id: 'toolu_01KR4PzWjh5rmEgHMnHfn217',
                type: 'tool_result',
                content:
                  'The file /Users/x/command/notes.txt has been updated successfully. (file state is current in your context — no need to Read it back)',
              },
            ],
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:36.966Z',
        },
        {
          type: 'assistant',
          uuid: 'fce2b500-6be9-42f6-bde9-8185d1bfc1e1',
          session_id: 'a822112b-065b-4018-b27e-c36f5f839f94',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmTWRfcJsw81139K2rb',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'I ran `echo argo-recorded`, which printed `argo-recorded`, and changed `old` to `new` in `notes.txt`.',
              },
            ],
            container: null,
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 276,
              cache_read_input_tokens: 31934,
              output_tokens: 47,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 276,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 47,
                  cache_read_input_tokens: 31934,
                  cache_creation_input_tokens: 276,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 276,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: null,
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:37.978Z',
        },
      ],
    },
    {
      method: 'getSessionMessages',
      params: {
        sessionId: '2ec58e51-e24c-4d94-bfc4-77f1b2a8af12',
      },
      result: [
        {
          type: 'user',
          uuid: '374f04c7-5037-4895-88c3-ba806853e203',
          session_id: '2ec58e51-e24c-4d94-bfc4-77f1b2a8af12',
          message: {
            role: 'user',
            content:
              'Ultrathink: is 221 prime? Reason before answering, then answer in one sentence.',
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:27.036Z',
        },
        {
          type: 'assistant',
          uuid: '32040ece-9253-49a6-8bc7-956a30d98ae6',
          session_id: '2ec58e51-e24c-4d94-bfc4-77f1b2a8af12',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmSnfT6DtxpgegASPGp',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'thinking',
                thinking: '',
                signature:
                  'CAQS5QUKEAgSGAI4AUIIdGhpbmtpbmcSDMRp+LJtTdt5KRQAhRoM3pDag8R2JnL1c0kHIjAbUpySshMixrfST3a4gNIeNRa7Qk6W1a5PYGNGdii/mOWPiZKbB6ghcFg1DA+OopgqggWrsEWCyFCl6Iz1Y9N0lmzGrfRfRREPdktN3KmxgivukAbyc1l+4ReIlwEtspQmb+XAKEfiqqXD/1cdgKb26WcpkrJE/uHzCmlgaDWpV0dcbTPFdEJ53LWiGTd6HvfU+cRuDmLRqI9krTQ30jpqn8zrZVlOOPdJS1Iq82yT1EFHTxy1rehzvmGKWGO7asaoq8efSCcJU+6ijK25Lveyik7hQ3DmFHPyM4e7k67wWa8EsC9ABz1fSV+Z2Za1kwEZo8zb1VjR+llDemR9v3qKjS+2INZhM9v+2iwG+x58xFLb59okythtBsn9M5lq8CvH+mHS8X/8q+ccbBAyE0klRJzdIBxDQxDAeNJpYXeLQUJi2fRshm2NWFM/bH5pWA1QPlylXgVFUeqte7k723DyBCUvkmXznA7TiV45+Sg7IneKfYgeATcr4CB2bOTPoVfAuL5n0D+hyW5OQmtK2XRq5W2f7durrOZR9v6Pi0IDWmvOaC1K6FSSjzR44Qb4sM8dieR+RfVLqA+IZV0l2ijFdV+ra6ozqfjZto9URAUqMsTEIM4Tsae8O5pLtpV92ITXG7N8dvUtwj1NY+LkLBChHuLS9rrSiyZ3rLvQGFG5Z6rU43oDrOr3UlHyPXHSxLNykSo5dfxYucAUZx7OY9jXAbt2S4yemrtjRD4XfjMZlVRaPZVryDwgnXqbhoWGSu87LBsHFDqTmPGZ8uS42G/7FK5Z6+dbjswmqi9wY8FJMeUu0LGsF03VJI2gMWkep0RfQszNNcDWsJcY8TCI8EaI7flsLLXnesy0QTKWuqqsAtbCHV19S3Htc7nmu4+BjwcotG/f2l6dsxHIO3WAHpb0CbCg/1oYAQ==',
              },
            ],
            container: null,
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 8401,
              cache_read_input_tokens: 21954,
              output_tokens: 56,
              output_tokens_details: {
                thinking_tokens: 32,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 8401,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 56,
                  cache_read_input_tokens: 21954,
                  cache_creation_input_tokens: 8401,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 8401,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: null,
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:29.833Z',
        },
        {
          type: 'assistant',
          uuid: 'ef1962db-a2ab-4a97-8d70-2925d8b315bd',
          session_id: '2ec58e51-e24c-4d94-bfc4-77f1b2a8af12',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmSnfT6DtxpgegASPGp',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'No, 221 is not prime, because 13 × 17 = 221.',
              },
            ],
            container: null,
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 8401,
              cache_read_input_tokens: 21954,
              output_tokens: 56,
              output_tokens_details: {
                thinking_tokens: 32,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 8401,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 56,
                  cache_read_input_tokens: 21954,
                  cache_creation_input_tokens: 8401,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 8401,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: null,
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:29.987Z',
        },
      ],
    },
    {
      method: 'getSessionMessages',
      params: {
        sessionId: 'd7fc2a10-ccdd-4d0e-a56b-a3cb05073835',
      },
      result: [
        {
          type: 'user',
          uuid: 'a7f12782-1085-44a2-bcfa-784cb7e43a2d',
          session_id: 'd7fc2a10-ccdd-4d0e-a56b-a3cb05073835',
          message: {
            role: 'user',
            content: 'Say hello, then confirm.',
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:22.316Z',
        },
        {
          type: 'assistant',
          uuid: '684ed595-e182-437e-b485-a1fdc20e82d9',
          session_id: 'd7fc2a10-ccdd-4d0e-a56b-a3cb05073835',
          message: {
            model: 'claude-sonnet-5-5',
            id: 'msg_011CfbmSTCfktYfq4LmK4rNd',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: "Hello! Confirmed. I'm ready to help with your software engineering tasks in this repository.",
              },
            ],
            container: null,
            stop_reason: 'end_turn',
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 2,
              cache_creation_input_tokens: 30143,
              cache_read_input_tokens: 0,
              output_tokens: 33,
              output_tokens_details: {
                thinking_tokens: 0,
              },
              server_tool_use: {
                web_search_requests: 0,
                web_fetch_requests: 0,
              },
              service_tier: 'standard',
              cache_creation: {
                ephemeral_1h_input_tokens: 30143,
                ephemeral_5m_input_tokens: 0,
              },
              inference_geo: 'not_available',
              iterations: [
                {
                  input_tokens: 2,
                  output_tokens: 33,
                  cache_read_input_tokens: 0,
                  cache_creation_input_tokens: 30143,
                  cache_creation: {
                    ephemeral_5m_input_tokens: 0,
                    ephemeral_1h_input_tokens: 30143,
                  },
                  type: 'message',
                },
              ],
              speed: 'standard',
              fallback_credit: null,
            },
            input_transformations: [],
            diagnostics: null,
            context_management: null,
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
          timestamp: '2026-10-01T15:38:24.452Z',
        },
      ],
    },
  ],
}
