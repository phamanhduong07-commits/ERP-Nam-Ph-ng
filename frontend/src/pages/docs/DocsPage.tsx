import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Typography, Space, Input, message } from 'antd';
import { EditOutlined, SaveOutlined, PlusOutlined, BookOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const { Sider, Content } = Layout;
const { Title } = Typography;

// Dữ liệu nội dung hướng dẫn Sales
const initialDocs = [
  { 
    id: '1', 
    category: 'Phân hệ Bán Hàng', 
    title: '1. Tạo và quản lý Khách Hàng', 
    content: `<p>Trước khi có thể làm Báo giá hoặc lên Đơn hàng, bắt buộc bạn phải có thông tin Khách hàng trong hệ thống. Việc quản lý khách hàng chặt chẽ giúp bộ phận Kế toán theo dõi công nợ chính xác và Kế hoạch sắp xếp xe giao hàng đúng địa chỉ.</p>

<h2>1. Logic Hệ Thống & Lưu Ý Nghiệp Vụ</h2>
<ul>
  <li><strong>Mã Khách Hàng (Mã KH):</strong> Hệ thống thường tự động sinh ra (ví dụ: <code>KH001</code>) hoặc nhập tay theo quy tắc.</li>
  <li><strong>Hạn mức công nợ:</strong> Kế toán có thể thiết lập Hạn mức công nợ cho từng KH. Nếu SO mới làm vượt quá hạn mức này, phần mềm sẽ chặn không cho giao hàng.</li>
</ul>

<h2>2. Hướng Dẫn Thao Tác (Step-by-step)</h2>
<h3>Bước 1: Truy cập Danh mục</h3>
<p><img src="/customer_list.png" /></p>
<ul>
  <li>Trên menu chính, tìm và click vào <strong>Danh mục</strong> > <strong>Khách hàng</strong>.</li>
  <li><em>Lưu ý:</em> Hãy dùng ô tìm kiếm để kiểm tra xem khách hàng này đã tồn tại chưa.</li>
</ul>

<h3>Bước 2: Thêm mới Khách hàng</h3>
<ul>
  <li>Click nút <strong>[+ Thêm Mới]</strong> ở góc phải. Một form điền thông tin sẽ xuất hiện.</li>
</ul>

<h3>Bước 3: Điền Thông Tin Cơ Bản & Giao Hàng</h3>
<p><img src="/customer_form.png" /></p>
<ol>
  <li><strong>Tên Khách Hàng & MST:</strong> Ghi đầy đủ tên và MST. Hệ thống Kế toán sẽ dùng mã này để xuất Hóa đơn điện tử.</li>
  <li><strong>Nhân viên phụ trách:</strong> Chọn tên bạn (Giúp tính hoa hồng).</li>
  <li><strong>Địa chỉ giao hàng thực tế:</strong> Nơi xe tải sẽ chở thùng carton tới.</li>
</ol>

<div class="doc-alert doc-warning">
  <strong>Lỗi: "Mã số thuế này đã tồn tại trong hệ thống!"</strong><br/>
  - <em>Nguyên nhân:</em> Khách hàng này đã được một Sales khác tạo trước đó.<br/>
  - <em>Khắc phục:</em> Tìm kiếm bằng MST. Nếu phát hiện khách của Sales khác đã bỏ, hãy xin quyền chuyển người phụ trách.
</div>

<div class="doc-alert doc-tip">
  <strong>Mẹo In Báo Giá:</strong> Đừng bỏ trống ô "Số điện thoại" và "Địa chỉ giao hàng". Khi in Báo giá bằng <strong>Print Template</strong>, hệ thống tự động bốc 2 trường này điền vào bản in PDF!
</div>` 
  },
  { 
    id: '2', 
    category: 'Phân hệ Bán Hàng', 
    title: '2. Lập Báo Giá thùng Carton', 
    content: `<p>Lập báo giá là kỹ năng quan trọng nhất của Sales ngành bao bì. Nam Phương ERP trang bị một <strong>Costing Engine</strong> cực kỳ mạnh mẽ giúp tính tự động giá thành.</p>

<h2>1. Logic Tính Giá Hệ Thống (Costing Logic)</h2>
<ol>
  <li><strong>Tính diện tích phôi (m2):</strong> Cộng thêm các hệ số bù hao (bờ chừa, mép dán).</li>
  <li><strong>Áp đơn giá giấy:</strong> Tùy vào loại <strong>Sóng</strong> (B, C, BC) và <strong>Số lớp</strong> (3, 5 lớp).</li>
  <li><strong>Tính phụ phí:</strong> Chi phí in, chi phí bế, Tiền Khuôn, Tiền Bảng In.</li>
</ol>

<h2>2. Hướng Dẫn Thao Tác</h2>
<h3>Bước 1: Khai báo Cấu trúc Sản phẩm</h3>
<p><img src="/quote_specs.png" /></p>
<ol>
  <li><strong>Kích thước (Dài x Rộng x Cao):</strong> Đang dùng đơn vị <code>mm</code>.</li>
  <li><strong>Quy cách giấy:</strong> Chọn Số lớp và Tổ hợp sóng.</li>
  <li><strong>Số lượng:</strong> Số lượng càng lớn, Đơn giá càng giảm do phân bổ chi phí khuôn/bản in thấp xuống.</li>
</ol>

<h3>Bước 2: Đánh giá Lợi Nhuận (Margin) & Chốt Đơn Giá</h3>
<p><img src="/quote_margin.png" /></p>
<ul>
  <li>Bấm <strong>[Tính Giá / Calculate]</strong>. Hệ thống hiện ra <strong>Giá Vốn Dự Kiến</strong>.</li>
  <li>Nhập <strong>Đơn giá bán mong muốn</strong>, phần mềm tự tính ra <strong>% Margin</strong>.</li>
</ul>

<div class="doc-alert doc-info">
  <strong>CẢNH BÁO QUAN TRỌNG:</strong> Nếu % Margin hiện <strong>màu đỏ</strong> (dưới mức sàn quy định), báo giá sẽ rơi vào trạng thái <code>CHỜ DUYỆT</code>. Bạn phải đợi Giám đốc duyệt mới in được PDF.
</div>` 
  },
  { 
    id: '3', 
    category: 'Phân hệ Bán Hàng', 
    title: '3. Chuyển đổi SO và Theo dõi Giao Hàng', 
    content: `<p>Khi khách hàng chính thức "chốt deal", bạn bắt buộc phải chuyển Báo giá thành <strong>Đơn Bán Hàng (SO)</strong>. SO là tờ lệnh kích hoạt toàn bộ quy trình Sản xuất.</p>

<h2>1. Chuyển Đổi Sang Đơn SO</h2>
<p><img src="/so_tracking.png" /></p>
<ol>
  <li>Vào Báo giá đã chốt, nhấn <strong>[Tạo Đơn Hàng SO]</strong>.</li>
  <li><strong>Ngày yêu cầu giao hàng:</strong> Rất quan trọng để hệ thống Dàn máy Sản xuất ưu tiên chạy lệnh.</li>
  <li><strong>Ghi chú sản xuất:</strong> Dặn dò quản đốc (VD: <em>Dán kỹ mép</em>).</li>
  <li>Bấm <strong>[Duyệt SO & Chuyển Sản Xuất]</strong>. Thông tin lập tức bắn sang màn hình Quản Đốc Phân Xưởng.</li>
</ol>

<h2>2. Theo Dõi Tiến Độ Thời Gian Thực (Tracking)</h2>
<p><img src="/so_tracking.png" /></p>
<p>Truy cập <strong>Bán Hàng > Tiến độ Đơn hàng</strong>. Màn hình sẽ hiển thị thanh tiến độ:</p>
<ul>
  <li>🟩 <strong>CĐ1 - Chạy sóng:</strong> 100% (Đã nhập phôi xong).</li>
  <li>🟨 <strong>CĐ2 - In Flexo:</strong> 50% (Đang in dở dang).</li>
  <li>⬜ <strong>Thành phẩm:</strong> 0% (Chưa đóng gói).</li>
</ul>

<h2>3. Xử Lý Hàng Bán Trả Lại</h2>
<ol>
  <li>Vào <strong>Bán hàng > Hàng bán trả lại</strong>, chọn SO gốc và mặt hàng.</li>
  <li>Nhập số lượng trả lại là <code>200</code>. Bắt buộc chọn Lý do (Ví dụ: <code>Lỗi in ấn CĐ2</code>).</li>
  <li>Hệ thống sẽ tự động báo Kế toán trừ công nợ và trừ điểm KPI Xưởng.</li>
</ol>
<div class="doc-alert doc-warning">
  <strong>KHÔNG ĐƯỢC THỎA THUẬN MIỆNG:</strong> Bắt buộc phải làm phiếu Hàng Bán Trả Lại để Kế toán có chứng từ hợp lệ xử lý công nợ.
</div>` 
  }
];

export default function DocsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [activeDoc, setActiveDoc] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  
  const isAdmin = true; // Giả lập quyền Admin

  useEffect(() => {
    // Đổi key để ép tải lại dữ liệu mới nhất
    const saved = localStorage.getItem('erp_docs_v4');
    if (saved) {
      setDocs(JSON.parse(saved));
      if(JSON.parse(saved).length > 0) setActiveDoc(JSON.parse(saved)[0]);
    } else {
      setDocs(initialDocs);
      setActiveDoc(initialDocs[0]);
    }
    
    // Bơm CSS động xử lý Layout 2 cột cho các thẻ có chứa ảnh
    const style = document.createElement('style');
    style.innerHTML = `
      .doc-preview-content {
        max-width: 1400px; /* Nới rộng tối đa để ảnh hiển thị to */
        margin: 0 auto;
      }
      
      /* CỰC KỲ QUAN TRỌNG: Tự động bắt ảnh và đẩy sang cột phải */
      .doc-preview-content p:has(img) {
        float: right;
        width: 55%; /* Ảnh chiếm 55% màn hình */
        margin-left: 40px;
        margin-bottom: 24px;
        clear: right;
      }

      .doc-preview-content img { 
        width: 100%; 
        border-radius: 8px; 
        border: 1px solid #ddd; 
        box-shadow: 0 8px 24px rgba(0,0,0,0.12); 
        transition: transform 0.3s ease;
        cursor: zoom-in;
      }
      .doc-preview-content img:hover { transform: scale(1.02); }

      /* Ngắt dòng các tiêu đề để không dính vào ảnh ở bước trên */
      .doc-preview-content h2, .doc-preview-content h3 { 
        clear: both; 
        margin-top: 32px; 
        border-bottom: 1px solid #f0f0f0; 
        padding-bottom: 8px;
        color: #1b168e;
      }

      /* Các hộp thông báo */
      .doc-alert {
        clear: both; /* Để cảnh báo nằm gọn dưới chữ, không đâm vào ảnh */
        padding: 16px;
        margin: 20px 0;
        border-radius: 8px;
        border-left: 4px solid;
      }
      .doc-warning { background: #fffbe6; border-color: #faad14; }
      .doc-tip { background: #f6ffed; border-color: #52c41a; }
      .doc-info { background: #e6f7ff; border-color: #1890ff; }
      
      /* Giữ padding editor rộng ra khi chỉnh sửa */
      .ql-editor { font-size: 16px; line-height: 1.8; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomImage(null);
      }
    };
    if (zoomImage) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomImage]);

  const saveToLocal = (newDocs: any[]) => {
    setDocs(newDocs);
    localStorage.setItem('erp_docs_v4', JSON.stringify(newDocs));
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      setZoomImage((target as HTMLImageElement).src);
    }
  };

  const handleSelect = ({ key }: { key: string }) => {
    const doc = docs.find(d => d.id === key);
    if (doc) {
      setActiveDoc(doc);
      setIsEditing(false);
    }
  };

  const handleCreateNew = () => {
    const newDoc = {
      id: Date.now().toString(),
      category: 'Chưa phân loại',
      title: 'Bài viết mới',
      content: ''
    };
    const updated = [...docs, newDoc];
    saveToLocal(updated);
    setActiveDoc(newDoc);
    setEditTitle(newDoc.title);
    setEditorContent(newDoc.content);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!activeDoc) return;
    const updated = docs.map(d => 
      d.id === activeDoc.id ? { ...d, title: editTitle, content: editorContent } : d
    );
    saveToLocal(updated);
    setActiveDoc({ ...activeDoc, title: editTitle, content: editorContent });
    setIsEditing(false);
    message.success('Đã lưu tài liệu thành công!');
  };

  const categories = Array.from(new Set(docs.map(d => d.category)));
  const menuItems = categories.map(cat => ({
    key: cat,
    icon: <BookOutlined />,
    label: cat,
    children: docs.filter(d => d.category === cat).map(d => ({
      key: d.id,
      label: d.title
    }))
  }));

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)', background: '#fff' }}>
      <Sider width={300} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={5} style={{ margin: 0, color: '#ff8200' }}>Học Viện ERP</Title>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew} size="small" />
          )}
        </div>
        <Menu 
          mode="inline" 
          items={menuItems} 
          onSelect={handleSelect}
          selectedKeys={activeDoc ? [activeDoc.id] : []}
          defaultOpenKeys={categories}
        />
      </Sider>

      {/* Mở rộng Content ra 100% (MaxWidth 1600px) */}
      <Content style={{ padding: '40px 60px', maxWidth: 1600, margin: '0 auto', width: '100%', overflowY: 'auto' }}>
        {activeDoc ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32, borderBottom: '2px solid #1b168e', paddingBottom: 16 }}>
              {isEditing ? (
                <Input 
                  value={editTitle} 
                  onChange={e => setEditTitle(e.target.value)} 
                  style={{ fontSize: 24, fontWeight: 'bold' }}
                />
              ) : (
                <Title level={2} style={{ margin: 0, color: '#1b168e' }}>{activeDoc.title}</Title>
              )}
              
              {isAdmin && (
                <Space>
                  {isEditing ? (
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} size="large">
                      Lưu Lại
                    </Button>
                  ) : (
                    <Button icon={<EditOutlined />} onClick={() => {
                      setEditTitle(activeDoc.title);
                      setEditorContent(activeDoc.content);
                      setIsEditing(true);
                    }}>
                      Chỉnh sửa (Dán ảnh)
                    </Button>
                  )}
                </Space>
              )}
            </div>

            {isEditing ? (
              <div style={{ height: '700px', marginBottom: 50 }}>
                <div style={{ marginBottom: 16, color: '#666', fontStyle: 'italic' }}>
                  * Mẹo viết bài để có Layout 2 cột: Hãy viết Tiêu đề (VD: Bước 1) -&gt; <b>Nhấn Enter, dán ảnh vào ngay bên dưới</b> -&gt; Xuống dòng gõ chữ bình thường. Khi lưu, hệ thống tự động đẩy ảnh sang phải!
                </div>
                <ReactQuill 
                  theme="snow" 
                  value={editorContent} 
                  onChange={setEditorContent} 
                  modules={quillModules}
                  style={{ height: '100%', fontSize: 16 }}
                  placeholder="Gõ tiêu đề, nhấn enter rồi Ctrl+V để dán ảnh..."
                />
              </div>
            ) : (
              <div 
                className="doc-preview-content"
                dangerouslySetInnerHTML={{ __html: activeDoc.content }} 
                style={{ fontSize: 16, lineHeight: 1.8, color: '#333' }}
                onClick={handlePreviewClick}
              />
            )}
          </div>
        ) : null}
      </Content>
      {zoomImage && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            cursor: 'zoom-out'
          }}
          onClick={() => setZoomImage(null)}
        >
          <img 
            src={zoomImage} 
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8, boxShadow: '0 0 30px rgba(0,0,0,0.5)' }} 
            alt="Zoomed"
          />
        </div>
      )}
    </Layout>
  );
}
