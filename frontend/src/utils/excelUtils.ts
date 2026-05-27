import * as XLSX from 'xlsx';

export const exportToExcel = (data: unknown[], fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const downloadTemplate = (type: 'employee' | 'attendance' | 'payroll_config') => {
  let data: unknown[] = [];
  let fileName = '';

  if (type === 'employee') {
    fileName = 'Mau_Import_Nhan_Vien';
    data = [
      {
        ma_nv: 'NV001',
        ho_ten: 'Nguyễn Văn A',
        ngay_sinh: '1990-01-01',
        gioi_tinh: 'Nam',
        cccd: '012345678901',
        so_dien_thoai: '0901234567',
        phap_nhan: 'Công ty Nam Phương',
        phan_xuong: 'Xưởng In',
        bo_phan: 'Tổ In 1',
        chuc_vu: 'Thợ chính',
        he_so_ca_nhan: 2.0,
        ma_van_tay: '101',
        luong_co_ban: 7000000,
        phu_cap_chuyen_can: 500000,
        phu_cap_trach_nhiem: 300000,
        phu_cap_nha_o_com: 650000,
        phu_cap_dien_thoai: 200000,
        phu_cap_khac: 0
      }
    ];
  } else if (type === 'attendance') {
    fileName = 'Mau_Import_Cham_Cong';
    data = [
      {
        ma_nv: 'NV001',
        ngay: '2024-05-01',
        gio_vao: '08:00',
        gio_ra: '17:00',
        tong_gio_thuc: 8.0,
        loai: 'van_tay'
      }
    ];
  } else if (type === 'payroll_config') {
    fileName = 'Mau_Import_Don_Gia';
    data = [
      {
        ma_hang: 'IN',
        ten_hang: 'Công đoạn In',
        phan_tram_luong_sp: 100,
        don_gia: 122,
        loai: 'san_pham',
        ghi_chu: 'Máy in 4 màu'
      }
    ];
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
