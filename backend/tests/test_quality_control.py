"""
Sprint 6 — Test quality control module
Covers: QCSheet (create, update ket_qua, stats, invalid loai).
"""
from datetime import date


def _qc_payload(**kwargs):
    return {
        "loai": "nhan_hang",
        "ngay": date.today().isoformat(),
        **kwargs,
    }


def test_create_qc_sheet_returns_so_phieu(client, db_session):
    """Tạo phiếu QC hợp lệ → 201, so_phieu bắt đầu QC-, ket_qua=None."""
    res = client.post("/api/qc-sheets", json=_qc_payload(nguoi_kiem_tra="Nguyễn Văn A"))

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["so_phieu"].startswith("QC-")
    assert data["ket_qua"] is None
    assert data["loai"] == "nhan_hang"


def test_update_ket_qua_dat(client, db_session):
    """Cập nhật kết quả 'dat' → phiếu QC phản ánh đúng."""
    create_res = client.post("/api/qc-sheets", json=_qc_payload())
    assert create_res.status_code == 201
    sheet_id = create_res.json()["id"]

    update_res = client.patch(f"/api/qc-sheets/{sheet_id}/ket-qua", json={
        "ket_qua": "dat",
        "nguoi_kiem_tra": "Trần Thị B",
    })
    assert update_res.status_code == 200, update_res.text
    data = update_res.json()
    assert data["ket_qua"] == "dat"
    assert data["nguoi_kiem_tra"] == "Trần Thị B"


def test_update_ket_qua_khong_dat_with_defects(client, db_session):
    """Cập nhật kết quả 'khong_dat' + ghi lỗi → defects lưu đúng."""
    create_res = client.post("/api/qc-sheets", json=_qc_payload(loai="san_xuat"))
    sheet_id = create_res.json()["id"]

    update_res = client.patch(f"/api/qc-sheets/{sheet_id}/ket-qua", json={
        "ket_qua": "khong_dat",
        "defects": [
            {"loai_loi": "Rách bề mặt", "so_luong_loi": 5},
            {"loai_loi": "Lệch kích thước", "so_luong_loi": 2},
        ],
    })
    assert update_res.status_code == 200, update_res.text
    data = update_res.json()
    assert data["ket_qua"] == "khong_dat"
    assert len(data["defects"]) == 2
    assert data["defects"][0]["so_luong_loi"] == 5


def test_invalid_loai_returns_422(client, db_session):
    """loai không hợp lệ → 422."""
    res = client.post("/api/qc-sheets", json=_qc_payload(loai="khong_co"))
    assert res.status_code == 422


def test_invalid_ket_qua_returns_422(client, db_session):
    """ket_qua không hợp lệ → 422."""
    create_res = client.post("/api/qc-sheets", json=_qc_payload())
    sheet_id = create_res.json()["id"]

    res = client.patch(f"/api/qc-sheets/{sheet_id}/ket-qua", json={"ket_qua": "unknown"})
    assert res.status_code == 422


def test_stats_returns_correct_counts(client, db_session):
    """Stats API: tổng, dat, khong_dat đúng với dữ liệu đã tạo."""
    client.post("/api/qc-sheets", json=_qc_payload(loai="nhan_hang"))
    client.post("/api/qc-sheets", json=_qc_payload(loai="nhan_hang"))
    client.post("/api/qc-sheets", json=_qc_payload(loai="san_xuat"))

    # Cập nhật 1 phiếu đầu = dat
    sheets = client.get("/api/qc-sheets").json()
    sheet_id = sheets[-1]["id"]
    client.patch(f"/api/qc-sheets/{sheet_id}/ket-qua", json={"ket_qua": "dat"})

    res = client.get("/api/qc-sheets/stats")
    assert res.status_code == 200, res.text
    stats = res.json()
    assert stats["tong"] >= 3
    assert stats["dat"] >= 1
    assert "ty_le_dat_pct" in stats


def test_get_qc_sheet_by_id(client, db_session):
    """GET /qc-sheets/{id} → trả đúng phiếu."""
    create_res = client.post("/api/qc-sheets", json=_qc_payload(ghi_chu="Test ghi chú"))
    sheet_id = create_res.json()["id"]

    get_res = client.get(f"/api/qc-sheets/{sheet_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == sheet_id
    assert get_res.json()["ghi_chu"] == "Test ghi chú"


def test_get_nonexistent_qc_sheet_returns_404(client, db_session):
    """GET /qc-sheets/999999 → 404."""
    res = client.get("/api/qc-sheets/999999")
    assert res.status_code == 404
