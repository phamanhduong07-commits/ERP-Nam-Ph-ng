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
    title: '3. Chuyển đổi SO và Lập Lệnh Sản Xuất', 
    content: `<p>Khi khách hàng đồng ý báo giá, Sales chuyển Báo giá thành <strong>Đơn Bán Hàng (SO)</strong>. SO là chứng từ pháp lý và là tờ lệnh kích hoạt toàn bộ chuỗi cung ứng sản xuất tại nhà máy Nam Phương.</p>

<h2>1. Logic Hệ Thống & Lưu Ý Nghiệp Vụ</h2>
<ul>
  <li><strong>Duyệt Đơn SO:</strong> Chỉ cấp Quản lý (Admin, Giám đốc, Trưởng phòng) mới có quyền Duyệt đơn SO. Đơn ở trạng thái <code>Mới</code> sẽ không được phép sản xuất hoặc giao hàng.</li>
  <li><strong>Tự Động Sinh Lệnh SX (1 Lệnh / 1 Mã Hàng):</strong> Một đơn SO có thể chứa nhiều mặt hàng (thùng carton kích thước khác nhau). Khi nhấn <strong>[Lập Lệnh SX]</strong>, hệ thống tự động tách ra mỗi dòng sản phẩm thành một Lệnh Sản Xuất riêng biệt để dễ dàng theo dõi Kanban và scan thẻ máy ở xưởng.</li>
  <li><strong>Cảnh báo thời gian thực:</strong> Nếu ngày giao hàng còn dưới 3 ngày, hệ thống sẽ hiện cảnh báo màu cam (Sắp đến hạn) hoặc đỏ (Quá hạn) ngay đầu trang chi tiết đơn hàng.</li>
</ul>

<h2>2. Hướng Dẫn Thao Tác (Step-by-step)</h2>
<h3>Bước 1: Duyệt Đơn Hàng (Quản lý)</h3>
<ul>
  <li>Vào <strong>Bán Hàng &gt; Đơn hàng</strong>, tìm đơn hàng có trạng thái <code>Mới</code>.</li>
  <li>Nhấn <strong>[Duyệt đơn]</strong> ở góc phải. Trạng thái chuyển sang <code>Đã duyệt</code>.</li>
</ul>

<h3>Bước 2: Lập Lệnh Sản Xuất (Kế hoạch / Quản đốc)</h3>
<p><img src='https://placehold.co/600x350/e6f7ff/1890ff?text=Lap+Lenh+San+Xuat+Tu+SO' /></p>
<ol>
  <li>Tại màn hình chi tiết đơn hàng đã duyệt, nhấn nút <strong>[Lập lệnh SX]</strong>.</li>
  <li>Điền các thông tin trong Modal xuất hiện:
    <ul>
      <li><strong>Ngày lệnh:</strong> Ngày bắt đầu triển khai sản xuất.</li>
      <li><strong>Ngày hoàn thành kế hoạch:</strong> Hạn chót máy in/sóng phải hoàn thành (thường trước ngày giao hàng 1-2 ngày).</li>
      <li><strong>Pháp nhân & Nơi sản xuất:</strong> Chọn xưởng sẽ trực tiếp chạy đơn hàng này.</li>
    </ul>
  </li>
  <li>Bấm <strong>[Xác nhận]</strong> → Hệ thống tự động bắn các Lệnh SX sang màn hình <strong>Lập kế hoạch sản xuất</strong> của phân xưởng được chọn.</li>
</ol>

<h3>Bước 3: Xem & Kiểm Tra Định Mức Vật Tư (BOM)</h3>
<p><img src='https://placehold.co/600x350/f6ffed/52c41a?text=Xem+Dinh+Muc+Vat+Tu+BOM' /></p>
<ul>
  <li>Khi dòng hàng đã được lập lệnh, cột <strong>BOM</strong> trên bảng chi tiết sản phẩm sẽ hiện nút <strong>[BOM]</strong> màu xanh.</li>
  <li>Bấm vào nút <strong>[BOM]</strong> để mở Drawer tính toán chi tiết: Định lượng giấy cuộn cần dùng cho CĐ1, Lượng mực, lượng keo dán, và các chi phí gia công phụ trợ.</li>
</ul>

<div class="doc-alert doc-warning">
  <strong>Lỗi: "Nút Lập lệnh SX bị mờ hoặc không hiển thị"</strong><br/>
  - <em>Nguyên nhân:</em> Đơn hàng đang ở trạng thái <code>Mới</code> (chưa duyệt) hoặc đơn hàng đã hoàn thành / đã được lập lệnh trước đó.<br/>
  - <em>Khắc phục:</em> Kiểm tra trạng thái đơn hàng. Nếu chưa duyệt, hãy báo Quản lý duyệt đơn.
</div>

<div class="doc-alert doc-tip">
  <strong>In Đơn Nhanh Chóng:</strong> Sử dụng nút <strong>[In đơn]</strong> ở góc phải để xuất file PDF mẫu chuẩn gửi tài xế đi giao hàng, hoặc bấm nút **[Excel]** để xuất danh mục hàng hóa phục vụ đối soát công nợ.
</div>` 
  },
  {
    id: '4',
    category: 'Phân hệ Bán Hàng',
    title: '4. Trả Hàng Bán',
    content: `<p>Khi khách hàng trả lại hàng (lỗi in, sai quy cách, vỡ góc...), bắt buộc phải tạo <strong>Phiếu Trả Hàng Bán</strong> trong hệ thống. Tuyệt đối không thỏa thuận miệng — Kế toán cần chứng từ để xử lý công nợ.</p>

<h2>1. Logic Hệ Thống</h2>
<ul>
  <li><strong>Luồng duyệt:</strong> Tạo mới (Chờ duyệt) → Duyệt → Đã duyệt. Chỉ phiếu <code>moi</code> mới được duyệt hoặc hủy.</li>
  <li><strong>Sau khi duyệt:</strong> Tồn kho Thành Phẩm tự động <strong>cộng lại</strong> số lượng trả, công nợ KH tự động <strong>giảm</strong>.</li>
  <li><strong>Bắt buộc link Đơn Hàng gốc:</strong> Hệ thống cần SO để biết giá bán gốc tính tiền hoàn trả.</li>
</ul>

<h2>2. Hướng Dẫn Thao Tác</h2>
<h3>Bước 1: Tạo Phiếu Trả Hàng</h3>
<p><img src='https://placehold.co/600x350/fff1f0/cf1322?text=Man+Hinh+Tao+Phieu+Tra+Hang' /></p>
<ol>
  <li>Vào <strong>Bán Hàng &gt; Trả hàng bán</strong>, bấm <strong>[+ Tạo phiếu trả hàng]</strong>.</li>
  <li>Chọn <strong>Khách hàng</strong> và <strong>Đơn Hàng gốc</strong> (SO).</li>
  <li>Chọn mặt hàng cần trả, nhập <strong>Số lượng trả</strong> và <strong>Lý do</strong> (VD: Lỗi in ấn CĐ2, Vỡ góc, Sai kích thước).</li>
  <li>Lưu → Phiếu ở trạng thái <strong>Chờ duyệt</strong>.</li>
</ol>

<h3>Bước 2: Duyệt Phiếu (Quản lý)</h3>
<ul>
  <li>Trong danh sách, bấm nút <strong>✓ (xanh)</strong> để duyệt hoặc <strong>✕ (đỏ)</strong> để hủy.</li>
  <li>Sau khi duyệt: tồn kho cộng lên, Kế toán nhận thông báo xử lý công nợ.</li>
</ul>

<div class='doc-alert doc-warning'>
  <strong>KHÔNG ĐƯỢC THỎA THUẬN MIỆNG:</strong> Mọi trường hợp trả hàng đều phải có Phiếu Trả Hàng được duyệt. Nếu không, Kế toán không có cơ sở xử lý và tồn kho sẽ sai lệch.
</div>

<div class='doc-alert doc-tip'>
  <strong>Mẹo lọc nhanh:</strong> Dùng bộ lọc Khách hàng + Ngày để tìm phiếu trả của 1 KH trong tháng cụ thể, rồi bấm <strong>Xuất Excel</strong> để gửi báo cáo cho Kế toán.
</div>`
  },
  {
    id: '5',
    category: 'Phân hệ Bán Hàng',
    title: '5. Theo Dõi Đơn Hàng (Realtime)',
    content: `<p>Đây là màn hình <strong>trung tâm điều phối</strong> của cả nhà máy — Sales, Quản đốc và Ban Giám Đốc đều dùng màn hình này để biết đơn hàng nào đang ở giai đoạn nào, đơn nào sắp trễ.</p>

<h2>1. Logic Hệ Thống</h2>
<ul>
  <li><strong>Tự động làm mới:</strong> Dữ liệu cập nhật mỗi 2 phút từ server — không cần F5.</li>
  <li><strong>Màu hàng cảnh báo:</strong>
    <ul>
      <li>🟡 Vàng: Đơn chưa có Lệnh Sản Xuất (Chờ phát lệnh)</li>
      <li>🔴 Đỏ: Đã quá hạn giao hàng</li>
      <li>🟠 Cam: Còn ≤ 3 ngày đến hạn giao</li>
    </ul>
  </li>
  <li><strong>Cột Tiến Độ In:</strong> Hiển thị thanh progress (số thùng đã in OK / số thùng kế hoạch).</li>
</ul>

<h2>2. Hướng Dẫn Thao Tác</h2>
<h3>Bước 1: Lọc và Tìm Kiếm</h3>
<p><img src='https://placehold.co/600x350/e6f7ff/0050b3?text=Man+Hinh+Theo+Doi+Don+Hang' /></p>
<ul>
  <li>Lọc theo <strong>Pháp nhân</strong>, <strong>Xưởng SX</strong>, <strong>Nhân viên theo dõi</strong>.</li>
  <li>Gõ từ khóa vào ô tìm kiếm: tìm theo LSX, tên khách, mã đơn hàng, tên hàng.</li>
  <li>Bấm nút <strong>[Quá hạn]</strong> (màu đỏ) để lọc ngay các đơn đã trễ deadline.</li>
</ul>

<h3>Bước 2: Xem Chi Tiết Từng Lệnh</h3>
<ul>
  <li>Bấm vào <strong>Số LSX</strong> trên bảng → Panel bên phải hiện ra toàn bộ thông tin.</li>
  <li>Dùng phím <strong>← →</strong> để chuyển qua lại giữa các lệnh, <strong>Esc</strong> để đóng.</li>
</ul>

<h3>Bước 3: Chọn Nhiều Lệnh để Tổng Hợp</h3>
<ul>
  <li>Tick vào checkbox nhiều dòng → Phần dưới hiện <strong>Tổng số thùng</strong> và <strong>Tổng số khối (m³)</strong>.</li>
  <li>Dùng để báo cáo nhanh với tài xế hoặc kế hoạch xuất hàng.</li>
</ul>

<div class='doc-alert doc-info'>
  <strong>Bộ lọc Giai Đoạn:</strong> Bấm vào các Tag màu sắc ở thanh tóm tắt (CĐ1, CĐ2, Thành phẩm...) để lọc nhanh tất cả đơn đang ở giai đoạn đó. Bấm lại để bỏ lọc.
</div>`
  },
  {
    id: '6',
    category: 'Phân hệ Bán Hàng',
    title: '6. Giao Hàng',
    content: `<p>Module <strong>Giao Hàng</strong> quản lý toàn bộ việc xuất thành phẩm từ kho ra xe, từ xe đến khách hàng. Đây là bước cuối cùng trước khi Kế toán xuất Hóa Đơn.</p>

<h2>1. Logic Hệ Thống</h2>
<ul>
  <li>Thành phẩm phải có trong <strong>Kho Thành Phẩm</strong> trước khi tạo phiếu giao hàng.</li>
  <li>Mỗi chuyến giao = 1 Phiếu Giao Hàng gồm nhiều dòng hàng (có thể giao nhiều đơn cùng 1 xe).</li>
  <li>Sau khi xác nhận giao hàng → Tồn kho Thành Phẩm <strong>tự động trừ</strong>, trạng thái SO cập nhật → <code>da_xuat</code>.</li>
</ul>

<h2>2. Hướng Dẫn Thao Tác</h2>
<h3>Bước 1: Chuẩn Bị Chuyến Hàng</h3>
<p><img src='https://placehold.co/600x350/f6ffed/135200?text=Man+Hinh+Giao+Hang' /></p>
<ol>
  <li>Vào <strong>Bán Hàng &gt; Giao hàng</strong>.</li>
  <li>Chọn các dòng hàng cần giao (lọc theo khách, theo ngày giao).</li>
  <li>Chọn xe và tài xế cho chuyến.</li>
</ol>

<h3>Bước 2: Xác Nhận Xuất Kho</h3>
<ol>
  <li>Kiểm tra số lượng thực xuất (có thể xuất một phần — partial delivery).</li>
  <li>In <strong>Phiếu Giao Hàng</strong> để tài xế mang theo.</li>
  <li>Bấm <strong>[Xác Nhận Giao]</strong> → hệ thống trừ kho và cập nhật trạng thái.</li>
</ol>

<div class='doc-alert doc-warning'>
  <strong>Giao một phần:</strong> Nếu xe không đủ tải, có thể giao một phần SL. Phần còn lại vẫn ở trạng thái <code>Chờ giao</code> và xuất hiện lại trong danh sách lần sau.
</div>`
  },
  {
    id: '7',
    category: 'Phân hệ Bán Hàng',
    title: '7. Hóa Đơn VAT',
    content: `<p>Sau khi giao hàng xong, Kế toán cần xuất <strong>Hóa Đơn VAT (GTGT)</strong> để gửi khách hàng và hạch toán doanh thu. Hệ thống hỗ trợ tạo HĐ từ Đơn Hàng hoặc tạo thủ công.</p>

<h2>1. Logic Hệ Thống</h2>
<ul>
  <li><strong>Trạng thái HĐ:</strong> Nháp → Đã xuất → Đã thanh toán / Quá hạn.</li>
  <li><strong>Công nợ tự động:</strong> Sau khi xuất HĐ, hệ thống tạo bản ghi công nợ trong Sổ AR (Accounts Receivable).</li>
  <li><strong>Cảnh báo quá hạn:</strong> Hàng trong bảng tô màu đỏ khi đã quá hạn thanh toán. Bật toggle <strong>[Chỉ quá hạn]</strong> để xem ngay.</li>
</ul>

<h2>2. Hướng Dẫn Thao Tác</h2>
<h3>Cách 1: Tạo HĐ từ Đơn Hàng (Nhanh nhất)</h3>
<p><img src='https://placehold.co/600x350/fff7e6/ad4e00?text=Tao+Hoa+Don+Tu+Don+Hang' /></p>
<ol>
  <li>Vào <strong>Bán Hàng &gt; Hóa đơn VAT</strong>, bấm <strong>[Từ đơn hàng]</strong>.</li>
  <li>Tìm và chọn Đơn Hàng đã duyệt (<code>da_duyet</code>) cần xuất HĐ.</li>
  <li>Bấm <strong>[Tạo hóa đơn]</strong> → Hệ thống tự điền thông tin KH, MST, danh sách hàng, tổng tiền.</li>
  <li>Kiểm tra lại thông tin và bấm <strong>[Phát Hành]</strong>.</li>
</ol>

<h3>Cách 2: Tạo HĐ Thủ Công</h3>
<ul>
  <li>Bấm <strong>[+ Tạo hóa đơn]</strong>, điền đầy đủ thông tin KH, hàng hóa, đơn giá, VAT.</li>
  <li>Dùng khi HĐ không link trực tiếp với SO (VD: HĐ tạm ứng, HĐ điều chỉnh).</li>
</ul>

<h3>Theo Dõi Công Nợ</h3>
<p><img src='https://placehold.co/600x350/f9f0ff/531dab?text=Bang+Theo+Doi+Cong+No' /></p>
<ul>
  <li>Cột <strong>Còn lại</strong>: màu vàng = còn nợ, màu đỏ = quá hạn, màu xanh = đã thanh toán đủ.</li>
  <li>Dòng tóm tắt ở trên bảng hiện <strong>Tổng còn lại</strong> và <strong>Đã thu</strong> cho toàn bộ trang.</li>
  <li>Bấm <strong>[Xuất Excel]</strong> để làm báo cáo công nợ gửi BGĐ.</li>
</ul>

<div class='doc-alert doc-info'>
  <strong>Lưu ý VAT:</strong> Thuế suất thường là 8% hoặc 10% tùy loại hàng. Kế toán xác nhận với BGĐ trước khi phát hành hàng loạt.
</div>`
  },
  {
    id: '8',
    category: 'Phân hệ Logistics & Nhân sự',
    title: '8. Quản lý Đội xe & Tiêu hao Nhiên liệu',
    content: `<p>Phân hệ Logistics & Quản lý Đội xe là cầu nối cuối cùng của ERP Nam Phương, chịu trách nhiệm vận chuyển thành phẩm carton đến khách hàng, kiểm soát chi phí nhiên liệu và tự động tính lương chuyến cho tổ lái (Tài xế & Lơ xe).</p>

<h2>1. Logic Hệ Thống & Liên Kết Nghiệp Vụ</h2>
<p>Quy trình vận hành Logistics bao gồm các logic cốt lõi sau để đảm bảo tính minh bạch và tối ưu hóa chi phí:</p>
<ul>
  <li><strong>Quỹ chuyến (tiền chuyến):</strong> Được tính tự động = <code>Tổng m² thực giao × Đơn giá vận chuyển/m²</code> (được thiết lập theo từng tuyến đường/khách hàng tại danh mục).</li>
  <li><strong>Hệ số phân bổ tổ lái:</strong> Lương chuyến được tự động chia cho các thành viên tổ lái theo hệ số:
    <ul>
      <li><strong>Tài xế chính:</strong> Hệ số <code>1.0</code> (Hưởng 100% lương tiêu chuẩn chuyến).</li>
      <li><strong>Lơ xe (Phụ xe):</strong> Hệ số <code>0.3</code> (Hưởng 30% lương tiêu chuẩn chuyến).</li>
    </ul>
    <em>Ví dụ: Quỹ chuyến là 1.300.000đ. Tổng hệ số = 1.3. Tài xế nhận: 1.000.000đ; Lơ xe nhận: 300.000đ.</em>
  </li>
  <li><strong>Định mức tiêu hao xăng dầu:</strong> Mỗi xe có định mức tiêu chuẩn (VD: 20L/100km). Hệ thống tự tính toán hiệu suất thực tế của mỗi lần đổ dầu để cảnh báo hao hụt bất thường.</li>
</ul>

<h2>2. Quản Lý Danh Mục Đội Xe</h2>
<p>Trước khi vận hành, bộ phận Điều phối hoặc Nhân sự cần thiết lập các danh mục nền tảng sau:</p>
<h3>2.1. Danh mục Xe (/master/xe)</h3>
<ul>
  <li>Khai báo biển số xe, loại xe (tải trọng), phân xưởng quản lý.</li>
  <li><strong>Định mức dầu:</strong> Số lít dầu tiêu chuẩn trên 100km (Ví dụ: xe 5 tấn định mức 18L/100km, xe 8 tấn định mức 22L/100km).</li>
</ul>
<h3>2.2. Danh mục Tài xế & Lơ xe (/master/tai-xe, /master/lo-xe)</h3>
<ul>
  <li>Liên kết hồ sơ nhân viên với danh mục lái xe.</li>
  <li>Thiết lập <strong>Hệ số chuyến</strong> mặc định (Tài xế mặc định 1.0, Lơ xe mặc định 0.3 hoặc 0.2 tùy thâm niên).</li>
  <li>Gán xe phụ trách mặc định cho tài xế.</li>
</ul>

<h2>3. Quy Trình Vận Hành Giao Hàng & Tính Lương Chuyến</h2>
<p>Khi thủ kho chuẩn bị xuất hàng, Điều phối viên lập chuyến xe trên trang <strong>Bán Hàng > Giao Hàng</strong> (<code>/sales/giao-hang</code>):</p>
<p><img src="https://placehold.co/600x350/f6ffed/135200?text=Lap+Chuyen+Giao+Hang+Tren+ERP" /></p>
<h3>Bước 1: Chọn Đơn hàng & Xe vận chuyển</h3>
<ul>
  <li>Chọn các dòng sản phẩm carton đang nằm trong Kho Thành Phẩm chờ giao.</li>
  <li>Chọn Xe, Tài xế, và Lơ xe phụ trách chuyến.</li>
  <li>Hệ thống tự tính ra Tổng m² hàng hóa và gọi Bảng giá tuyến để đề xuất Đơn giá m².</li>
</ul>
<h3>Bước 2: Xác nhận xuất giao hàng</h3>
<ul>
  <li>Nhập số lượng thực giao lên xe.</li>
  <li>Hệ thống tự tính Quỹ Chuyến = Tổng m² × Đơn giá m² và hiển thị trực quan bảng phân bổ thu nhập tạm tính cho Tài xế & Lơ xe ngay trên Form.</li>
  <li>Bấm <strong>[Xác Nhận Giao]</strong> → In Phiếu giao hàng PDF gửi tài xế mang đi đường.</li>
</ul>

<h2>4. Nhật Ký Đổ Dầu & Quản Lý Hao Hụt Nhiên Liệu</h2>
<p>Mỗi khi xe đổ dầu hoặc kết thúc tuần chạy, tài xế nộp hóa đơn dầu. Điều phối viên truy cập <strong>Quản lý Đội xe & Logistics</strong> (<code>/hr/logistics</code>) và chọn tab Nhật ký đổ dầu:</p>
<h3>Bước 1: Thêm mới Phiếu đổ dầu</h3>
<ol>
  <li>Bấm nút <strong>[+ Nhập đổ dầu]</strong>.</li>
  <li>Chọn Xe và Tài xế phụ trách đổ.</li>
  <li>Nhập số <strong>KM đầu</strong> và <strong>KM cuối</strong> ghi trên đồng hồ taplo xe.</li>
  <li>Nhập <strong>Số lít thực đổ</strong> và <strong>Đơn giá dầu/lít</strong> trên hóa đơn. Bấm [Lưu lại].</li>
</ol>
<h3>Bước 2: Đối soát Hiệu quả Tiêu hao Xăng Dầu</h3>
<ul>
  <li>Hệ thống tự tính: <code>Tổng KM chạy = KM cuối − KM đầu</code>.</li>
  <li>Tự động tính hiệu suất tiêu hao thực tế:
    <br/><strong>Tỷ lệ tiêu hao thực tế = (Số lít thực đổ / Tổng KM chạy) × 100 (Lít/100km)</strong>
  </li>
  <li><strong>Cơ chế Cảnh báo (Hiệu quả):</strong>
    <ul>
      <li><span style="color:#52c41a">● XANH (Đạt):</span> Nếu tỷ lệ tiêu hao thực tế ≤ Định mức tiêu chuẩn của xe → An toàn, duyệt thanh toán.</li>
      <li><span style="color:#cf1322">● ĐỎ (Cảnh báo vượt mức):</span> Nếu tỷ lệ tiêu hao thực tế > Định mức tiêu chuẩn xe → Cần hậu kiểm (Tài xế chạy ép số, rò rỉ dầu hoặc đỗ xe nổ máy lạnh quá lâu).</li>
    </ul>
  </li>
</ul>

<div class="doc-alert doc-warning">
  <strong>Lỗi thường gặp: KM cuối nhập nhỏ hơn KM đầu hoặc sai số quá lớn.</strong><br/>
  - <em>Nguyên nhân:</em> Nhập nhầm số hiển thị trên taplo hoặc tài xế ghi chép sai.<br/>
  - <em>Khắc phục:</em> Đối chiếu trực tiếp với số KM hành trình đo được trên phần mềm <strong>GPS Bình Minh</strong> ở mục hướng dẫn bên dưới.
</div>`
  },
  {
    id: '9',
    category: 'Phân hệ Logistics',
    title: '9. Hướng dẫn Giám sát Hành trình & Định vị GPS',
    content: `<p>Hệ thống ERP Nam Phương được liên kết dữ liệu với nền tảng GPS Bình Minh (<code>gpsbinhminh.vn</code>) để quản trị và kiểm soát xe chạy trên đường một cách trực quan, chính xác.</p>

<h2>1. Đăng nhập Hệ thống GPS</h2>
<ul>
  <li><strong>Địa chỉ truy cập Web:</strong> <a href="https://gpsbinhminh.vn" target="_blank">https://gpsbinhminh.vn</a> hoặc tải ứng dụng <strong>"Bình Minh GPS"</strong> trên điện thoại (App Store / CH Play).</li>
  <li>Đăng nhập bằng tài khoản điều phối do bộ phận Admin cấp (Ví dụ: <code>namphuong_logistics</code>).</li>
</ul>

<h2>2. Giám sát Lộ trình Trực tuyến (Real-time Tracking)</h2>
<p>Trên bản đồ số, you sẽ thấy vị trí thời gian thực của tất cả đầu xe trong đội xe.</p>
<ul>
  <li><strong>Ý nghĩa màu sắc biểu tượng xe:</strong>
    <ul>
      <li>🟢 <span style="color:#52c41a"><strong>Màu xanh lá:</strong></span> Xe đang di chuyển (kèm tốc độ thực tế).</li>
      <li>🔴 <span style="color:#cf1322"><strong>Màu đỏ:</strong></span> Xe đang dừng/đỗ tắt máy.</li>
      <li>🟡 <span style="color:#faad14"><strong>Màu cam:</strong></span> Xe đang nổ máy nhưng đứng yên (Idle - chạy không tải).</li>
    </ul>
  </li>
  <li><strong>Trạng thái phụ trợ:</strong> Kiểm tra được trạng thái đóng/mở cửa thùng xe để đảm bảo an toàn hàng hóa carton tránh ẩm ướt khi trời mưa hoặc thất thoát hàng dọc đường.</li>
</ul>

<h2>3. Xem lại Lộ trình xe chạy (Route Replay) & Tra cứu KM thực tế</h2>
<p>Đây là tính năng quan trọng nhất để đối soát phiếu xăng dầu của tài xế nhằm loại bỏ việc gian lận hóa đơn dầu:</p>
<p><img src="https://placehold.co/600x350/fff7e6/ad4e00?text=Xem+Lai+Lo+Trinh+Xe+Chay+GPS" /></p>
<ol>
  <li>Vào mục <strong>Xem lại lộ trình (Replay)</strong> trên thanh công cụ GPS Bình Minh.</li>
  <li>Chọn Biển số xe cần tra cứu và Khoảng thời gian (Ví dụ: từ 08:00 đến 17:00 ngày hôm nay).</li>
  <li>Bấm <strong>[Xem lại]</strong> → Hệ thống vẽ lại đường chạy của xe trên bản đồ và hiển thị <strong>Tổng số KM đã di chuyển thực tế</strong>.</li>
  <li><strong>Đối chiếu:</strong> Lấy số KM đo được từ định vị GPS so sánh với số <code>KM cuối − KM đầu</code> trên phiếu đổ dầu nhập ở ERP. Nếu lệch quá 5%, yêu cầu tài xế giải trình lộ trình chạy ngoài luồng.</li>
</ol>

<h2>4. Các Báo cáo Cần Kiểm Tra Cuối Tháng</h2>
<p>Điều phối viên cần xuất các báo cáo sau từ GPS Bình Minh để gửi Ban Giám Đốc đối soát hiệu quả:</p>
<ul>
  <li><strong>Báo cáo tổng hợp hiệu suất xe:</strong> Tổng số KM chạy trong tháng, số lần vi phạm tốc độ quá quy định.</li>
  <li><strong>Báo cáo dừng đỗ chi tiết:</strong> Xem tài xế có đỗ sai quy định hoặc giao nhận hàng trễ giờ hẹn tại kho của khách hàng hay không.</li>
</ul>

<div class="doc-alert doc-tip">
  <strong>Mẹo quản lý tối ưu:</strong><br/>
  Hãy xuất Excel báo cáo xăng dầu trên ERP (<code>/hr/logistics</code>) cuối mỗi tháng, đặt cạnh Báo cáo tổng hợp số KM chạy của GPS Bình Minh để phát hiện ngay xe nào đang bị thất thoát dầu nhiều nhất, giúp nhà máy tiết kiệm hàng chục triệu đồng chi phí vận chuyển.
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
    const saved = localStorage.getItem('erp_docs_v7');
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
    localStorage.setItem('erp_docs_v7', JSON.stringify(newDocs));
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
