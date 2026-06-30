import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Typography, Space, Input, message } from 'antd';
import { storage, TTL } from '../../utils/storage';
import { EditOutlined, SaveOutlined, PlusOutlined, BookOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const { Sider, Content } = Layout;
const { Title } = Typography;

interface DocItem {
  id: string
  category: string
  title: string
  content: string
}

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
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  📐 KỸ THUẬT TÍNH GIÁ — 8 articles đào tạo chuyên sâu
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'calc-0',
    category: '📐 Kỹ Thuật Tính Giá',
    title: '1. Khung Sườn Tư Duy: Từ D×R×C Ra Giá',
    content: `<p>Trước khi học từng công thức cụ thể, bạn cần nắm vững <strong>1 tư duy nền tảng</strong> và <strong>3 bước bất biến</strong> áp dụng cho mọi loại thùng, hộp, khay trong toàn bộ hệ thống báo giá của Nam Phương.</p>

<h2>Tư Duy Nền Tảng</h2>
<p><strong>Mọi loại thùng, hộp, khay đều là 1 tờ giấy phẳng được cắt rồi gập lại.</strong></p>
<p>Bài toán tính giá carton thực chất là: <em>tờ giấy phẳng đó có diện tích bao nhiêu m²?</em> Khi có m²/cái, mọi thứ còn lại (chi phí giấy, gián tiếp, hao hụt, lợi nhuận) đều tính được.</p>

<h2>3 Bước Bất Biến</h2>
<ol>
  <li><strong>Bước 1 — Kích thước thành phẩm → Kích thước tờ phẳng:</strong><br/>
    Từ D × R × C (cm) của thùng mong muốn → áp công thức theo loại → ra <code>kho_kh</code> × <code>dai_kh</code> (cm)
  </li>
  <li><strong>Bước 2 — Tính diện tích:</strong><br/>
    <pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.8;">DT (m²/cái) = kho_kh × dai_kh / 10.000</pre>
  </li>
  <li><strong>Bước 3 — Tính giá:</strong><br/>
    <pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.8;">a  = chi phí giấy    = DT × take_up × ĐL/1000 × đơn_giá_kg
b  = chi phí gián tiếp  (tra bảng theo số lớp)
e  = hao hụt         = (a + b) × tỷ_lệ%  (tra bảng theo SL)
c  = lợi nhuận       = (a + b) × %LN
d  = gia công add-on (in, bế, bồi, chống thấm...)
──────────────────────────────────────────────────
p  = a + b + e + c + d      ← giá cơ bản/cái
Giá bán = p × 1.12          ← markup cuối cố định</pre>
  </li>
</ol>

<h2>Hai Nhóm Gia Công Cần Phân Biệt Ngay</h2>
<table style="width:100%;border-collapse:collapse;margin:10px 0;">
  <tr style="background:#e6f0ff;">
    <th style="border:1px solid #b0c4de;padding:8px 12px;text-align:left;">Nhóm</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;text-align:left;">Loại</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;text-align:left;">Đặc điểm máy</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;text-align:left;">so_dao</th>
  </tr>
  <tr>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>Slot-type</strong><br/>(cắt nhiều dao)</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">A1, A3, A5, A7<br/>Gói giữa, Gói sườn<br/>Giấy tấm (TAM)</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">Máy sóng cắt liên tục<br/>1 tờ rộng → nhiều mảnh</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;text-align:center;">≥ 1<br/>(floor 180/kho1)</td>
  </tr>
  <tr style="background:#fafafa;">
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>Die-cut</strong><br/>(bế khuôn)</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">HOP_CAI, HOP_GIAY<br/>HOP_PIZZA, KHAY...</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">Máy bế cắt 1 lần<br/>Khuôn riêng từng SP</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;text-align:center;"><strong>= 1</strong><br/>(luôn luôn)</td>
  </tr>
</table>

<div class="doc-alert doc-tip">
  <strong>Quy tắc 80/20:</strong> Học thuộc tư duy nền tảng + 3 bước + phân biệt 2 nhóm gia công — đó là 80% kỹ năng cần có để báo giá carton. Các công thức từng loại chỉ là chi tiết kỹ thuật triển khai từ nền tảng này.
</div>

<div class="doc-alert doc-info">
  <strong>Ký hiệu dùng xuyên suốt tài liệu:</strong><br/>
  D = Dài (cm) &nbsp;·&nbsp; R = Rộng (cm) &nbsp;·&nbsp; C = Cao (cm)<br/>
  DT = Diện tích (m²) &nbsp;·&nbsp; ĐL = Định lượng giấy (g/m²)<br/>
  kho_kh = khổ kế hoạch &nbsp;·&nbsp; dai_kh = dài kế hoạch
</div>`
  },

  {
    id: 'calc-1',
    category: '📐 Kỹ Thuật Tính Giá',
    title: '2. Thùng Thường A1 & Thùng 1 Nắp A7',
    content: `<p>A1 (RSC) và A7 (HSC) là 2 loại thùng phổ biến nhất tại Nam Phương — chiếm &gt;70% số lượng đơn hàng. Nắm vững 2 loại này là nền tảng của mọi nhân viên báo giá.</p>

<h2>A1 — Thùng Thường (RSC)</h2>
<p>4 cánh gập đều, nắp trên và đáy dưới khép kín hoàn toàn. Phù hợp hầu hết hàng hóa.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = R + C + offset    (3L: +0.2 | 5L: +0.4 | 7L: +0.8 cm)
dai_kh = (D + R) × 2 + 3
DT kế hoạch = kho_kh × dai_kh / 10.000  m²</pre>

<h3>Cách Đọc Công Thức (Tư Duy Hình Học)</h3>
<ul>
  <li><strong>kho_kh = R + C + offset:</strong> Khi gập thùng, tờ giấy theo chiều ngang phải ôm trọn 1 mặt Rộng + 1 mặt Cao. Số <code>offset</code> nhỏ để chừa mép dán, tăng theo số lớp vì giấy dày hơn.</li>
  <li><strong>dai_kh = (D+R)×2 + 3:</strong> Theo chiều dài, tờ giấy phải gập đủ 2 vòng chu vi (Dài + Rộng) × 2, cộng 3 cm chừa mép dán chồng lên nhau.</li>
</ul>

<h3>Ví Dụ — Thùng 60×40×35 cm, 5 lớp</h3>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 40 + 35 + 0.4 = 75.4 cm
dai_kh = (60 + 40) × 2 + 3 = 203 cm
DT = 75.4 × 203 / 10.000 = 1.531 m²/cái</pre>

<h2>A7 — Thùng 1 Nắp (HSC)</h2>
<p>Chỉ có cánh gập ở 1 đầu (nắp trên), đáy thường là sàn pallet hoặc khay tách rời.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = R/2 + C + offset    (3L: +0.1 | 5L: +0.2 | 7L: +0.4 cm)
dai_kh = (D + R) × 2 + 3    ← giống hệt A1
DT = kho_kh × dai_kh / 10.000  m²</pre>
<p><strong>Khác biệt duy nhất so với A1:</strong> <code>R/2</code> thay vì <code>R</code> ở kho_kh — vì nắp chỉ gập 1 phía, tiết kiệm R/2 giấy theo chiều ngang. A7 luôn nhỏ hơn A1 cùng kích thước.</p>

<h2>Trường Hợp 2 Mảnh (Áp Dụng Cả A1 Lẫn A7)</h2>
<p>Khi <code>dai_kh &gt; 270 cm</code>, tờ giấy không vào được khổ máy → phải cắt làm 2 mảnh:</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">Điều kiện: (D + R) × 2 + 3 &gt; 270  →  D + R &gt; 133.5 cm
Khi đó:   dai_kh mỗi mảnh = (D + R) + 3
DT tổng = 2 × kho_kh × dai_kh / 10.000</pre>

<div class="doc-alert doc-warning">
  <strong>Thùng xuất khẩu lớn (D+R &gt; 134 cm) bắt buộc làm 2 mảnh.</strong> DT tăng nhẹ do 2 lần dư biên. Xác nhận với xưởng trước khi báo giá — chi phí sản xuất có thể tăng do phải lắp ráp thêm.
</div>

<div class="doc-alert doc-tip">
  <strong>Ước lượng nhanh:</strong> A1 vừa (50×35×30) → DT ≈ 0.5–0.7 m²/cái. A1 lớn (80×50×50) → DT ≈ 1.2–1.5 m²/cái. Nhẩm được con số này giúp phát hiện ngay nếu hệ thống tính sai bất thường.
</div>`
  },

  {
    id: 'calc-2',
    category: '📐 Kỹ Thuật Tính Giá',
    title: '3. Thùng Nắp Chồm A3 & Âm Dương A5',
    content: `<p>A3 và A5 là 2 biến thể của A1 dành cho các yêu cầu đóng gói đặc thù. Hiểu rõ sự khác biệt giúp tư vấn đúng loại cho khách hàng.</p>

<h2>A3 — Thùng Nắp Chồm (OVS)</h2>
<p>Cánh nắp phủ chồm qua thùng thay vì khép vừa khít. Tạo độ cứng và che kín mép trên.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 2R + C         ← nắp phủ 2 lần chiều Rộng
dai_kh = (D + R) × 2 + 3  ← giống A1</pre>

<h3>So Sánh A1 vs A3 — Cùng Kích Thước 60×40×35, 5 Lớp</h3>
<table style="width:100%;border-collapse:collapse;margin:10px 0;">
  <tr style="background:#e6f0ff;">
    <th style="border:1px solid #b0c4de;padding:8px 12px;">Loại</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">kho_kh</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">dai_kh</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">DT (m²)</th>
  </tr>
  <tr>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">A1</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">40+35+0.4 = 75.4 cm</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">203 cm</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">1.531</td>
  </tr>
  <tr style="background:#fff8f0;">
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>A3</strong></td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>2×40+35 = 115 cm</strong></td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">203 cm</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>2.335</strong> (+53%)</td>
  </tr>
</table>
<p>A3 tốn giấy hơn A1 rất nhiều. Chỉ dùng khi khách hàng thực sự cần nắp phủ dày (rau củ, thực phẩm ẩm).</p>

<div class="doc-alert doc-warning">
  <strong>Lỗi thường gặp:</strong> Nhầm A3 với A1 khi nghe "thùng nắp chồm". Hỏi lại: nắp chồm bao nhiêu cm? Nếu chỉ cần che kín — A1 là đủ, tiết kiệm ~53% giấy cho khách hàng.
</div>

<h2>A5 — Thùng Âm Dương (Nắp Rời + Đáy Rời)</h2>
<p>2 phần tách rời: đáy (tray) và nắp (lid). Nắp trùm bên ngoài đáy. Dùng cho sản phẩm cao cấp, quà tặng.</p>

<h3>A5_DAY — Phần Đáy</h3>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 2C + R        (gập 2 lần chiều cao theo trục ngang)
dai_kh = 2C + D        (gập 2 lần chiều cao theo trục dọc)
DT = kho_kh × dai_kh / 10.000</pre>

<h3>A5_NAP — Phần Nắp (Lớn Hơn Đáy)</h3>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 2C + R + 4    (cộng 4 cm để nắp trùm khít lên đáy)
dai_kh = 2C + D + 4
DT = kho_kh × dai_kh / 10.000</pre>

<h3>Tư Duy Hình Học A5</h3>
<p>Nhìn vào tờ giấy phẳng của đáy: chiều ngang = 2×C (2 thành bên) + R (sàn), chiều dọc = 2×C (2 thành đầu) + D (sàn). Nắp lớn hơn đáy 4 cm mỗi chiều (~2 cm mỗi bên) để trùm vừa khít.</p>

<div class="doc-alert doc-tip">
  <strong>Quan trọng khi lập báo giá A5:</strong> Luôn tạo <strong>2 dòng sản phẩm riêng</strong> — 1 dòng A5_DAY, 1 dòng A5_NAP. Lý do: đáy và nắp có thể khác số lớp giấy (vd. đáy 5 lớp chịu tải, nắp 3 lớp nhẹ), DT khác nhau hoàn toàn.
</div>`
  },

  {
    id: 'calc-3',
    category: '📐 Kỹ Thuật Tính Giá',
    title: '4. Gói Giữa, Gói Sườn & Giấy Tấm',
    content: `<p>3 loại đặc biệt này ít gặp hơn nhưng có công thức khá khác biệt so với A1/A3/A5. Cần hiểu logic hình học để không nhầm lẫn.</p>

<h2>GOI_GIUA — Gói Giữa (Bliss-style)</h2>
<p>Thùng không có đáy và nắp gập liền — 2 tấm bên tách rời, lắp vào thân giữa. Phù hợp hàng nặng, pallet lớn.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 2R + C        ← R đứng theo chiều kho (khác A1!)
dai_kh = (D + R) × 2   ← không cộng +3 như A1</pre>
<p><strong>Tư duy:</strong> kho_kh tính theo 2 mặt Rộng + 1 mặt Cao, dai_kh bao 2 vòng (Dài + Rộng) nhưng không cần dư biên dán.</p>

<h2>GOI_SUON — Gói Sườn (Sleeve/Wrap-around)</h2>
<p>Tờ giấy bao quanh sườn sản phẩm, không có đáy. Tiết kiệm giấy đáng kể, phù hợp hàng xếp trên pallet.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 2R + C
dai_kh = 2D + 3R        ← 3 lần chiều Rộng — điểm đặc biệt nhất!</pre>

<h3>Tại Sao dai_kh = 2D + 3R?</h3>
<p>Tờ giấy bao quanh sườn gồm: 1 mặt Dài + 1 mặt Rộng + 1 mặt Dài + 1 mặt Rộng + mép 1 mặt Rộng dán chồng = 2D + 3R. Khác hoàn toàn với thùng thường.</p>

<h3>So Sánh Cùng Kích Thước 60×40×35, 5 lớp</h3>
<table style="width:100%;border-collapse:collapse;margin:10px 0;">
  <tr style="background:#e6f0ff;">
    <th style="border:1px solid #b0c4de;padding:8px 12px;">Loại</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">kho_kh</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">dai_kh</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">DT (m²)</th>
  </tr>
  <tr>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">A1</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">75.4</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">203</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">1.531</td>
  </tr>
  <tr style="background:#f6fff6;">
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">GOI_GIUA</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">2×40+35 = 115</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">(60+40)×2 = 200</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">2.300</td>
  </tr>
  <tr style="background:#fff8e6;">
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">GOI_SUON</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">2×40+35 = 115</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">2×60+3×40 = 240</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">2.760</td>
  </tr>
</table>

<h2>TAM — Giấy Tấm Phẳng</h2>
<p>Tờ phẳng không gập, dùng lót đáy thùng, chia tầng hàng hóa, bảo vệ bề mặt.</p>

<div class="doc-alert doc-warning">
  <strong>TAM là loại DUY NHẤT tính DT bằng <code>kho_tt</code> (sau khi nhân so_dao), không phải <code>kho_kh</code>:</strong>
</div>

<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho1   = R + C + 3
so_dao = floor(180 / kho1)         ← bao nhiêu tấm song song trên máy
kho_tt = kho1 × so_dao + 1.8       ← khổ thực tế toàn dải giấy
dai_tt = (D+R)×2 + 4   (3/5 lớp)
         (D+R)×2 + 5   (7 lớp)
DT     = kho_tt × dai_tt / 10.000  ← dùng kho_tt!</pre>

<p><strong>Tại sao dùng kho_tt?</strong> Máy cắt cùng lúc nhiều tấm (so_dao tấm) trên 1 dải giấy rộng. Chi phí giấy tính trên toàn bộ dải đó (kho_tt), bao gồm cả biên giấy giữa các tấm.</p>

<div class="doc-alert doc-tip">
  <strong>Hao hụt TAM khác thùng thường:</strong> TAM dùng tỷ lệ cố định theo số lớp (3L=4%, 5L=5%, 7L=7%), không tra bảng theo số lượng. Lợi nhuận mặc định cũng cao hơn thùng (7–10% thay vì 6%).
</div>`
  },

  {
    id: 'calc-4',
    category: '📐 Kỹ Thuật Tính Giá',
    title: '5. Hộp Die-cut: Nguyên Lý & 4 Loại Cơ Bản',
    content: `<p>Hộp die-cut cắt một mảnh duy nhất (<strong>so_dao = 1</strong>) — kho_tt = kho_kh, không nhân so_dao. DT = kho_kh × dai_kh / 10.000 m². Tề biên cộng thêm <em>sau khi tính xong</em>: bế tay +1/+1 cm · bế tự động 3L +2/+1.5 cm · bế tự động 5/7L +2/+2 cm.</p>

<h2>HOP_CAI — Hộp Tray Thông Thường</h2>
<p>Hộp 4 vách đứng, không có nắp liền. Phổ biến nhất trong nhóm die-cut — dùng cho rau củ, trái cây, thực phẩm tươi.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 3C + 2R + 5     ← 3×C theo ngang (đáy + 2 vách bên)
dai_kh = 4C + D + 10     ← 4×C theo dọc (đáy + 2 vách đầu mỗi bên)</pre>
<div class="doc-alert doc-tip">
  <strong>Ví dụ HOP_CAI — 30×20×10 cm, bế tay:</strong><br/>
  kho_kh = 3×10 + 2×20 + 5 = 75 cm → +1.0 = <strong>76.0 cm</strong><br/>
  dai_kh = 4×10 + 30 + 10 = 80 cm → +1.0 = <strong>81.0 cm</strong><br/>
  DT = 76.0 × 81.0 / 10.000 = <strong>0.616 m²/cái</strong>
</div>

<h2>HOP_CAI_CHAU — Hộp Vách Xiên (Chậu)</h2>
<p>Giống HOP_CAI nhưng 4 vách đổ ra ngoài như hình chậu. Phần +5 cm thêm vào kho_kh để tạo độ xiên của vách — dai_kh không đổi.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 3C + 2R + 10    ← +5 cm hơn HOP_CAI (vách xiên cần thêm giấy)
dai_kh = 4C + D + 10     ← giống HOP_CAI</pre>
<p><strong>So sánh nhanh:</strong> Chỉ khác HOP_CAI ở kho_kh (+5 cm). Nếu không chắc loại nào — hỏi xưởng: vách đứng → HOP_CAI, vách xiên ra ngoài → HOP_CAI_CHAU.</p>
<div class="doc-alert doc-tip">
  <strong>Ví dụ HOP_CAI_CHAU — 30×20×10 cm, bế tay:</strong><br/>
  kho_kh = 3×10 + 2×20 + 10 = 80 cm → +1.0 = <strong>81.0 cm</strong><br/>
  dai_kh = 4×10 + 30 + 10 = 80 cm → +1.0 = <strong>81.0 cm</strong><br/>
  DT = 81.0 × 81.0 / 10.000 = <strong>0.656 m²/cái</strong>
</div>

<h2>HOP_GIAY — Hộp Tự Khép Đáy</h2>
<p>Đáy gập kiểu "lock bottom" — tự khóa khi dựng hộp, không cần keo. Dai_kh ngắn hơn HOP_CAI một C vì phần gập đáy nằm trên trục kho_kh thay vì dai_kh.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 3C + 2R + 10    ← giống HOP_CAI_CHAU
dai_kh = 3C + D + 10     ← 3C thay vì 4C — tiết kiệm hơn HOP_CAI</pre>
<p><strong>Điểm nhận biết:</strong> dai_kh dùng 3C (không phải 4C). Nếu kho_kh = dai_kh hoặc kho_kh lớn hơn hẳn → đây là HOP_GIAY.</p>
<div class="doc-alert doc-tip">
  <strong>Ví dụ HOP_GIAY — 30×20×10 cm, bế tay:</strong><br/>
  kho_kh = 3×10 + 2×20 + 10 = 80 cm → +1.0 = <strong>81.0 cm</strong><br/>
  dai_kh = 3×10 + 30 + 10 = 70 cm → +1.0 = <strong>71.0 cm</strong><br/>
  DT = 81.0 × 71.0 / 10.000 = <strong>0.575 m²/cái</strong> (ít hơn HOP_CAI 0.041 m²)
</div>

<h2>HOP_PIZZA — Hộp Nông Nắp Rộng</h2>
<p>Hộp nông, nắp chiếm phần lớn diện tích (pizza, bánh, hoa quả trưng bày). Đặc trưng: kho rất rộng (4C) nhưng dai ngắn (chỉ 2C) — hộp thấp và dẹt.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = 4C + 2R + 5     ← 4×C theo ngang: nắp rộng, nhiều tầng gập
dai_kh = 2C + D + 5      ← chỉ 2×C theo dọc: hộp nông, ít gập</pre>
<p><strong>Cách nhớ — tỉ lệ C đảo:</strong> HOP_CAI là 3C/4C; HOP_PIZZA là 4C/2C — hoàn toàn ngược. Kho nhiều C hơn dai → hộp nông nắp rộng.</p>
<div class="doc-alert doc-tip">
  <strong>Ví dụ HOP_PIZZA — 40×30×8 cm, bế tay:</strong><br/>
  kho_kh = 4×8 + 2×30 + 5 = 97 cm → +1.0 = <strong>98.0 cm</strong><br/>
  dai_kh = 2×8 + 40 + 5 = 61 cm → +1.0 = <strong>62.0 cm</strong><br/>
  DT = 98.0 × 62.0 / 10.000 = <strong>0.608 m²/cái</strong>
</div>`
  },

  {
    id: 'calc-5',
    category: '📐 Kỹ Thuật Tính Giá',
    title: '6. Hộp Die-cut Nâng Cao: Nắp Cài & Âm Dương',
    content: `<p>Nhóm hộp có thiết kế phức tạp nhất, thường dùng cho hàng hóa yêu cầu đóng gói đặc biệt. Các công thức có điểm bẫy cần chú ý kỹ.</p>

<h2>HOP_NAP_CAI_DAY_GAI — Nắp Cài Đáy Gài</h2>
<p>Nắp và đáy đều có cơ chế cài vào nhau, không dùng băng keo. Phổ biến với hộp quà, hộp thực phẩm cao cấp.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = (D + R) × 2 + 8     ← chu vi thùng + dư biên 8 cm
dai_kh = C + 2R + 5</pre>
<p><strong>Điểm nhận biết:</strong> kho_kh phụ thuộc vào <em>chu vi</em> (D+R), không phải D hoặc R đơn lẻ.</p>

<h2>HOP_NAP_CAI_2_DAU — Nắp Cài 2 Đầu</h2>
<p>Cả 2 đầu hộp đều có cơ chế cài. Thường dùng cho hộp dài có 2 cửa mở (hộp giày, hộp ống).</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">kho_kh = (D + R + 5) × 2     ← 2 nửa mỗi phần D+R+5, ghép lại
dai_kh = C + 2R + 8</pre>

<h2>HOP_AM_DUONG_THAN & HOP_AM_DUONG_NAP — Hộp Âm Dương Die-cut</h2>
<p>Hộp quà cao cấp bế khuôn, nắp trùm hoàn toàn lên thân.</p>

<div class="doc-alert doc-warning">
  <strong>BẪY QUAN TRỌNG — Chiều D và R ĐẢO NGƯỢC so với thùng thường:</strong> Trong hộp âm dương die-cut, D chạy theo trục kho (ngang), R chạy theo trục dai (dọc) — ngược hoàn toàn với A1/A3.
</div>

<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">HOP_AM_DUONG_THAN (thân):
  kho_kh = 4C + D + 5       ← D theo trục kho
  dai_kh = 2C + R + 5       ← R theo trục dai

HOP_AM_DUONG_NAP (nắp — lớn hơn thân 1 cm mỗi chiều):
  kho_kh = 4C + D + 6
  dai_kh = 2C + R + 6</pre>

<h3>Ví Dụ: Hộp 40×30×15, Thân vs Nắp</h3>
<table style="width:100%;border-collapse:collapse;margin:10px 0;">
  <tr style="background:#e6f0ff;">
    <th style="border:1px solid #b0c4de;padding:8px 12px;">Phần</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">kho_kh</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">dai_kh</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">DT (m²)</th>
  </tr>
  <tr>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">Thân</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">4×15+40+5 = 105</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">2×15+30+5 = 65</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">0.683</td>
  </tr>
  <tr style="background:#fff8f0;">
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">Nắp</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">4×15+40+6 = 106</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">2×15+30+6 = 66</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">0.700</td>
  </tr>
</table>

<h3>Cách Kiểm Tra Không Nhầm D và R</h3>
<p>Với hộp hình chữ nhật (D &gt; R): kho_kh luôn lớn hơn dai_kh vì 4C+D &gt; 2C+R. Nếu thấy dai_kh &gt; kho_kh khi D &gt; R → nhập ngược D và R rồi.</p>

<div class="doc-alert doc-tip">
  <strong>Mẹo nhớ 4C và 2C:</strong> Hộp âm dương nhìn từ trên xuống có hình chữ thập: 4 vạt gập theo chiều D (kho) và 2 vạt gập theo chiều R (dai).
</div>`
  },

  {
    id: 'calc-6',
    category: '📐 Kỹ Thuật Tính Giá',
    title: '7. Khay Die-cut: 4 Loại & Hệ Số Đặc Biệt',
    content: `<p>Khay (tray) thường có thành thấp hơn hộp, không có nắp. Trong hệ thống Nam Phương có 4 loại khay die-cut, mỗi loại có 1–2 điểm đặc biệt cần nắm.</p>

<h2>Bảng Tổng Hợp 4 Loại Khay</h2>
<table style="width:100%;border-collapse:collapse;margin:10px 0;">
  <tr style="background:#e6f0ff;">
    <th style="border:1px solid #b0c4de;padding:8px 12px;">Loại</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">kho_kh</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">dai_kh</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">Điểm đặc biệt</th>
  </tr>
  <tr>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>KHAY_1_THANH</strong></td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">2C + R + 7</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">3C + D + 5</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">Cơ bản nhất</td>
  </tr>
  <tr style="background:#fafafa;">
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>KHAY_2_THANH</strong></td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">3C + R + 5</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">4C + D + 7</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">+1 thành → kho và dai đều tăng C</td>
  </tr>
  <tr>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>KHAY_1_THANH_CHAU</strong></td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>(8/3)C</strong> + R + 9</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">3C + D + 5</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">Hệ số C = 8/3 ≈ 2.667 (vách xiên)</td>
  </tr>
  <tr style="background:#fff8e6;">
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>KHAY_NUOC_GK</strong></td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>D</strong> + 2C + 5</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;"><strong>R</strong> + 2C + 5</td>
    <td style="border:1px solid #d0d0d0;padding:7px 12px;">D và R ĐẢO VỊ TRÍ so với khay khác</td>
  </tr>
</table>

<h2>Phân Tích Chi Tiết</h2>

<h3>KHAY_1_THANH vs KHAY_2_THANH</h3>
<p>Thêm 1 thành bên làm cả kho_kh lẫn dai_kh tăng thêm C:</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">KHAY_1_THANH:  kho = 2C+R+7,   dai = 3C+D+5
KHAY_2_THANH:  kho = 3C+R+5,   dai = 4C+D+7
                      ↑ +C               ↑ +C</pre>
<p>Ví dụ D=50, R=30, C=10: KHAY_1 → DT ≈ 0.29 m², KHAY_2 → DT ≈ 0.42 m². Thêm 1 thành tốn thêm ~45% giấy.</p>

<h3>KHAY_1_THANH_CHAU — Tại Sao Hệ Số 8/3?</h3>
<p>Khay châu có vách bên bị vát xiên (không thẳng 90°). Độ vát làm chiều giấy thực tế dài hơn chiều Cao C. Hệ số chuẩn = 8/3 ≈ 2.667 (so với KHAY_1_THANH dùng hệ số 2).</p>

<h3>KHAY_NUOC_GK — Đảo D và R</h3>
<pre style="background:#fff8e6;border:1px solid #f0b030;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">KHAY_NUOC_GK:  kho_kh = D + 2C + 5  (D theo trục kho)
               dai_kh = R + 2C + 5  (R theo trục dai)

Mọi loại khác: kho_kh phụ thuộc R → KHAY_NUOC_GK: kho phụ thuộc D</pre>

<div class="doc-alert doc-warning">
  <strong>Lỗi thường gặp nhất với Khay:</strong> Nhầm KHAY_1_THANH_CHAU với KHAY_1_THANH khi khách mô tả "khay có vách vát". Hỏi thêm: vách thẳng hay xiên? DT khay vách xiên lớn hơn ~20–30% so với khay vách thẳng cùng kích thước.
</div>

<div class="doc-alert doc-tip">
  <strong>Ví dụ nhanh KHAY_1_THANH_CHAU — D=50, R=30, C=8:</strong><br/>
  kho_kh = (8/3)×8 + 30 + 9 = 21.33 + 30 + 9 = 60.33 cm<br/>
  dai_kh = 3×8 + 50 + 5 = 79 cm<br/>
  DT = 60.33 × 79 / 10.000 = 0.476 m²/cái
</div>`
  },

  {
    id: 'calc-7',
    category: '📐 Kỹ Thuật Tính Giá',
    title: '8. Luyện Tập: Ước Lượng Nhanh & Bảng Tóm Tắt',
    content: `<p>Bài tổng kết — giúp bạn nhìn vào yêu cầu của khách hàng và ước lượng được m², DT, kg giấy mà không cần mở máy tính. Đây là kỹ năng của người làm báo giá lâu năm.</p>

<h2>Quy Tắc Ngón Tay Cái — Ước Lượng DT Nhanh</h2>
<table style="width:100%;border-collapse:collapse;margin:10px 0;">
  <tr style="background:#e6f0ff;">
    <th style="border:1px solid #b0c4de;padding:8px 12px;">Loại & Cỡ</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">DT Ước Lượng</th>
    <th style="border:1px solid #b0c4de;padding:8px 12px;">Ví dụ điển hình</th>
  </tr>
  <tr><td style="border:1px solid #d0d0d0;padding:7px 12px;">A1 nhỏ (D+R+C &lt; 80 cm)</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">0.2 – 0.4 m²</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">Hộp thực phẩm nhỏ</td></tr>
  <tr style="background:#fafafa;"><td style="border:1px solid #d0d0d0;padding:7px 12px;">A1 vừa (D+R+C 80–130 cm)</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">0.5 – 0.9 m²</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">Thùng giao hàng thông thường</td></tr>
  <tr><td style="border:1px solid #d0d0d0;padding:7px 12px;">A1 lớn (D+R+C &gt; 130 cm)</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">1.0 – 1.8 m²</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">Thùng sản phẩm công nghiệp</td></tr>
  <tr style="background:#fafafa;"><td style="border:1px solid #d0d0d0;padding:7px 12px;">Hộp die-cut nhỏ (&lt; 30 cm)</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">0.03 – 0.10 m²</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">Hộp thực phẩm, quà tặng</td></tr>
  <tr><td style="border:1px solid #d0d0d0;padding:7px 12px;">Khay die-cut cạn</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">0.05 – 0.15 m²</td><td style="border:1px solid #d0d0d0;padding:7px 12px;">Khay trưng bày</td></tr>
</table>

<h2>3 Câu Hỏi Xác Định Loại Trước Khi Tính</h2>
<ol>
  <li><strong>Nắp gập liền hay tách rời?</strong><br/>
    Liền → A1/A3/A7/Gói. Tách rời → A5 hoặc die-cut (hộp/khay).
  </li>
  <li><strong>D+R có vượt 134 cm không?</strong><br/>
    Nếu có → thùng A1/A3/A7 cần 2 mảnh. Báo giá tăng nhẹ, cần xác nhận xưởng.
  </li>
  <li><strong>Thành cao hay thấp so với kích thước nền?</strong><br/>
    Thành thấp (C &lt; R/2) → thường là khay. Thành cao (C ≥ R) → thùng hoặc hộp.
  </li>
</ol>

<h2>Tính Ngược: Từ DT → Kg Giấy Cần</h2>
<p>Khi xưởng cần chuẩn bị nguyên liệu, ước lượng nhanh kg giấy từ DT:</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">Kg giấy mặt  = DT × ĐL_mat / 1000  (kg/cái)
Kg giấy sóng = DT × take_up_thực × ĐL_song / 1000
  (take_up thực: E=1.22 | B=1.32 | C=1.45 | A=1.56)

Tổng kg cần = Σ(kg từng lớp) × SL × (1 + hao_hụt%)</pre>

<h2>Ví Dụ Tổng Hợp</h2>
<p><strong>Đề bài:</strong> Khách đặt 500 cái thùng A1 — 60×40×35 cm, 5 lớp sóng BC. Ước lượng kg giấy cần chuẩn bị.</p>
<pre style="background:#f6f8fa;border:1px solid #d0d0d0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;line-height:1.9;">Bước 1 — DT:
  kho_kh = 40 + 35 + 0.4 = 75.4 cm
  dai_kh = (60+40)×2 + 3 = 203 cm
  DT = 75.4 × 203 / 10.000 = 1.531 m²/cái

Bước 2 — Kg/cái (ĐL trung bình 150 g/m², sóng C take_up=1.45):
  Mặt (×3):  1.531 × 150/1000 = 0.230 kg × 3 = 0.690 kg
  Sóng (×2): 1.531 × 1.45 × 150/1000 = 0.333 kg × 2 = 0.666 kg
  Tổng ≈ 1.356 kg/cái

Bước 3 — Tổng cần (hao hụt 15%):
  500 × 1.356 × 1.15 ≈ 779 kg giấy cuộn</pre>

<div class="doc-alert doc-tip">
  <strong>Kỹ năng thực tế:</strong> Con số ~780 kg giúp bạn hỏi kho ngay: "Còn đủ ~800 kg giấy BC 5 lớp không?" mà không cần chờ hệ thống tính đầy đủ. Rút ngắn thời gian xác nhận đơn hàng xuống còn vài phút.
</div>

<div class="doc-alert doc-info">
  <strong>Ôn tập nhanh — Các điểm đặc biệt cần nhớ:</strong><br/>
  · <strong>TAM</strong>: dùng <code>kho_tt</code> (không phải kho_kh) để tính DT<br/>
  · <strong>HOP_AM_DUONG</strong>: D chạy theo kho, R chạy theo dai (đảo ngược!)<br/>
  · <strong>KHAY_NUOC_GK</strong>: D vào kho, R vào dai (đảo so với khay khác)<br/>
  · <strong>KHAY_1_THANH_CHAU</strong>: hệ số C = 8/3 ≈ 2.667 (không phải 2)<br/>
  · <strong>A1/A3/A7 lớn</strong>: khi D+R &gt; 133.5 cm → bắt buộc 2 mảnh
</div>`
  },
  {
    id: 'calc-8',
    category: '📐 Kỹ Thuật Tính Giá',
    title: '9. Bảng Tra Cứu: Toàn Bộ 21 Mã Kiểu',
    content: `<p>Tra cứu nhanh 21 mã — ký hiệu màu: <b style="color:#0369A1">D</b>=Dài · <b style="color:#C2410C">R</b>=Rộng · <b style="color:#16A34A">C</b>=Cao. Ví dụ: D=50, R=30, C=15, 5 lớp.</p>

<h2>Nhóm 1 — Slot-type (9 loại)</h2>
<p style="font-size:12px;color:#6B7280;margin:4px 0 10px;">so_dao = ⌊180 ÷ kho1⌋ &nbsp;·&nbsp; DT = kho_kh × dai_kh / 10.000 m²</p>
<div style="overflow-x:auto;">
<table style="width:100%;border-collapse:collapse;font-size:12px;">
  <tr style="background:#EFF6FF;">
    <th style="border:1px solid #BFDBFE;padding:7px 10px;text-align:left;min-width:110px;">Mã kiểu</th>
    <th style="border:1px solid #BFDBFE;padding:7px 10px;text-align:left;min-width:130px;">Tên</th>
    <th style="border:1px solid #BFDBFE;padding:7px 10px;text-align:left;">kho_kh</th>
    <th style="border:1px solid #BFDBFE;padding:7px 10px;text-align:left;">dai_kh</th>
    <th style="border:1px solid #BFDBFE;padding:7px 10px;text-align:center;min-width:65px;">DT (m²)</th>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#1D4ED8;font-family:monospace;">A1</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Thùng thường (RSC)</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;"><b style="color:#C2410C">R</b>+<b style="color:#16A34A">C</b>+off <span style="color:#9CA3AF;font-size:11px">(5L:+0.4)</span></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">(<b style="color:#0369A1">D</b>+<b style="color:#C2410C">R</b>)×2+3</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.740</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#1D4ED8;font-family:monospace;">A3</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Nắp chồm (OVS)</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#C2410C">R</b>+<b style="color:#16A34A">C</b></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">(<b style="color:#0369A1">D</b>+<b style="color:#C2410C">R</b>)×2+3</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">1.223</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#1D4ED8;font-family:monospace;">A5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Âm dương (gộp)</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#C2410C">R</b></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b></td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.480</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#1D4ED8;font-family:monospace;">A5_DAY</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Âm dương đáy</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#C2410C">R</b></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b></td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.480</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#1D4ED8;font-family:monospace;">A5_NAP</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Âm dương nắp</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#C2410C">R</b>+4</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+4</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.538</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#1D4ED8;font-family:monospace;">A7</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Thùng 1 nắp (HSC)</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;"><b style="color:#C2410C">R</b>/2+<b style="color:#16A34A">C</b>+off <span style="color:#9CA3AF;font-size:11px">(5L:+0.2)</span></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">(<b style="color:#0369A1">D</b>+<b style="color:#C2410C">R</b>)×2+3</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.492</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#1D4ED8;font-family:monospace;">GOI_GIUA</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Gói giữa (Bliss)</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#C2410C">R</b>+<b style="color:#16A34A">C</b></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">(<b style="color:#0369A1">D</b>+<b style="color:#C2410C">R</b>)×2</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">1.200</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#1D4ED8;font-family:monospace;">GOI_SUON</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Gói sườn (Sleeve)</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#C2410C">R</b>+<b style="color:#16A34A">C</b></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#0369A1">D</b>+3<b style="color:#C2410C">R</b></td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">1.425</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#1D4ED8;font-family:monospace;">TAM ⚠</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Giấy tấm phẳng</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;color:#92400E;font-size:11px;">★ kho_tt=kho1×so_dao+1.8<br/><span style="color:#9CA3AF;">kho1=R+C+3</span></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">(<b style="color:#0369A1">D</b>+<b style="color:#C2410C">R</b>)×2+4</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;font-size:11px;">2.391<br/><span style="color:#9CA3AF;font-size:10px;">so_dao=3</span></td>
  </tr>
</table>
</div>

<h2>Nhóm 2 — Hộp Die-cut (8 loại)</h2>
<p style="font-size:12px;color:#6B7280;margin:4px 0 10px;">so_dao = 1 luôn luôn &nbsp;·&nbsp; DT = kho_kh × dai_kh / 10.000 m²</p>
<div style="overflow-x:auto;">
<table style="width:100%;border-collapse:collapse;font-size:12px;">
  <tr style="background:#F5F3FF;">
    <th style="border:1px solid #DDD6FE;padding:7px 10px;text-align:left;min-width:145px;">Mã kiểu</th>
    <th style="border:1px solid #DDD6FE;padding:7px 10px;text-align:left;min-width:130px;">Tên</th>
    <th style="border:1px solid #DDD6FE;padding:7px 10px;text-align:left;">kho_kh</th>
    <th style="border:1px solid #DDD6FE;padding:7px 10px;text-align:left;">dai_kh</th>
    <th style="border:1px solid #DDD6FE;padding:7px 10px;text-align:center;min-width:65px;">DT (m²)</th>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#6D28D9;font-family:monospace;">HOP_CAI</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Hộp tray</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">3<b style="color:#16A34A">C</b>+2<b style="color:#C2410C">R</b>+5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">4<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+10</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">1.320</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#6D28D9;font-family:monospace;">HOP_CAI_CHAU</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Hộp vách xiên</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">3<b style="color:#16A34A">C</b>+2<b style="color:#C2410C">R</b>+10</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">4<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+10</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">1.380</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#6D28D9;font-family:monospace;">HOP_GIAY</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Hộp tự khép đáy</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">3<b style="color:#16A34A">C</b>+2<b style="color:#C2410C">R</b>+10</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">3<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+10</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">1.208</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#6D28D9;font-family:monospace;">HOP_PIZZA</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Hộp pizza/bánh</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">4<b style="color:#16A34A">C</b>+2<b style="color:#C2410C">R</b>+5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">1.063</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#6D28D9;font-family:monospace;font-size:11px;">HOP_NAP_CAI_DAY_GAI</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Nắp cài đáy gài</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">(<b style="color:#0369A1">D</b>+<b style="color:#C2410C">R</b>)×2+8</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;"><b style="color:#16A34A">C</b>+2<b style="color:#C2410C">R</b>+5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">1.344</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#6D28D9;font-family:monospace;font-size:11px;">HOP_NAP_CAI_2_DAU</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Nắp cài 2 đầu</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">(<b style="color:#0369A1">D</b>+<b style="color:#C2410C">R</b>+5)×2</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;"><b style="color:#16A34A">C</b>+2<b style="color:#C2410C">R</b>+8</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">1.411</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#6D28D9;font-family:monospace;font-size:11px;">HOP_AM_DUONG_THAN ⚠</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Âm dương thân</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">4<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+5 <span style="color:#B45309;font-size:10px">[D→kho]</span></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#C2410C">R</b>+5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.748</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#6D28D9;font-family:monospace;font-size:11px;">HOP_AM_DUONG_NAP ⚠</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Âm dương nắp</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">4<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+6 <span style="color:#B45309;font-size:10px">[D→kho]</span></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#C2410C">R</b>+6</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.766</td>
  </tr>
</table>
</div>

<h2>Nhóm 3 — Khay Die-cut (4 loại)</h2>
<p style="font-size:12px;color:#6B7280;margin:4px 0 10px;">Không có nắp &nbsp;·&nbsp; so_dao = 1</p>
<div style="overflow-x:auto;">
<table style="width:100%;border-collapse:collapse;font-size:12px;">
  <tr style="background:#ECFDF5;">
    <th style="border:1px solid #6EE7B7;padding:7px 10px;text-align:left;min-width:155px;">Mã kiểu</th>
    <th style="border:1px solid #6EE7B7;padding:7px 10px;text-align:left;min-width:120px;">Tên</th>
    <th style="border:1px solid #6EE7B7;padding:7px 10px;text-align:left;">kho_kh</th>
    <th style="border:1px solid #6EE7B7;padding:7px 10px;text-align:left;">dai_kh</th>
    <th style="border:1px solid #6EE7B7;padding:7px 10px;text-align:center;min-width:65px;">DT (m²)</th>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#047857;font-family:monospace;">KHAY_1_THANH</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Khay 1 thành</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">2<b style="color:#16A34A">C</b>+<b style="color:#C2410C">R</b>+7</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">3<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.670</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#047857;font-family:monospace;">KHAY_2_THANH</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Khay 2 thành</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">3<b style="color:#16A34A">C</b>+<b style="color:#C2410C">R</b>+5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">4<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+7</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.936</td>
  </tr>
  <tr>
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#047857;font-family:monospace;font-size:11px;">KHAY_1_THANH_CHAU ⚠</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Khay vách xiên</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;"><span style="color:#B45309;font-weight:700">(8/3)</span><b style="color:#16A34A">C</b>+<b style="color:#C2410C">R</b>+9</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;">3<b style="color:#16A34A">C</b>+<b style="color:#0369A1">D</b>+5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.790</td>
  </tr>
  <tr style="background:#F9FAFB;">
    <td style="border:1px solid #ddd;padding:6px 10px;font-weight:700;color:#047857;font-family:monospace;">KHAY_NUOC_GK ⚠</td>
    <td style="border:1px solid #ddd;padding:6px 10px;">Khay nước GK</td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;"><b style="color:#0369A1">D</b>+2<b style="color:#16A34A">C</b>+5 <span style="color:#B45309;font-size:10px">[D→kho]</span></td>
    <td style="border:1px solid #ddd;padding:6px 10px;font-family:monospace;"><b style="color:#C2410C">R</b>+2<b style="color:#16A34A">C</b>+5</td>
    <td style="border:1px solid #ddd;padding:6px 10px;text-align:center;font-weight:600;">0.553</td>
  </tr>
</table>
</div>

<div class="doc-alert doc-warning">
  <strong>4 điểm đặc biệt cần nhớ:</strong><br/>
  · <strong>TAM</strong>: DT tính theo kho_tt (= kho1×so_dao+1.8) chứ không phải kho_kh — lớn hơn vì bao nhiều tấm đồng thời<br/>
  · <strong>HOP_AM_DUONG_THAN/NAP</strong>: D chạy theo kho, R chạy theo dai — đảo ngược so với thùng thường<br/>
  · <strong>KHAY_NUOC_GK</strong>: D vào kho, R vào dai — đảo so với 3 khay còn lại<br/>
  · <strong>KHAY_1_THANH_CHAU</strong>: hệ số C = 8/3 ≈ 2.667, không phải 2 hay 3
</div>
<div class="doc-alert doc-tip">
  <strong>2 mảnh (A1, A3, A7):</strong> Khi D+R &gt; 133.5 cm → dai_kh &gt; 270 cm → bắt buộc 2 mảnh; mỗi mảnh: dai = (D+R)+3; DT tổng = 2 × kho_kh × dai_kh.
</div>`
  }
];

export default function DocsPage() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  
  const isAdmin = true; // Giả lập quyền Admin

  useEffect(() => {
    // Đổi key để ép tải lại dữ liệu mới nhất
    const saved = storage.get<DocItem[]>('erp_docs_v8');
    if (saved) {
      setDocs(saved);
      if (saved.length > 0) setActiveDoc(saved[0]);
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

  const saveToLocal = (newDocs: DocItem[]) => {
    setDocs(newDocs);
    storage.set('erp_docs_v8', newDocs, { ttl: TTL.MONTH });  // cache tài liệu 30 ngày
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
