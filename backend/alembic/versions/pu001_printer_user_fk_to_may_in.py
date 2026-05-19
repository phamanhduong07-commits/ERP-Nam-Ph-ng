"""printer_user.machine_id FK → may_in instead of machines

Revision ID: pu001_printer_user_fk_to_may_in
Revises: ngung003_phieu_in_state_log
Create Date: 2026-05-18
"""
from alembic import op

revision = 'pu001_printer_user_fk_to_may_in'
down_revision = 'ngung003_phieu_in_state_log'
branch_labels = None
depends_on = None


def upgrade():
    # Clear machine_id values — they pointed to the old `machines` table.
    # Admins must re-assign machines via ConfigPage after this migration.
    op.execute("UPDATE printer_user SET machine_id = NULL")

    with op.batch_alter_table('printer_user') as batch_op:
        # Drop old FK to machines
        try:
            batch_op.drop_constraint('printer_user_machine_id_fkey', type_='foreignkey')
        except Exception:
            pass  # constraint may have a different name on some setups
        # Add new FK to may_in
        batch_op.create_foreign_key(
            'printer_user_machine_id_may_in_fkey',
            'may_in', ['machine_id'], ['id'],
        )


def downgrade():
    op.execute("UPDATE printer_user SET machine_id = NULL")

    with op.batch_alter_table('printer_user') as batch_op:
        try:
            batch_op.drop_constraint('printer_user_machine_id_may_in_fkey', type_='foreignkey')
        except Exception:
            pass
        batch_op.create_foreign_key(
            'printer_user_machine_id_fkey',
            'machines', ['machine_id'], ['id'],
        )
