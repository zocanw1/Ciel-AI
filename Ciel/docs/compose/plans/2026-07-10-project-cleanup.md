# Project Cleanup & Gap Analysis Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up and find gaps in both projects (Asisten-Pribadi & Asistent AI Telegram), fixing code duplication, dead code, security issues, and organizational problems.

**Architecture:** Each project gets its own set of cleanup tasks. Projects remain separate but share common patterns. Focus on minimal, targeted fixes — no feature additions.

**Tech Stack:** Node.js, Discord.js, Telegram Bot API, DeepSeek/Gemini/Groq APIs

---

## [S1] Asisten-Pribadi (Ciel) — Verified Issues

### [S1.1] Code Duplication (VERIFIED)
- `normalizeSchema()` identical in `core/deepseek_provider.js:3-12` and `core/gemini_provider.js:3-12`
- `formatUptime()` duplicated in `commands/info.js:190-201` and `commands/pm2list.js:54-65`
- `progressBar()` duplicated in `commands/info.js:179-183` and `commands/ramusage.js:61-65`
- `fmtMB()` duplicated in `commands/info.js:185-188` and `commands/ramusage.js:67-71`

### [S1.2] Dead Code (VERIFIED — 100% confirmed unused)
- `core/gemini_provider.js` — GeminiProvider defined but **NEVER imported** anywhere in the project (grep confirmed)
- `core/runtime_env.js` exports `loadGeminiConfig()` but **NEVER called** anywhere (grep confirmed)
- `Server` file — Just a text note "Sync Second Brain - Laptop -", not functional code

### [S1.3] Security Issues
- `tools/execute_command.js:15` — No command sanitization
- `tools/read_file.js` and `tools/write_file.js` — Path traversal not checked at tool level
- `index.js:50-57` — Git commit message injected via string concatenation

### [S1.4] Configuration Issues
- `commands/help.js:13` — Hardcoded IP `http://192.168.1.10:5000/`
- `index.js:34-35` — Second Brain path hardcoded
- `.env.example` missing DEEPSEEK_API_KEY

### [S1.5] Missing
- No tests exist
- No graceful shutdown handler

---

## [S2] Asistent AI Telegram (Stella) — Verified Issues

### [S2.1] Code Duplication (VERIFIED — Critical)
- `loadEnvFile()` duplicated in `index.js:56-73` AND `discord_bot.js:50-65`
- `loadDynamicTools()` / tool loading logic duplicated
- `handleToolCall()` duplicated between `index.js:382-396` and `discord_bot.js`
- `getHistory()`, `addToHistory()`, `getMemoryText()` duplicated
- `saveMemory()` duplicated
- Media sending logic (~50 lines) duplicated
- Engine initialization block (~60 lines) duplicated

### [S2.2] Dead Code (VERIFIED — Corrected)
- `core/behavior_tree.js` — **NOT dead code**, used by `stella_tree.js` which is used by both entry points
- `UPDATE_LOG.md` — Manual documentation log, last entry 2026-05-04. Keep but update
- `discloud.config` — **NOT dead code**, used for Discloud deployment (points to `discord_bot.js`)
- `stella_control.py` — **NOT dead code**, SSH control script. BUT has **CRITICAL SECURITY ISSUE**

### [S2.3] Security Issues (CRITICAL)
- `stella_control.py:9` — **HARDCODED SSH PASSWORD** (`330757871`). Must be moved to env var or removed
- `tools/execute_command.js` — Command injection risk
- `tools/write_file.js` — No path restriction
- `discord_bot.js` — No permission checks for admin commands

### [S2.4] Configuration Issues
- `index.js:123` — Hardcoded model name `gemini-3.1-flash-lite-preview`
- `index.js:90` — Hardcoded Groq model `llama-3.3-70b-versatile`
- No `.env.example` file
- `settings.json` in `.gitignore` (good)

### [S2.5] File Organization
- `local_audio/` and `local_images/` in root
- `StellaBrain_*.md` generated in root
- `Memory/` vs `memory_bank.json` naming confusing

---

## Implementation Plan

### Phase 1: Asisten-Pribadi Cleanup (6 tasks)

#### Task 1: Extract shared utilities
**Files:**
- Create: `core/utils.js`
- Modify: `commands/info.js`, `commands/pm2list.js`, `commands/ramusage.js`

**Steps:**
- [ ] Create `core/utils.js` with shared `formatUptime()`, `progressBar()`, `fmtMB()` functions
- [ ] Update `commands/info.js` to import from `core/utils.js`
- [ ] Update `commands/pm2list.js` to import from `core/utils.js`
- [ ] Update `commands/ramusage.js` to import from `core/utils.js`
- [ ] Run: `node -e "require('./commands/info.js')"` to verify

#### Task 2: Extract normalizeSchema to shared location
**Files:**
- Modify: `core/deepseek_provider.js`, `core/gemini_provider.js`

**Steps:**
- [ ] Move `normalizeSchema()` to `core/utils.js`
- [ ] Update `deepseek_provider.js` to import from utils
- [ ] Update `gemini_provider.js` to import from utils
- [ ] Verify: `node -e "require('./core/deepseek_provider.js')"` and `node -e "require('./core/gemini_provider.js')"`

#### Task 3: Fix security issues
**Files:**
- Modify: `tools/execute_command.js`, `index.js`

**Steps:**
- [ ] Add command blocklist to `execute_command.js` (block `rm -rf`, `mkfs`, etc.)
- [ ] Fix git commit command injection in `index.js:50-57`
- [ ] Test: Verify blocked commands return error

#### Task 4: Configuration improvements
**Files:**
- Modify: `.env.example`, `commands/help.js`

**Steps:**
- [ ] Add `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL` to `.env.example`
- [ ] Make monitor URL configurable via env var in `help.js`
- [ ] Verify: Check `.env.example` has all required vars

#### Task 5: Remove verified dead code (100% CONFIRMED)
**Files:**
- Delete: `core/gemini_provider.js` (NEVER imported anywhere)
- Modify: `core/runtime_env.js` (remove unused `loadGeminiConfig`)
- Delete: `Server` file (just a text note, not functional)

**Verification before deletion:**
- [ ] Run `grep -r "GeminiProvider\|gemini_provider" .` — confirmed 0 imports
- [ ] Run `grep -r "loadGeminiConfig" .` — confirmed 0 calls
- [ ] Run `cat Server` — confirmed just a text note
- [ ] After deletion, run `node index.js` to verify bot still starts

#### Task 6: Add graceful shutdown
**Files:**
- Modify: `index.js`

**Steps:**
- [ ] Add SIGTERM/SIGINT handlers
- [ ] Add unhandledRejection handler
- [ ] Test: Send SIGINT, verify clean shutdown

---

### Phase 2: Asistent AI Telegram Cleanup (8 tasks)

#### Task 7: CRITICAL — Fix hardcoded credentials
**Files:**
- Modify: `stella_control.py`

**Steps:**
- [ ] Read `stella_control.py` to understand full usage
- [ ] Move credentials to environment variables or `.env` file
- [ ] Add `.env` loading to Python script (use `python-dotenv`)
- [ ] Verify: Script still works with env vars

#### Task 8: Create shared bot utilities module
**Files:**
- Create: `core/bot_utils.js`

**Steps:**
- [ ] Create `core/bot_utils.js` with shared functions:
  - `loadEnvFile()`
  - `getHistory()`, `addToHistory()`, `getMemoryText()`
  - `saveMemory()`
  - `loadDynamicTools()`
  - `handleToolCall()`
- [ ] Verify: `node -e "require('./core/bot_utils.js')"` works

#### Task 9: Refactor index.js to use bot_utils
**Files:**
- Modify: `index.js`

**Steps:**
- [ ] Import functions from `core/bot_utils.js`
- [ ] Remove duplicated function definitions from `index.js`
- [ ] Verify: `node --check index.js` passes
- [ ] Test: Bot starts and responds to messages

#### Task 10: Refactor discord_bot.js to use bot_utils
**Files:**
- Modify: `discord_bot.js`

**Steps:**
- [ ] Import functions from `core/bot_utils.js`
- [ ] Remove duplicated function definitions from `discord_bot.js`
- [ ] Verify: `node --check discord_bot.js` passes
- [ ] Test: Discord bot starts and responds

#### Task 11: Create shared engine initialization module
**Files:**
- Create: `core/engine_init.js`

**Steps:**
- [ ] Create `core/engine_init.js` that exports a function to initialize all v5 engines
- [ ] Return all engine instances as an object
- [ ] Verify: `node -e "require('./core/engine_init.js')"` works

#### Task 12: Refactor entry points to use engine_init
**Files:**
- Modify: `index.js`, `discord_bot.js`

**Steps:**
- [ ] Replace engine initialization blocks in `index.js` with call to `engine_init.js`
- [ ] Replace engine initialization blocks in `discord_bot.js` with call to `engine_init.js`
- [ ] Verify both bots still start correctly

#### Task 13: Fix security issues in Stella
**Files:**
- Modify: `tools/execute_command.js`, `tools/write_file.js`

**Steps:**
- [ ] Add command blocklist to `tools/execute_command.js`
- [ ] Add path restriction to `tools/write_file.js` (workspace only)
- [ ] Test: Verify blocked operations return errors

#### Task 14: Configuration and .env cleanup
**Files:**
- Create: `.env.example`, Modify: `.gitignore`

**Steps:**
- [ ] Create `.env.example` with all required vars
- [ ] Add `settings.json` to `.gitignore` (already there, verify)
- [ ] Remove hardcoded model names, make configurable via env
- [ ] Verify: Check all env vars are documented

#### Task 15: File organization cleanup
**Files:**
- Modify: Directory structure

**Steps:**
- [ ] Move `local_audio/` and `local_images/` contents to `data/media/`
- [ ] Ensure `StellaBrain_*.md` files are in `.gitignore`
- [ ] Verify: Bot still finds media files correctly

---

### Phase 3: Cross-Project Improvements (3 tasks)

#### Task 16: Add basic tests to Asisten-Pribadi
**Files:**
- Create: `tests/utils.test.js`

**Steps:**
- [ ] Create test file for shared utilities
- [ ] Run: `node --test tests/utils.test.js`
- [ ] Verify: All tests pass

#### Task 17: Documentation update
**Files:**
- Modify: `Asisten-Pribadi/README.md` (create), `Asistent AI Telegram/README.md`

**Steps:**
- [ ] Create basic README for Asisten-Pribadi
- [ ] Update Stella README to reflect current architecture
- [ ] Verify: Both READMEs are accurate

#### Task 18: Final verification
**Files:** All modified files

**Steps:**
- [ ] Run `node --check` on all modified JS files
- [ ] Run existing tests in Stella: `npm test`
- [ ] Manual test: Start both bots, verify basic functionality
- [ ] Git commit all changes with descriptive messages

---

## Global Constraints

- **VERIFY BEFORE DELETE**: Every piece of code marked for deletion must be grep-verified as unused
- Do NOT add new features — only cleanup and fixes
- Do NOT change bot behavior or responses
- Do NOT modify ML/Knowledge/Reasoning engine logic
- Keep backward compatibility with existing `.env` files
- All changes must pass `node --check` syntax validation
- Commits should be small and focused per task
- **SECURITY FIRST**: Fix hardcoded credentials before any other cleanup
