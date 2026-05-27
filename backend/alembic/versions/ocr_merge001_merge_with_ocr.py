"""merge merge002 and ocr001 into single head

Revision ID: ocr_merge001
Revises: merge002, ocr001
Create Date: 2026-05-25
"""
from typing import Sequence, Union

revision: str = 'ocr_merge001'
down_revision: Union[str, None] = ('merge002', 'ocr001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
