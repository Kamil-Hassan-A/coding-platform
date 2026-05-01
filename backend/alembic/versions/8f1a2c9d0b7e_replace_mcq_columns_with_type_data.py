"""Replace MCQ columns with type_data

Revision ID: 8f1a2c9d0b7e
Revises: 4b3b11747430
Create Date: 2026-05-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f1a2c9d0b7e"
down_revision: Union[str, None] = "4b3b11747430"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("problems", sa.Column("type_data", sa.JSON(), nullable=True))
    op.execute(
        """
        UPDATE problems
        SET type_data = json_build_object(
            'options', options,
            'correct_option', correct_option
        )
        WHERE question_type = 'mcq'
        AND (options IS NOT NULL OR correct_option IS NOT NULL)
        """
    )
    op.drop_column("problems", "options")
    op.drop_column("problems", "correct_option")


def downgrade() -> None:
    op.add_column("problems", sa.Column("options", sa.JSON(), nullable=True))
    op.add_column("problems", sa.Column("correct_option", sa.String(length=1), nullable=True))
    op.execute(
        """
        UPDATE problems
        SET options = (type_data->>'options')::json,
            correct_option = type_data->>'correct_option'
        WHERE question_type = 'mcq' AND type_data IS NOT NULL
        """
    )
    op.drop_column("problems", "type_data")
