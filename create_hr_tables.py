import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import engine, Base
from app.models.hr import Department, Position, Employee, LaborContract, AttendanceLog, LeaveRequest, PayrollConfig

def create_hr_tables():
    print("Refreshing HR tables...")
    # Base.metadata.drop_all(bind=engine, tables=[
    #     PayrollConfig.__table__,
    #     LeaveRequest.__table__,
    #     AttendanceLog.__table__,
    #     LaborContract.__table__,
    #     Employee.__table__,
    #     Position.__table__,
    #     Department.__table__
    # ])
    
    # We use raw SQL to add columns if they don't exist to avoid data loss
    # Or just recreate since we are in early dev
    Base.metadata.create_all(bind=engine)
    
    # Adding new columns via raw SQL for safety
    with engine.connect() as conn:
        try:
            conn.execute("ALTER TABLE hr_employees ADD COLUMN he_so_ca_nhan NUMERIC(4,2) DEFAULT 1.5")
            print("Added he_so_ca_nhan to hr_employees")
        except: pass
        
        try:
            conn.execute("ALTER TABLE hr_payroll_configs RENAME COLUMN ma_cau_hinh TO ma_hang")
            conn.execute("ALTER TABLE hr_payroll_configs RENAME COLUMN ten_cau_hinh TO ten_hang")
            conn.execute("ALTER TABLE hr_payroll_configs ADD COLUMN phan_tram_luong_sp NUMERIC(5,2) DEFAULT 100")
            conn.execute("ALTER TABLE hr_payroll_configs RENAME COLUMN gia_tri TO don_gia")
            print("Updated hr_payroll_configs columns")
        except: pass
        
    print("HR tables updated successfully.")

if __name__ == "__main__":
    create_hr_tables()
