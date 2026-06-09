from app.models.master import (  # noqa: F401
    PhanXuong, Warehouse, MaterialGroup, Supplier, Customer,
    PaperMaterial, OtherMaterial, TieuChuanKyThuat, CauTrucThongDung, Product, PhapNhan,
    BankAccount,
    LoXe, TaiXe, Xe, DonGiaVanChuyen,
    DonViTinh, ViTri, TinhThanh, PhuongXa,
)
from app.models.cd2 import (  # noqa: F401
    MayIn, PhieuIn,
    Machine, ProductionLog, PrinterUser,
    MayScan, ScanLog, MaySauIn, ShiftCa, ShiftConfig,
)

# Import all remaining models so Base.metadata has every table registered
# Required for conftest.py to resolve FK references correctly in tests
import app.models.auth  # noqa: F401
import app.models.accounting  # noqa: F401
import app.models.addon_rate  # noqa: F401
import app.models.billing  # noqa: F401
import app.models.bom  # noqa: F401
import app.models.ccdc  # noqa: F401
import app.models.crm  # noqa: F401
import app.models.fixed_asset  # noqa: F401
import app.models.hr  # noqa: F401
import app.models.import_log  # noqa: F401
import app.models.indirect_cost  # noqa: F401
import app.models.inventory  # noqa: F401
import app.models.maintenance  # noqa: F401
import app.models.phieu_nhap_phoi_song  # noqa: F401
import app.models.phieu_xuat_phoi  # noqa: F401
import app.models.production  # noqa: F401
import app.models.production_plan  # noqa: F401
import app.models.purchase  # noqa: F401
import app.models.purchase_requisition  # noqa: F401
import app.models.quality  # noqa: F401
import app.models.sales  # noqa: F401
import app.models.system  # noqa: F401
import app.models.tai_khoan_ngam_dinh  # noqa: F401
import app.models.warehouse_doc  # noqa: F401
import app.models.defect_records  # noqa: F401
import app.models.yeu_cau_giao_hang  # noqa: F401
import app.models.media  # noqa: F401
import app.models.layer_allocation_coefficient  # noqa: F401
