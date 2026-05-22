"""
Script cập nhật do_buc_tieu_chuan trong bảng paper_materials
Nguồn: KETQUATONGHOPGIAYCUON — chỉ import MANVL có TC cố định (1 giá trị nhất quán)

Chạy: python backend/update_paper_tc.py [--dry-run]
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text

# TC bục cố định — extracted từ KETQUATONGHOPGIAYCUON (59 MANVL)
# Format key: MANVL (4 phần), value: do_buc_tieu_chuan (kgf/cm²)
BUC_TC_CO_DINH = {
    "BC.N.BC.120": 2.9,
    "BC.N.BC.140": 3.28,
    "BKH.N.NBKH.125": 3.0,
    "BKH.N.NBKH.140": 3.4,
    "CLO.N.NECLO.145": 3.9,
    "CLO.N.NECLO.150": 3.6,
    "CLO.N.VCLO.145": 3.9,
    "CLO.NL.NLCLO.120": 2.4,
    "CLO.NL.NLCLO.145": 3.5,
    "CLO.NL.NLCLO.170": 4.6,
    "CLO.V.VACLO.185": 5.7,
    "CLO.X.XCLO.90": 2.0,
    "DOT.V.VDOT.150": 3.4,
    "DOT.XK.XDOT.100": 2.4,
    "DOT.XK.XDOT.110": 2.6,
    "DOT.XK.XDOT.115": 2.7,
    "DOT.XK.XDOT.120": 2.8,
    "DOT.XK.XDOT.125": 2.9,
    "DOT.XK.XDOT.140": 3.2,
    "DOT.XK.XDOT.150": 3.5,
    "DOT.XK.XDOT.90": 2.2,
    "DOT.XK.XDOT.95": 2.3,
    "GKAV.V.VKAV.230": 8.1,
    "GSA.T.TGSA.150": 4.28,
    "GVP.T.TGVP.140": 4.28,
    "GVP.T.TGVP.150": 4.28,
    "GVP.V.VGVP.180": 4.9,
    "GVP.X.XGVP.180": 5.2,
    "GVP.X.XGVP.220": 4.7,
    "KOA.NL.NLKOA.200": 5.3,
    "KOA.NL.NLKOA.225": 5.96,
    "KOA.NL.NLKOA.90": 2.3,
    "KOA.X.XKOA.100": 2.4,
    "KRV.VA.VAKRV.230": 7.1,
    "KRV.X.XKRV.180": 4.1,
    "LAN.N.NLAN.125": 3.06,
    "LAN.N.NLAN.150": 3.6,
    "LAN.X.XLAN.110": 2.6,
    "LAN.X.XLAN.120": 2.8,
    "LAN.X.XLAN.125": 2.9,
    "LM.N.NBLM.200": 5.51,
    "NSGO.N.NSGO.150": 3.6,
    "NTHN.N.NTHN.120": 2.94,
    "NTHN.N.NTHN.140": 3.75,
    "PDT.X.XPDT.120": 2.9,
    "SGO.N.NSGO.125": 2.94,
    "TNC.XK.XTNC.110": 2.6,
    "TNC.XK.XTNC.125": 2.9,
    "TNC.XK.XTNC.185": 4.3,
    "TND.V.VTND.150": 4.1,
    "TPA.N.TPA.140": 3.75,
    "TPA.N.TPA.150": 3.67,
    "TPA.T.TTBA.140": 4.28,
    "TPA.T.TTPA.140": 4.28,
    "TPA.X.TPA.140": 3.2,
    "VSGO.V.VSGO.150": 4.1,
    "XPH.X.XPH.115": 2.7,
    "XPH.X.XPH.90": 2.0,
    "XSGO.X.XSGO.125": 2.9,
}


def run(dry_run: bool = False):
    from app.config import settings
    engine = create_engine(settings.DATABASE_URL)

    total_matched = 0
    total_updated = 0
    not_found = []

    with engine.connect() as conn:
        for manvl, tc_buc in sorted(BUC_TC_CO_DINH.items()):
            pattern = f"{manvl}.%"
            result = conn.execute(
                text("SELECT id, ma_chinh, do_buc_tieu_chuan FROM paper_materials WHERE ma_chinh LIKE :p"),
                {"p": pattern},
            ).fetchall()

            if not result:
                not_found.append(manvl)
                continue

            total_matched += len(result)
            print(f"  {manvl} -> {tc_buc}  [{len(result)} records]")
            for row in result:
                old = row[2]
                if not dry_run:
                    conn.execute(
                        text("UPDATE paper_materials SET do_buc_tieu_chuan = :v WHERE id = :id"),
                        {"v": tc_buc, "id": row[0]},
                    )
                total_updated += len(result)

        if not dry_run:
            conn.commit()

    print()
    print(f"MANVL co dinh trong Excel : {len(BUC_TC_CO_DINH)}")
    print(f"Records khop trong DB     : {total_matched}")
    print(f"Records duoc update       : {total_updated if not dry_run else 0} (dry_run={dry_run})")
    if not_found:
        print(f"MANVL khong tim thay ({len(not_found)}):")
        for m in not_found:
            print(f"  - {m}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    mode = "DRY RUN" if dry_run else "THUC SU UPDATE"
    print(f"=== update_paper_tc.py [{mode}] ===")
    run(dry_run=dry_run)
    print("DONE")
