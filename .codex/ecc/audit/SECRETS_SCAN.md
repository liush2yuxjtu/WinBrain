# Secrets 扫描日志（CI，已脱敏）

- 仓库：`liush2yuxjtu/WinBrain`
- 被扫描提交：`9f0b12fcf375041776d83077bf5c214bd3f97701`
- GitHub Actions 运行：[29136431762](https://github.com/liush2yuxjtu/WinBrain/actions/runs/29136431762)
- Git 跟踪文件数：`3724`
- 已扫描文本文件数：`3528`
- 跳过的大文件数（>2 MB）：`17`
- 跳过的二进制文件数：`179`
- 高置信度 secrets：`0`
- 待人工复核候选：`178`

> 报告不会保存匹配到的值，只保存类型、文件、行号和不可逆 SHA-256 指纹前 12 位。

## 高置信度结果

| 文件 | 行 | 类型 | 指纹 |
|---|---:|---|---|
| _未发现_ | — | — | — |

## 待人工复核候选

| 文件 | 行 | 类型 | 指纹 |
|---|---:|---|---|
| `.agents/plugins/claude-plugins-official/upstream/plugins/mcp-server-dev/skills/build-mcp-server/references/auth.md` | 30 | `credential-assignment:apikey` | `b2db582e1275` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/contact-center/android/examples/service-patterns.md` | 50 | `credential-assignment:apikey` | `c43701ec11cf` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/contact-center/ios/examples/service-patterns.md` | 53 | `credential-assignment:apikey` | `c43701ec11cf` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/authorization-patterns.md` | 59 | `credential-assignment:token` | `38f36846dcfa` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/authorization-patterns.md` | 154 | `credential-assignment:password` | `c4375c52a7d8` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/authorization-patterns.md` | 162 | `credential-assignment:accesstoken` | `86b3901eea37` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/automatic-skill-chaining-rest-webhooks.md` | 85 | `credential-assignment:accesstoken` | `2447d5032b5f` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/distributed-meeting-fallback-architecture.md` | 338 | `credential-assignment:accesstoken` | `1938890a30cf` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/meeting-webhooks-oauth-refresh-orchestration.md` | 99 | `credential-assignment:accesstoken` | `2447d5032b5f` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/ai-companion-integration.md` | 213 | `credential-assignment:clientsecret` | `dc118e0744a6` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/backend-automation-s2s-oauth.md` | 62 | `credential-assignment:token` | `ea7c8a57f366` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/customer-support-cobrowsing.md` | 59 | `credential-assignment:token` | `e00025955c84` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/meeting-details-with-events.md` | 131 | `credential-assignment:password` | `bfa17eb465d0` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/prebuilt-video-ui.md` | 91 | `credential-assignment:token` | `e00025955c84` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/retrieve-meeting-and-subscribe-events.md` | 470 | `credential-assignment:password` | `a7c42690b2b7` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/retrieve-meeting-and-subscribe-events.md` | 513 | `credential-assignment:password` | `bfa17eb465d0` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/retrieve-meeting-and-subscribe-events.md` | 558 | `credential-assignment:password` | `86b88a0cc5e8` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/sdk-wrappers-gui.md` | 170 | `credential-assignment:token` | `9f39dc12b7b8` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/sdk-wrappers-gui.md` | 505 | `credential-assignment:token` | `9f6ce9c3870e` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/team-chat-llm-bot.md` | 117 | `credential-assignment:apikey` | `15d71a5f6cd0` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/user-and-meeting-creation.md` | 87 | `credential-assignment:password` | `8efedfc280e1` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/user-and-meeting-creation.md` | 136 | `credential-assignment:password` | `8efedfc280e1` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/user-and-meeting-creation.md` | 297 | `credential-assignment:password` | `a7c42690b2b7` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/linux/linux.md` | 61 | `credential-assignment:token` | `5911da5faa8d` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/linux/references/linux-reference.md` | 183 | `credential-assignment:token` | `7d781201689b` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/react-native/examples/join-meeting-pattern.md` | 11 | `credential-assignment:password` | `0e54c3cda552` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/references/bot-authentication.md` | 333 | `credential-assignment:client_secret` | `434a64260ebd` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/references/webinars.md` | 90 | `credential-assignment:password` | `d986baed06b9` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/web/SKILL.md` | 227 | `credential-assignment:password` | `0e54c3cda552` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/web/SKILL.md` | 274 | `credential-assignment:password` | `0e54c3cda552` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/web/references/web.md` | 248 | `credential-assignment:password` | `0e54c3cda552` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/web/troubleshooting/common-issues.md` | 175 | `credential-assignment:password` | `1c16903d7ec3` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 79 | `credential-assignment:token` | `86b3901eea37` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 167 | `credential-assignment:access_token` | `c572c16299f4` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 171 | `credential-assignment:access_token` | `c572c16299f4` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 176 | `credential-assignment:access_token` | `c572c16299f4` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 332 | `credential-assignment:token` | `86b3901eea37` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/examples/s2s-oauth-redis.md` | 105 | `credential-assignment:token` | `86b3901eea37` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/api-architecture.md` | 68 | `credential-assignment:accesstoken` | `957ec46454a1` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/authentication-flows.md` | 56 | `credential-assignment:clientsecret` | `9a5f75fe98e5` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/authentication-flows.md` | 86 | `credential-assignment:token` | `2447d5032b5f` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/authentication-flows.md` | 139 | `credential-assignment:client_secret` | `83d151a98eac` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/authentication-flows.md` | 167 | `credential-assignment:token` | `4b0557fcc520` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/authentication.md` | 58 | `credential-assignment:clientsecret` | `9a5f75fe98e5` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/authentication.md` | 84 | `credential-assignment:token` | `ea7c8a57f366` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/authentication.md` | 262 | `credential-assignment:accesstoken` | `86b3901eea37` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/authentication.md` | 296 | `credential-assignment:accesstoken` | `ea7c8a57f366` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/openapi.md` | 62 | `credential-assignment:clientsecret` | `dc118e0744a6` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rivet-sdk/examples/getting-started-pattern.md` | 11 | `credential-assignment:clientsecret` | `6680d35b5a08` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rivet-sdk/examples/multi-client-pattern.md` | 15 | `credential-assignment:clientsecret` | `6680d35b5a08` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rivet-sdk/examples/multi-client-pattern.md` | 22 | `credential-assignment:clientsecret` | `6680d35b5a08` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rtms/examples/ai-integration.md` | 64 | `credential-assignment:apikey` | `0580da064437` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rtms/examples/ai-integration.md` | 149 | `credential-assignment:apikey` | `7d6dca494dd7` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rtms/examples/manual-websocket.md` | 26 | `credential-assignment:client_secret` | `dc118e0744a6` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rtms/references/quickstart.md` | 44 | `credential-assignment:clientsecret` | `dc118e0744a6` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/video-sdk/android/examples/session-join-pattern.md` | 5 | `credential-assignment:token` | `118eddf1a00e` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/virtual-agent/web/examples/campaign-and-entry-patterns.md` | 6 | `credential-assignment:apikey` | `358b5f6606b3` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/virtual-agent/web/examples/campaign-and-entry-patterns.md` | 22 | `credential-assignment:apikey` | `358b5f6606b3` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/websockets/references/connection.md` | 46 | `credential-assignment:accesstoken` | `ea7c8a57f366` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/websockets/references/connection.md` | 61 | `credential-assignment:clientsecret` | `9a5f75fe98e5` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/websockets/references/connection.md` | 329 | `credential-assignment:accesstoken` | `ea7c8a57f366` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/websockets/references/connection.md` | 413 | `credential-assignment:clientsecret` | `dc118e0744a6` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/zoom-apps-sdk/examples/in-client-oauth.md` | 132 | `credential-assignment:access_token` | `9083966a188a` |
| `.agents/plugins/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/zoom-apps-sdk/examples/in-client-oauth.md` | 172 | `credential-assignment:access_token` | `ea7c8a57f366` |
| `.agents/skills/claude-plugins-official/upstream/mcp-server-dev/skills/build-mcp-server/references/auth.md` | 30 | `credential-assignment:apikey` | `b2db582e1275` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/contact-center/android/examples/service-patterns.md` | 50 | `credential-assignment:apikey` | `c43701ec11cf` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/contact-center/ios/examples/service-patterns.md` | 53 | `credential-assignment:apikey` | `c43701ec11cf` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/authorization-patterns.md` | 59 | `credential-assignment:token` | `38f36846dcfa` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/authorization-patterns.md` | 154 | `credential-assignment:password` | `c4375c52a7d8` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/authorization-patterns.md` | 162 | `credential-assignment:accesstoken` | `86b3901eea37` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/automatic-skill-chaining-rest-webhooks.md` | 85 | `credential-assignment:accesstoken` | `2447d5032b5f` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/distributed-meeting-fallback-architecture.md` | 338 | `credential-assignment:accesstoken` | `1938890a30cf` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/references/meeting-webhooks-oauth-refresh-orchestration.md` | 99 | `credential-assignment:accesstoken` | `2447d5032b5f` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/ai-companion-integration.md` | 213 | `credential-assignment:clientsecret` | `dc118e0744a6` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/backend-automation-s2s-oauth.md` | 62 | `credential-assignment:token` | `ea7c8a57f366` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/customer-support-cobrowsing.md` | 59 | `credential-assignment:token` | `e00025955c84` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/meeting-details-with-events.md` | 131 | `credential-assignment:password` | `bfa17eb465d0` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/prebuilt-video-ui.md` | 91 | `credential-assignment:token` | `e00025955c84` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/retrieve-meeting-and-subscribe-events.md` | 470 | `credential-assignment:password` | `a7c42690b2b7` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/retrieve-meeting-and-subscribe-events.md` | 513 | `credential-assignment:password` | `bfa17eb465d0` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/retrieve-meeting-and-subscribe-events.md` | 558 | `credential-assignment:password` | `86b88a0cc5e8` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/sdk-wrappers-gui.md` | 170 | `credential-assignment:token` | `9f39dc12b7b8` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/sdk-wrappers-gui.md` | 505 | `credential-assignment:token` | `9f6ce9c3870e` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/team-chat-llm-bot.md` | 117 | `credential-assignment:apikey` | `15d71a5f6cd0` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/user-and-meeting-creation.md` | 87 | `credential-assignment:password` | `8efedfc280e1` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/user-and-meeting-creation.md` | 136 | `credential-assignment:password` | `8efedfc280e1` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/general/use-cases/user-and-meeting-creation.md` | 297 | `credential-assignment:password` | `a7c42690b2b7` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/linux/linux.md` | 61 | `credential-assignment:token` | `5911da5faa8d` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/linux/references/linux-reference.md` | 183 | `credential-assignment:token` | `7d781201689b` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/react-native/examples/join-meeting-pattern.md` | 11 | `credential-assignment:password` | `0e54c3cda552` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/references/bot-authentication.md` | 333 | `credential-assignment:client_secret` | `434a64260ebd` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/references/webinars.md` | 90 | `credential-assignment:password` | `d986baed06b9` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/web/SKILL.md` | 227 | `credential-assignment:password` | `0e54c3cda552` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/web/SKILL.md` | 274 | `credential-assignment:password` | `0e54c3cda552` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/web/references/web.md` | 248 | `credential-assignment:password` | `0e54c3cda552` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/meeting-sdk/web/troubleshooting/common-issues.md` | 175 | `credential-assignment:password` | `1c16903d7ec3` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 79 | `credential-assignment:token` | `86b3901eea37` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 167 | `credential-assignment:access_token` | `c572c16299f4` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 171 | `credential-assignment:access_token` | `c572c16299f4` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 176 | `credential-assignment:access_token` | `c572c16299f4` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/concepts/token-lifecycle.md` | 332 | `credential-assignment:token` | `86b3901eea37` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/oauth/examples/s2s-oauth-redis.md` | 105 | `credential-assignment:token` | `86b3901eea37` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/api-architecture.md` | 68 | `credential-assignment:accesstoken` | `957ec46454a1` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/authentication-flows.md` | 56 | `credential-assignment:clientsecret` | `9a5f75fe98e5` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/authentication-flows.md` | 86 | `credential-assignment:token` | `2447d5032b5f` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/authentication-flows.md` | 139 | `credential-assignment:client_secret` | `83d151a98eac` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/concepts/authentication-flows.md` | 167 | `credential-assignment:token` | `4b0557fcc520` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/authentication.md` | 58 | `credential-assignment:clientsecret` | `9a5f75fe98e5` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/authentication.md` | 84 | `credential-assignment:token` | `ea7c8a57f366` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/authentication.md` | 262 | `credential-assignment:accesstoken` | `86b3901eea37` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/authentication.md` | 296 | `credential-assignment:accesstoken` | `ea7c8a57f366` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rest-api/references/openapi.md` | 62 | `credential-assignment:clientsecret` | `dc118e0744a6` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rivet-sdk/examples/getting-started-pattern.md` | 11 | `credential-assignment:clientsecret` | `6680d35b5a08` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rivet-sdk/examples/multi-client-pattern.md` | 15 | `credential-assignment:clientsecret` | `6680d35b5a08` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rivet-sdk/examples/multi-client-pattern.md` | 22 | `credential-assignment:clientsecret` | `6680d35b5a08` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rtms/examples/ai-integration.md` | 64 | `credential-assignment:apikey` | `0580da064437` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rtms/examples/ai-integration.md` | 149 | `credential-assignment:apikey` | `7d6dca494dd7` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rtms/examples/manual-websocket.md` | 26 | `credential-assignment:client_secret` | `dc118e0744a6` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/rtms/references/quickstart.md` | 44 | `credential-assignment:clientsecret` | `dc118e0744a6` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/video-sdk/android/examples/session-join-pattern.md` | 5 | `credential-assignment:token` | `118eddf1a00e` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/virtual-agent/web/examples/campaign-and-entry-patterns.md` | 6 | `credential-assignment:apikey` | `358b5f6606b3` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/virtual-agent/web/examples/campaign-and-entry-patterns.md` | 22 | `credential-assignment:apikey` | `358b5f6606b3` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/websockets/references/connection.md` | 46 | `credential-assignment:accesstoken` | `ea7c8a57f366` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/websockets/references/connection.md` | 61 | `credential-assignment:clientsecret` | `9a5f75fe98e5` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/websockets/references/connection.md` | 329 | `credential-assignment:accesstoken` | `ea7c8a57f366` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/websockets/references/connection.md` | 413 | `credential-assignment:clientsecret` | `dc118e0744a6` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/zoom-apps-sdk/examples/in-client-oauth.md` | 132 | `credential-assignment:access_token` | `9083966a188a` |
| `.agents/skills/knowledge-work-plugins/upstream/partner-built/zoom-plugin/skills/zoom-apps-sdk/examples/in-client-oauth.md` | 172 | `credential-assignment:access_token` | `ea7c8a57f366` |
| `.codex/ecc/upstream/agents/code-reviewer.md` | 270 | `credential-assignment:apikey` | `85030dcccd84` |
| `.codex/ecc/upstream/skills/api-design/SKILL.md` | 307 | `credential-assignment:api-key` | `e9982364fd73` |
| `.codex/ecc/upstream/skills/backend-patterns/SKILL.md` | 108 | `credential-assignment:token` | `38f36846dcfa` |
| `.codex/ecc/upstream/skills/backend-patterns/SKILL.md` | 370 | `credential-assignment:token` | `5d999b7f0433` |
| `.codex/ecc/upstream/skills/clickhouse-io/SKILL.md` | 170 | `credential-assignment:password` | `fa426ad2a524` |
| `.codex/ecc/upstream/skills/data-scraper-agent/SKILL.md` | 226 | `credential-assignment:api_key` | `ceb969f320cb` |
| `.codex/ecc/upstream/skills/django-patterns/SKILL.md` | 354 | `credential-assignment:password` | `1748aef4c852` |
| `.codex/ecc/upstream/skills/django-patterns/SKILL.md` | 377 | `credential-assignment:password` | `8bf16b529f16` |
| `.codex/ecc/upstream/skills/django-patterns/SKILL.md` | 514 | `credential-assignment:token` | `689a7e1e4473` |
| `.codex/ecc/upstream/skills/django-tdd/SKILL.md` | 127 | `credential-assignment:password` | `e4abae53cc1c` |
| `.codex/ecc/upstream/skills/django-tdd/SKILL.md` | 172 | `credential-assignment:password` | `78d266c54630` |
| `.codex/ecc/upstream/skills/kotlin-exposed-patterns/SKILL.md` | 59 | `credential-assignment:password` | `5c96c4373d46` |
| `.codex/ecc/upstream/skills/kotlin-exposed-patterns/SKILL.md` | 79 | `credential-assignment:password` | `5c96c4373d46` |
| `.codex/ecc/upstream/skills/kotlin-exposed-patterns/SKILL.md` | 117 | `credential-assignment:password` | `4ec3da5efdb4` |
| `.codex/ecc/upstream/skills/kotlin-ktor-patterns/SKILL.md` | 278 | `credential-assignment:token` | `933b4bd5802b` |
| `.codex/ecc/upstream/skills/kotlin-ktor-patterns/SKILL.md` | 617 | `credential-assignment:token` | `52c44cd6d549` |
| `.codex/ecc/upstream/skills/mysql-patterns/SKILL.md` | 269 | `credential-assignment:password` | `020a9ff56ba2` |
| `.codex/ecc/upstream/skills/python-testing/SKILL.md` | 247 | `credential-assignment:token` | `114410319ecd` |
| `.codex/ecc/upstream/skills/python-testing/SKILL.md` | 458 | `credential-assignment:api_key` | `a810b891daf7` |
| `.codex/ecc/upstream/skills/quarkus-security/SKILL.md` | 83 | `credential-assignment:token` | `19b54ab285cb` |
| `.codex/ecc/upstream/skills/quarkus-security/SKILL.md` | 281 | `credential-assignment:password` | `e2794d1158af` |
| `.codex/ecc/upstream/skills/redis-patterns/SKILL.md` | 191 | `credential-assignment:token` | `816c14e60567` |
| `.codex/ecc/upstream/skills/scientific-db-pubmed-database/SKILL.md` | 123 | `credential-assignment:api_key` | `ceb969f320cb` |
| `.codex/ecc/upstream/skills/security-review/SKILL.md` | 34 | `credential-assignment:apikey` | `7d6dca494dd7` |
| `.codex/ecc/upstream/skills/security-review/SKILL.md` | 250 | `credential-assignment:token` | `5d999b7f0433` |
| `.codex/ecc/upstream/skills/security-review/cloud-infrastructure-security.md` | 76 | `credential-assignment:apikey` | `85030dcccd84` |
| `.codex/ecc/upstream/skills/springboot-security/SKILL.md` | 42 | `credential-assignment:token` | `a0c0d5e1196e` |
| `.codex/ecc/upstream/skills/springboot-security/SKILL.md` | 160 | `credential-assignment:password` | `1e28d0fd01d0` |
| `.codex/ecc/upstream/skills/videodb/reference/api-reference.md` | 11 | `credential-assignment:api_key` | `a2ae6a9ee724` |
| `.codex/ecc/upstream/skills/videodb/reference/capture-reference.md` | 264 | `credential-assignment:token` | `56e5165f2d34` |
| `apps/business-skill-studio/README.md` | 157 | `credential-assignment:password` | `2c935752ef38` |
| `apps/business-skill-studio/components/settings-client.tsx` | 117 | `credential-assignment:password` | `2c935752ef38` |
| `apps/business-skill-studio/components/settings-client.tsx` | 239 | `credential-assignment:password` | `f334ba6b37a2` |
| `apps/business-skill-studio/docs/local-fmcg-test-database.md` | 15 | `credential-assignment:password` | `2c935752ef38` |
| `apps/business-skill-studio/lib/company-settings.ts` | 254 | `credential-assignment:password` | `ecc8cd4dbb45` |
| `apps/business-skill-studio/lib/customer-database.ts` | 101 | `credential-assignment:password` | `1eb01bb09968` |
| `apps/business-skill-studio/lib/customer-database.ts` | 120 | `credential-assignment:password` | `1eb01bb09968` |
| `apps/business-skill-studio/lib/data-source-security.ts` | 61 | `credential-assignment:password` | `c2eaaa35ce98` |
| `apps/business-skill-studio/scripts/hash-password.mjs` | 3 | `credential-assignment:password` | `c283158c8d73` |
| `apps/business-skill-studio/scripts/verify-uat-database.mjs` | 43 | `credential-assignment:password` | `a6a26639663a` |
| `apps/business-skill-studio/tests/company-settings.integration.test.ts` | 54 | `credential-assignment:password` | `2cbd37b29628` |
| `apps/business-skill-studio/tests/customer-database.integration.test.ts` | 18 | `credential-assignment:password` | `ef6538eddf26` |
| `apps/business-skill-studio/tests/customer-database.integration.test.ts` | 38 | `credential-assignment:password` | `2c935752ef38` |
| `apps/business-skill-studio/tests/customer-database.integration.test.ts` | 54 | `credential-assignment:password` | `aad7a959e48c` |
| `apps/business-skill-studio/tests/data-source-crypto.test.ts` | 14 | `credential-assignment:password` | `eb9926bc43ef` |
| `scripts/update-pr-evidence.mjs` | 11 | `credential-assignment:token` | `d84c66c7d433` |
| `tests/database-explorer.spec.ts` | 6 | `credential-assignment:password` | `fbcbd4b86dab` |
| `tests/skill-library.spec.ts` | 5 | `credential-assignment:password` | `3b753e37baa4` |
| `tools/record-frontend.mjs` | 188 | `credential-assignment:password` | `608b269406fc` |
| `tools/verify-skill-database.mjs` | 12 | `credential-assignment:password` | `608b269406fc` |

## 扫描边界

- 此扫描覆盖 GitHub 仓库中当前提交的 Git 跟踪文件。
- 它不会读取开发机上的未跟踪文件、环境变量、操作系统密钥链、Shell 历史或仓库外文件。
- 因此它可以替代“远端仓库 secrets 扫描日志”，但不能证明本地机器不存在未提交的 secrets。
