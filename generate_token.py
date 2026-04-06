from backend.security import create_access_token
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

token, _ = create_access_token(
    subject='b150f408-9876-454b-ba44-6317179698d6',
    extra_claims={
        'role': 'candidate',
        'name': 'Test Candidate',
        'email': 'candidate@example.com',
    }
)
print('VALID_TOKEN=' + token)
