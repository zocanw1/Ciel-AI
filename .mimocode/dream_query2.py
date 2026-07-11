import sqlite3
import json

DB_PATH = r'C:\Users\ADVAN\.local\share\mimocode\mimocode.db'

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Get the session that produced the checkpoint (Analisis Project)
SESSION_ID = 'ses_0bd9d2ecfffePN9fLFuvlACh3n'

print(f"=== SESSION {SESSION_ID} - ALL MESSAGES ===")
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
    
    # Get parts for this message
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
            inp = str(state.get('input', ''))[:300]
            out = str(state.get('output', ''))[:300]
            print(f"  [tool] {tool}")
            print(f"    input: {inp}")
            print(f"    output: {out}")
        elif ptype == 'step-start':
            print(f"  [step-start]")
        elif ptype == 'step-finish':
            tokens = pd.get('tokens', 'N/A')
            print(f"  [step-finish] tokens={tokens}")
        else:
            print(f"  [{ptype}] {str(pd)[:300]}")

# Also check tasks
print(f"\n=== TASKS FOR SESSION {SESSION_ID} ===")
c.execute("""
    SELECT id, status, summary, created_at FROM task
    WHERE session_id = ?
    ORDER BY created_at
""", (SESSION_ID,))
tasks = c.fetchall()
for tid, status, summary, ca in tasks:
    print(f"  {tid} | status={status} | summary={summary} | created={ca}")

# Task events
print(f"\n=== TASK EVENTS FOR SESSION {SESSION_ID} ===")
c.execute("""
    SELECT te.task_id, te.kind, te.summary, te.at
    FROM task_event te
    WHERE te.session_id = ?
    ORDER BY te.at
""", (SESSION_ID,))
events = c.fetchall()
for tid, kind, summary, at in events:
    print(f"  {tid} | kind={kind} | summary={summary} | at={at}")

conn.close()
