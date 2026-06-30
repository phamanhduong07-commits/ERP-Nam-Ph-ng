from datetime import date
from sqlalchemy.orm import Session
from app.models.production_plan import ProductionPlan

QUEUE_POOL_SO = "KHSX-POOL"


def get_or_create_pool_plan(db: Session) -> ProductionPlan:
    plan = db.query(ProductionPlan).filter(ProductionPlan.so_ke_hoach == QUEUE_POOL_SO).first()
    if not plan:
        plan = ProductionPlan(
            so_ke_hoach=QUEUE_POOL_SO,
            ngay_ke_hoach=date.today(),
            ghi_chu="Hàng chờ — LSX gỡ khỏi kế hoạch",
            trang_thai="nhap",
        )
        db.add(plan)
        db.flush()
    return plan
