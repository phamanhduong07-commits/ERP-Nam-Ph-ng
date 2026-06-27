"""merge_phoi_du_and_defect_phan_xuong

Revision ID: da1f6657a415
Revises: 197f6b82910c, zmh048
Create Date: 2026-06-27 19:24:33.148241

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da1f6657a415'
down_revision: Union[str, None] = ('197f6b82910c', 'zmh048')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
