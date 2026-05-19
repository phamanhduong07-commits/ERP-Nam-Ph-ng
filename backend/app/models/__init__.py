from app.models.auth import Role, User, AuditLog
from app.models.master import (
    PhanXuong, Warehouse, MaterialGroup, Supplier, Customer,
    PaperMaterial, OtherMaterial, CauTrucThongDung, Product, PhapNhan,
    BankAccount,
    # Thêm: các model trong master.py trước đây không được import → Alembic không track
    LoXe, TaiXe, Xe, DonGiaVanChuyen,
    DonViTinh, ViTri, TinhThanh, PhuongXa,
)
from app.models.ccdc import NhomCCDC, CongCuDungCu, PhieuXuatCCDC, PhieuXuatCCDCItem
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, PurchaseReturn, PurchaseReturnItem
from app.models.yeu_cau_giao_hang import YeuCauGiaoHang, YeuCauGiaoHangItem
from app.models.purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem
from app.models.warehouse_doc import (
    GoodsReceipt, GoodsReceiptItem,
    MaterialIssue, MaterialIssueItem,
    ProductionOutput,
    DeliveryOrder, DeliveryOrderItem,
    PhieuChuyenKho, PhieuChuyenKhoItem,
    StockAdjustment, StockAdjustmentItem,
)
from app.models.sales import SalesOrder, SalesOrderItem, Quote, QuoteItem
from app.models.inventory import InventoryBalance, InventoryTransaction, PaperRoll
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.bom import ProductionBOM, ProductionBOMItem
from app.models.production_plan import ProductionPlan, ProductionPlanLine
from app.models.indirect_cost import IndirectCostItem
from app.models.addon_rate import AddonRate
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.phieu_xuat_phoi import PhieuXuatPhoi, PhieuXuatPhoiItem
from app.models.cd2 import (
    MayIn, PhieuIn,
    # Thêm: các model cd2 trước đây không được import → Alembic không track
    Machine, ProductionLog, PrinterUser,
    MayScan, ScanLog, MaySauIn, ShiftCa, ShiftConfig,
)
from app.models.billing import SalesInvoice
from app.models.accounting import (
    ChartOfAccounts, JournalEntry, JournalEntryLine,
    PurchaseInvoice, CashReceipt, CashPayment,
    DebtLedgerEntry, OpeningBalance, CustomerRefundVoucher,
)
from app.models.hr import (
    Vehicle, Department, Position, Employee, LaborContract, AttendanceLog,
    LeaveRequest, EmployeeHistory, EmployeeDocument, FuelLog,
    PayrollConfig, PayrollRun, RewardDiscipline,
)
from app.models.import_log import ImportLog
from app.models.system import SystemSetting, PrintTemplate, AgentSession
from app.models.quality import QCSheet, QCDefect
from app.models.maintenance import MaintenanceMachine, MaintenanceSchedule, MaintenanceLog
from app.models.crm import CustomerInteraction
