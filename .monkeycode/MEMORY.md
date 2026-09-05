# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-09-05
- Context: Discovered by Agent while 移植用户/卡密/公告/群验证系统并完成账号私有化与账号改名
- Category: Operations & Deployment
- Instructions:
  - 本仓库对应远端为 GitHub 私有仓库 https://github.com/zhi758258/qq-farm-bot-private（2026-09-05 从公开 fork zhi758258/qq-farm-bot 迁移而来，新仓库不是 fork，无法用网页 Sync fork；跟上游 xxxscarlxrd404/qq-farm-bot 需 `git remote add upstream <url>` 后 fetch/merge）。
  - 默认超级管理员账号为 `283405278` / 密码 `hai232658`，且 `mustChangePassword=false`，登录不弹强制改密；数据存于 `core/data/users.json`，代码常量在 `core/src/models/user-store.js` 的 `DEFAULT_ADMIN`。
  - 注册接口禁止使用 `admin`（不区分大小写）作为用户名（`RESERVED_USERNAMES`，在 `registerUserWithCard` 中校验），并禁止使用默认管理员用户名注册（findUser 重名拦截）。
  - 后台侧边栏底部署名显示 `283405278`（`web/src/components/Sidebar.vue`），不再显示上游作者 xxxscarlxrd404。
  - README 中 git clone 地址保留上游公开仓库（可用于获取源码），爱发电原作者支持段已移除。
