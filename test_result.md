#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Add an in-app Admin Dashboard to the FitLux fitness app so the owner can manage influencer promo
  codes, view earnings / payouts, and see high-level metrics without using curl. Admin access is
  limited to the seeded admin account (admin@fitlux.com) and jamesbourke52@gmail.com (auto-promoted
  on server startup via ADMIN_EMAILS env var). Tests should cover all new admin endpoints.

backend:
  - task: "Email drip + transactional infrastructure (Resend)"
    implemented: true
    working: true
    file: "/app/backend/email_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
          agent: "main"
          comment: |
            New module /app/backend/email_service.py with:
              - Resend SDK send helper (async via asyncio.to_thread)
              - 4 drip templates (Day1/3/7/14) + Welcome + Payment receipt
              - drip_loop() background task spawned at app startup (~30 min interval)
              - email_log collection tracks every send (kind, status, error, sent_at)
              - signed unsubscribe token (sha256 of user_id + JWT_SECRET)
            New endpoints:
              - GET  /api/email/unsubscribe?u=<id>&t=<token> — public unsubscribe
              - GET  /api/admin/email-log — recent 500 events + counts by kind (admin only)
              - POST /api/admin/email-drip-now — manual sweep trigger (admin only)
            Hooks added in /api/auth/register and the Stripe checkout-status flow
            so welcome + payment-receipt emails fire automatically (non-blocking).
            RESEND_API_KEY env is intentionally empty so all sends are no-op until
            user provides the key. drip_loop logs "skipped" entries when not configured.
        -working: true
          agent: "testing"
          comment: |
            All 12 email-infrastructure test cases PASS via public REACT_APP_BACKEND_URL
            (https://fitbot-whatsapp.preview.emergentagent.com/api). RESEND_API_KEY
            is empty as expected — all sends no-op gracefully.
              1) POST /api/auth/register (emailtest_<rand>@example.com / Test1234!)
                 → 200 with token + user, no exception despite disabled email sending ✓
              2) GET /api/admin/email-log (admin) → 200 {log: [], totals_by_kind: {}} ✓
              3) POST /api/admin/email-drip-now (admin) → 200
                 {skipped: true, reason: "RESEND_API_KEY not set"} ✓
              4) POST /api/admin/email-drip-now (non-admin) → 403
                 {detail: "Admin only"} ✓
              5) GET /api/email/unsubscribe?u=fake&t=invalid → 400
                 {detail: "Invalid unsubscribe link"} ✓
              6) GET /api/email/unsubscribe (no params) → 422 ✓
              7) backend.err.log contains "email drip loop started" — drip background
                 task confirmed running ✓
              8) Admin smoke tests all 200:
                 /admin/metrics, /admin/promo-codes, /admin/influencers,
                 /admin/influencer-earnings ✓
            See /app/email_test.py for full repeatable suite. Admin login
            (admin@fitlux.com / Admin@12345) returned role=admin.

  - task: "Admin dashboard endpoints (metrics, promo CRUD, payout)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
          agent: "main"
          comment: |
            Added new admin-only routes:
              - GET /api/admin/metrics — aggregated stats (users, subs, revenue, promo totals,
                influencer pending/paid sums)
              - PATCH /api/admin/promo-codes/{code} — update active flag / discount / commission / name
              - DELETE /api/admin/promo-codes/{code} — remove a code
              - POST /api/admin/influencers/{id}/payout — move pending_eur → paid_eur, flip earnings
                to status=paid, set last_payout_at.
            Existing admin routes (POST/GET promo-codes, GET influencers, GET influencer-earnings)
            were preserved.
            Added ADMIN_EMAILS env var (comma-separated) and startup logic to promote matching
            existing users to role=admin. Seeded admin (admin@fitlux.com / Admin@12345) is untouched.
            Admin-only guard via require_admin(). Non-admin → 403.
        -working: true
          agent: "testing"
          comment: |
            All 16 admin/promo backend test cases PASS using public REACT_APP_BACKEND_URL
            (https://fitbot-whatsapp.preview.emergentagent.com/api). Verified flow end-to-end:
              1) Admin login (admin@fitlux.com / Admin@12345) → token, role=admin ✓
              2) GET /api/admin/metrics → 200 with all 9 expected keys
                 (total_users=6, active_subscriptions=1, total_revenue_usd=9.99 float,
                 paid_transactions, promo_codes_total/active, influencer_signups,
                 influencer_pending_eur, influencer_paid_eur) ✓
              3) POST /api/admin/promo-codes TEST10 → 200, returns promo_code + influencer
                 with id (auto-created) ✓
              4) GET /api/admin/promo-codes lists TEST10 ✓
              5) PATCH active=false → returned promo_code.active=False ✓
              6) PATCH active=true + discount_percent=15 → both updated ✓
              7) POST /api/subscription/promo/validate as authenticated non-admin user
                 → {valid: true, code: TEST10, discount_percent: 15} ✓
              8) GET /api/admin/influencers contains created influencer id ✓
              9) POST /api/admin/influencers/{id}/payout (no earnings) → 200
                 paid_amount_eur=0, no error ✓
             10) GET /api/admin/influencer-earnings → 200 with earnings array ✓
             11) DELETE /api/admin/promo-codes/TEST10 → {deleted: true} ✓
             12) GET /api/admin/promo-codes after delete → TEST10 absent ✓
             13) Authorization checks all correct:
                 - Non-admin user → GET /api/admin/metrics → 403 ✓
                 - No Authorization header → 401 ✓
                 - PATCH nonexistent code → 404 ✓
                 - Payout nonexistent influencer-id → 404 ✓
            See /app/backend_test.py for full repeatable suite.

frontend:
  - task: "Admin dashboard screen (/admin) with tabs"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
          agent: "main"
          comment: |
            New screen with 4 tabs: Overview (stat cards), Promo Codes (create modal, toggle
            active, delete), Influencers (payout action), Earnings (chronological list).
            Gated: non-admin users are auto-redirected to /(tabs). Profile tab now shows an
            "Admin dashboard" link only when user.role === "admin". index.tsx now routes admins
            directly to /admin on app load.

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
      message: |
        Please verify the new admin endpoints using the admin credentials from
        /app/memory/test_credentials.md (admin@fitlux.com / Admin@12345). Flow to cover:
          1) Login as admin → GET /api/admin/metrics returns all numeric fields.
          2) POST /api/admin/promo-codes to create a code (e.g. TEST10).
          3) GET /api/admin/promo-codes lists it.
          4) PATCH /api/admin/promo-codes/TEST10 with {"active": false} deactivates it.
          5) DELETE /api/admin/promo-codes/TEST10 removes it.
          6) GET /api/admin/influencers returns the auto-created influencer for step 2.
          7) POST /api/admin/influencers/{id}/payout works even when pending=0 (no error).
          8) Non-admin user (register a fresh one) is rejected with 403 on all admin routes.
        Do NOT test Stripe live checkouts (Stripe key is test mode via emergentintegrations).
    -agent: "testing"
      message: |
        Backend admin dashboard endpoints fully verified — 16/16 tests PASS via public
        REACT_APP_BACKEND_URL. All requested flow steps (1–12) and all four
        authorization checks (non-admin 403, no-auth 401, missing-code 404, missing-influencer 404)
        succeed. Promo lifecycle (create → list → patch active=false → patch active=true+disc=15
        → validate by user → delete → list) works end-to-end. Influencer auto-creation, payout
        with zero pending balance, and earnings listing all return 200. /admin/metrics returns
        all 9 expected keys with correct types (total_revenue_usd is a float). No backend issues
        observed in supervisor logs. Test suite saved at /app/backend_test.py for re-runs.
    -agent: "testing"
      message: |
        Email drip + transactional infrastructure (Resend) fully verified — 12/12 tests
        PASS via public REACT_APP_BACKEND_URL. RESEND_API_KEY is empty by design, so all
        sends correctly no-op.
          - POST /api/auth/register for fresh user (emailtest_<rand>@example.com /
            Test1234!) → 200 with token + user; no exception despite disabled email.
          - GET /api/admin/email-log (admin) → 200 {log: [], totals_by_kind: {}}.
          - POST /api/admin/email-drip-now (admin) → 200
            {skipped: true, reason: "RESEND_API_KEY not set"}.
          - POST /api/admin/email-drip-now (non-admin) → 403 {"detail":"Admin only"}.
          - GET /api/email/unsubscribe?u=fake&t=invalid → 400
            {"detail":"Invalid unsubscribe link"}.
          - GET /api/email/unsubscribe (no query params) → 422.
          - Backend log contains "email drip loop started" (background task running,
            confirmed in /var/log/supervisor/backend.err.log).
          - Admin smoke endpoints: GET /api/admin/metrics, /admin/promo-codes,
            /admin/influencers, /admin/influencer-earnings all 200.
        Also observed /app/backend/server.py logs "[email:welcome] skipped — RESEND_API_KEY
        not set" on the new-register call, confirming the non-blocking hook path is wired
        correctly. Suite at /app/email_test.py. No blockers; ready to merge.