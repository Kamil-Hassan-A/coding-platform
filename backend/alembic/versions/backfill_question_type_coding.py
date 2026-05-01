"""backfill question_type coding

Revision ID: 95a573d0a885
Revises: 8f1a2c9d0b7e
Create Date: 2026-05-01
"""
from alembic import op

revision = '95a573d0a885'
down_revision = '8f1a2c9d0b7e'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute(
        "UPDATE problems SET question_type = 'coding' WHERE question_type IS NULL"
    )

def downgrade() -> None:
    op.execute(
        "UPDATE problems SET question_type = NULL WHERE question_type = 'coding'"
    )
