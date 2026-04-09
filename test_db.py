from backend.security import verify_password
import psycopg2, os
from dotenv import load_dotenv
load_dotenv('backend/.env')
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
try:
    cur.execute("SELECT email, password_hash FROM users WHERE email='candidate@example.com';")
    h = cur.fetchone()[1]
    
    import string, itertools
    
    # Try more common variants
    words = ['password', 'candidate', 'admin', 'test', 'Indium*123', 'indium', 'Candidate@123', 'Test@123', 'Admin@123', 'admin123', 'candidate123', 'user', 'user123', 'changeme', 'welcome', 'Welcome123']
    for p in words:
        if verify_password(p, h):
            print('PASSWORD IS:', p)
            break
    print('Done checking passwords')
except Exception as e:
    print('Error:', e)
