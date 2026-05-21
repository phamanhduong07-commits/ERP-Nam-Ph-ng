"""
Pytest cho GPS logic cốt lõi:
  - _normalize_plate      (3 cases)
  - _parse_gps_time       (5 cases)
  - _match_fuel_log       (5 cases)
  - _check_drain_realtime (6 cases)
"""
import os
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_gps.db")
os.environ.setdefault("SECRET_KEY", "test-secret")

import pytest
import asyncio
from datetime import datetime, timedelta, timezone, date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.routers.gps import (
    _normalize_plate,
    _parse_gps_time,
    _match_fuel_log,
    _check_drain_realtime,
    DRAIN_THRESHOLD,
    DRAIN_ALERT_COOLDOWN,
    to_vn,
)
import app.routers.gps as gps_module

VN = timezone(timedelta(hours=7))
UTC = timezone.utc


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def vn_dt(year, month, day, hour, minute=0, second=0) -> datetime:
    """Tạo datetime VN timezone."""
    return datetime(year, month, day, hour, minute, second, tzinfo=VN)


def utc_dt(year, month, day, hour, minute=0, second=0) -> datetime:
    return datetime(year, month, day, hour, minute, second, tzinfo=UTC)


def make_fuel_log(created_at: datetime):
    """Tạo FuelLog mock với created_at cho _match_fuel_log."""
    fl = SimpleNamespace()
    fl.created_at = created_at
    fl.so_lit_dau = 50.0
    return fl


def make_vehicle(plate: str, fuel: float, is_stop: bool = True,
                 time_update: str | None = None, address: str | None = None) -> dict:
    return {
        "plate": plate,
        "fuel_pct": fuel,
        "is_stop": is_stop,
        "time_update": time_update,
        "address": address,
        "km_today": 0,
        "km_total": 0,
        "speed": 0,
    }


@pytest.fixture(autouse=True)
def reset_module_state():
    """Reset in-memory dicts trước mỗi test tránh state leak."""
    gps_module._prev_snap.clear()
    gps_module._drain_alert_cooldown.clear()
    gps_module._xe_plate_cache.clear()
    yield
    gps_module._prev_snap.clear()
    gps_module._drain_alert_cooldown.clear()
    gps_module._xe_plate_cache.clear()


# ---------------------------------------------------------------------------
# Nhóm 1: _normalize_plate
# ---------------------------------------------------------------------------

class TestNormalizePlate:
    def test_strips_hyphen(self):
        assert _normalize_plate("50H-344") == "50H344"

    def test_strips_space(self):
        assert _normalize_plate("51G 99999") == "51G99999"

    def test_uppercases(self):
        assert _normalize_plate("51g12345") == "51G12345"


# ---------------------------------------------------------------------------
# Nhóm 2: _parse_gps_time
# ---------------------------------------------------------------------------

class TestParseGpsTime:
    def test_format_slash_ymdhms(self):
        # GPS Bình Minh primary format — VN 08:00 = UTC 01:00
        result = _parse_gps_time("2026/05/21 08:00:00")
        assert result == datetime(2026, 5, 21, 1, 0, 0)

    def test_format_dash_ymdhms(self):
        result = _parse_gps_time("2026-05-21 14:30:00")
        assert result == datetime(2026, 5, 21, 7, 30, 0)

    def test_format_dmy(self):
        result = _parse_gps_time("21/05/2026 23:59:59")
        assert result == datetime(2026, 5, 21, 16, 59, 59)

    def test_none_input(self):
        assert _parse_gps_time(None) is None

    def test_garbage_string(self):
        assert _parse_gps_time("not-a-date") is None


# ---------------------------------------------------------------------------
# Nhóm 3: _match_fuel_log
# ---------------------------------------------------------------------------

class TestMatchFuelLog:
    def test_single_log_within_window(self):
        """FuelLog duy nhất trong ±2h → trả về (0, fl)."""
        spike_ts = vn_dt(2026, 5, 21, 10, 0)
        fl = make_fuel_log(vn_dt(2026, 5, 21, 10, 30))  # 30 phút sau spike
        result = _match_fuel_log(spike_ts, [fl], set())
        assert result == (0, fl)

    def test_picks_nearest_of_two(self):
        """2 FuelLog — spike gần log thứ 2 hơn → trả về (1, fl2)."""
        spike_ts = vn_dt(2026, 5, 21, 14, 0)
        fl1 = make_fuel_log(vn_dt(2026, 5, 21, 10, 0))  # cách 4h — ngoài window
        fl2 = make_fuel_log(vn_dt(2026, 5, 21, 13, 30))  # cách 30 phút
        result = _match_fuel_log(spike_ts, [fl1, fl2], set())
        assert result is not None
        assert result[0] == 1

    def test_beyond_2h_returns_none(self):
        """FuelLog duy nhất cách >2h → None."""
        spike_ts = vn_dt(2026, 5, 21, 10, 0)
        fl = make_fuel_log(vn_dt(2026, 5, 21, 13, 1))  # 3h1m sau
        result = _match_fuel_log(spike_ts, [fl], set())
        assert result is None

    def test_already_matched_skipped(self):
        """Index 0 đã matched → bỏ qua, trả về (1, fl2)."""
        spike_ts = vn_dt(2026, 5, 21, 10, 0)
        fl1 = make_fuel_log(vn_dt(2026, 5, 21, 10, 5))   # gần nhất nhưng đã matched
        fl2 = make_fuel_log(vn_dt(2026, 5, 21, 10, 45))  # thứ 2
        result = _match_fuel_log(spike_ts, [fl1, fl2], already_matched={0})
        assert result is not None
        assert result[0] == 1

    def test_empty_list_returns_none(self):
        spike_ts = vn_dt(2026, 5, 21, 10, 0)
        assert _match_fuel_log(spike_ts, [], set()) is None


# ---------------------------------------------------------------------------
# Nhóm 4: _check_drain_realtime
# ---------------------------------------------------------------------------

def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class TestCheckDrainRealtime:
    """_check_drain_realtime là async — dùng run() helper."""

    def _make_db(self):
        db = MagicMock()
        db.add = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        return db

    def test_first_poll_no_alert(self):
        """Poll đầu tiên (_prev_snap rỗng) → không alert."""
        db = self._make_db()
        vehicles = [make_vehicle("51G12345", fuel=100.0, is_stop=True)]

        with patch("app.routers.gps.sio") as mock_sio:
            mock_sio.emit = AsyncMock()
            run(_check_drain_realtime(vehicles, db))
            mock_sio.emit.assert_not_called()
            db.add.assert_not_called()

    def test_small_drop_no_alert(self):
        """Drop < DRAIN_THRESHOLD (8L) → không alert."""
        db = self._make_db()
        plate = "51G12345"
        t0 = utc_dt(2026, 5, 21, 1, 0)
        t1 = utc_dt(2026, 5, 21, 1, 5)
        # Đặt prev_snap thủ công
        gps_module._prev_snap[plate] = {
            "fuel": 100.0, "is_stop": True,
            "created_at": t0, "address": None, "xe_id": None,
        }
        vehicles = [make_vehicle(plate, fuel=95.0, is_stop=True,
                                 time_update="2026/05/21 08:05:00")]

        with patch("app.routers.gps.sio") as mock_sio:
            mock_sio.emit = AsyncMock()
            run(_check_drain_realtime(vehicles, db))
            mock_sio.emit.assert_not_called()

    def test_moving_vehicle_no_alert(self):
        """Xe đang chạy (is_stop=False) → không alert dù drop lớn."""
        db = self._make_db()
        plate = "51G99999"
        t0 = utc_dt(2026, 5, 21, 1, 0)
        gps_module._prev_snap[plate] = {
            "fuel": 120.0, "is_stop": False,
            "created_at": t0, "address": None, "xe_id": None,
        }
        vehicles = [make_vehicle(plate, fuel=100.0, is_stop=False,
                                 time_update="2026/05/21 08:05:00")]

        with patch("app.routers.gps.sio") as mock_sio:
            mock_sio.emit = AsyncMock()
            run(_check_drain_realtime(vehicles, db))
            mock_sio.emit.assert_not_called()

    def test_low_drain_rate_no_alert(self):
        """Drop ≥8L nhưng elapsed lớn → rate < 10 L/h → false positive bị lọc."""
        db = self._make_db()
        plate = "50H11111"
        # GPS mất tín hiệu 4 giờ: 10L drop trong 4h = 2.5 L/h (bình thường khi idle)
        t0 = utc_dt(2026, 5, 21, 0, 0)
        t1 = utc_dt(2026, 5, 21, 4, 0)
        gps_module._prev_snap[plate] = {
            "fuel": 100.0, "is_stop": True,
            "created_at": t0, "address": None, "xe_id": None,
        }
        # time_update tương ứng t1 (VN = UTC+7 → 11:00 VN)
        vehicles = [make_vehicle(plate, fuel=90.0, is_stop=True,
                                 time_update="2026/05/21 11:00:00")]

        with patch("app.routers.gps.sio") as mock_sio:
            mock_sio.emit = AsyncMock()
            run(_check_drain_realtime(vehicles, db))
            mock_sio.emit.assert_not_called()

    def test_real_drain_emits_and_logs(self):
        """Drop 20L trong 5 phút, xe dừng → rate=240 L/h → emit + log DB."""
        db = self._make_db()
        plate = "50H22222"
        # prev: 5 phút trước (UTC 01:00)
        t0 = utc_dt(2026, 5, 21, 1, 0)
        gps_module._prev_snap[plate] = {
            "fuel": 120.0, "is_stop": True,
            "created_at": t0, "address": "Km 10 QL1A", "xe_id": None,
        }
        # curr: 08:05 VN = 01:05 UTC → 5 phút sau
        vehicles = [make_vehicle(plate, fuel=100.0, is_stop=True,
                                 time_update="2026/05/21 08:05:00",
                                 address="Km 10 QL1A")]

        with patch("app.routers.gps.sio") as mock_sio:
            mock_sio.emit = AsyncMock()
            run(_check_drain_realtime(vehicles, db))

            # Socket emit phải được gọi 1 lần
            mock_sio.emit.assert_called_once()
            event_name, payload = mock_sio.emit.call_args[0]
            assert event_name == "drain_alert"
            assert payload["bien_so"] == plate
            assert payload["so_lit"] == 20.0
            assert payload["drain_rate_L_per_h"] > 10

            # DB log phải được tạo
            db.add.assert_called_once()
            db.commit.assert_called_once()

    def test_cooldown_prevents_second_alert(self):
        """Drain đúng nhưng cooldown chưa qua → không emit lần 2."""
        import time as _time
        db = self._make_db()
        plate = "50H33333"
        t0 = utc_dt(2026, 5, 21, 1, 0)
        t1 = utc_dt(2026, 5, 21, 1, 5)

        # Đặt cooldown vừa alert (now - 60s < 1800s)
        gps_module._drain_alert_cooldown[plate] = _time.time() - 60

        gps_module._prev_snap[plate] = {
            "fuel": 120.0, "is_stop": True,
            "created_at": t0, "address": None, "xe_id": None,
        }
        vehicles = [make_vehicle(plate, fuel=100.0, is_stop=True,
                                 time_update="2026/05/21 08:05:00")]

        with patch("app.routers.gps.sio") as mock_sio:
            mock_sio.emit = AsyncMock()
            run(_check_drain_realtime(vehicles, db))
            mock_sio.emit.assert_not_called()
            db.add.assert_not_called()
