import sqlite3
import json

DB_PATH = r'C:\Users\ADVAN\.local\share\mimocode\mimocode.db'

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Check all sessions for this project
print("=== ALL SESSIONS FOR PROJECT ===")
c.execute("""
    SELECT id, title, directory, time_created, time_updated
    FROM session
    WHERE project_id = '7f36fcf1-1e13-4d13-8600-fc5fbe0872a4'
    ORDER BY time_created DESC
""")
for row in c.fetchall():
    sid, title, directory, tc, tu = row
    print(f"  {sid} | title={title} | dir={directory}")

# Check messages for the Auto Dream session (current)
SESSION_ID = 'ses_0bd9d2e90ffebnLsSTofR7CiKP'
print(f"\n=== SESSION {SESSION_ID} - MESSAGES ===")
c.execute("""
    SELECT m.id, m.agent_id, m.time_created, m.data
    FROM message m
    WHERE m.session_id = ?
    ORDER BY m.time_created
""", (SESSION_ID,))
messages = c.fetchall()
print(f"Total messages: {len(messages)}")
for mid, agent_id, tc, mdata in messages:
    md = json.loads(mdata) if mdata else {}
    role = md.get('role', 'N/A')
    print(f"\n--- Message {mid} | agent={agent_id} | role={role} | time={tc} ---")
    
    c.execute("""
        SELECT id, data FROM part
        WHERE message_id = ?
        ORDER BY time_created
    """, (mid,))
    parts = c.fetchall()
    for pid, pdata in parts:
        pd = json.loads(pdata) if pdata else {}
        ptype = pd.get('type', 'N/A')
        if ptype == 'text':
            text = pd.get('text', '')[:500]
            print(f"  [text] {text}")
        elif ptype == 'tool':
            tool = pd.get('tool', 'N/A')
            state = pd.get('state', {})
            inp = str(state.get('input', ''))[:200]
            out = str(state.get('output', ''))[:200]
            print(f"  [tool] {tool}")
            print(f"    input: {inp}")
            print(f"    output: {out}")
        elif ptype == 'step-start':
            print(f"  [step-start]")
        elif ptype == 'step-finish':
            tokens = pd.get('tokens', 'N/A')
            print(f"  [step-finish] tokens={tokens}")
        else:
            print(f"  [{ptype}] {str(pd)[:200]}")

# Check actor_registry for subagents
print(f"\n=== ACTOR REGISTRY ===")
c.execute("PRAGMA table_info(actor_registry)")
cols = [col[1] for col in c.fetchall()]
print(f"  Columns: {cols}")
c.execute("SELECT * FROM actor_registry ORDER BY rowid DESC LIMIT 10")
for row in c.fetchall():
    print(f"  {row}")

# Check actor_registry for this project's sessions
c.execute("""
    SELECT ar.*
    FROM actor_registry ar
    WHERE ar.session_id IN (
        SELECT id FROM session WHERE project_id = '7f36fcf1-1e13-4d13-8600-fc5fbe0872a4'
    )
""")
actors = c.fetchall()
print(f"\n=== ACTORS FOR THIS PROJECT ({len(actors)}) ===")
for row in actors:
    print(f"  {row}")

# Check workflow_run table
print(f"\n=== WORKFLOW RUNS ===")
c.execute("PRAGMA table_info(workflow_run)")
cols = [col[1] for col in c.fetchall()]
print(f"  Columns: {cols}")
c.execute("SELECT * FROM workflow_run WHERE session_id IN (SELECT id FROM session WHERE project_id = '7f36fcf1-1e13-4d13-8600-fc5fbe0872a4') ORDER BY rowid DESC LIMIT 5")
for row in c.fetchall():
    print(f"  {row}")

conn.close()
