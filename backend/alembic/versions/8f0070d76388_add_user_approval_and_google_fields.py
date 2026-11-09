"""add user approval and google fields

Revision ID: 8f0070d76388
Revises: 7fa53ddbbdc6
Create Date: 2026-10-21 18:11:17.677493

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f0070d76388'
down_revision: Union[str, None] = '7fa53ddbbdc6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
