import sqlite3
import json

DB_PATH = r'C:\Users\ADVAN\.local\share\mimocode\mimocode.db'

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# Session schema
print("=== SESSION SCHEMA ===")
c.execute("PRAGMA table_info(session)")
for col in c.fetchall():
    print(f"  {col}")

print("\n=== SESSION SAMPLE ===")
c.execute("SELECT * FROM session ORDER BY rowid DESC LIMIT 3")
cols = [d[0] for d in c.description]
print(f"  Columns: {cols}")
for row in c.fetchall():
    print(f"  {row}")

# Part schema
print("\n=== PART SCHEMA ===")
c.execute("PRAGMA table_info(part)")
for col in c.fetchall():
    print(f"  {col}")

# Message schema
print("\n=== MESSAGE SCHEMA ===")
c.execute("PRAGMA table_info(message)")
for col in c.fetchall():
    print(f"  {col}")

# Task schema
print("\n=== TASK SCHEMA ===")
c.execute("PRAGMA table_info(task)")
for col in c.fetchall():
    print(f"  {col}")

# Task event schema
print("\n=== TASK_EVENT SCHEMA ===")
c.execute("PRAGMA table_info(task_event)")
for col in c.fetchall():
    print(f"  {col}")

# Project schema
print("\n=== PROJECT SCHEMA ===")
c.execute("PRAGMA table_info(project)")
for col in c.fetchall():
    print(f"  {col}")

# Project data
print("\n=== PROJECTS ===")
c.execute("SELECT * FROM project")
cols = [d[0] for d in c.description]
print(f"  Columns: {cols}")
for row in c.fetchall():
    print(f"  {row}")

conn.close()
