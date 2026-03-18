import React, { useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, Building2, Search, FileText,
  Layers, Settings, KeyRound, Zap, AlertTriangle, CheckCircle2,
  ArrowRight, Info, Cpu, Globe, Hash, RefreshCw, Clock
} from 'lucide-react';

function Section({ icon, title, color = 'var(--accent)', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', background: 'var(--bg-panel)',
          border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          transition: 'background 0.15s',
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}18`, flexShrink: 0 }}>
          {React.cloneElement(icon, { size: 17, color })}
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', flex: 1 }}>{title}</span>
        {open ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
      </button>
      {open && <div style={{ padding: '20px 24px', background: 'var(--bg-content)' }}>{children}</div>}
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{n}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>
      </div>
    </div>
  );
}

function Note({ type = 'blue', children }) {
  const cfg = {
    blue:   { cls: 'info-box-blue',    icon: <Info size={14} /> },
    green:  { cls: 'info-box-green',   icon: <CheckCircle2 size={14} /> },
    yellow: { cls: 'info-box-yellow',  icon: <AlertTriangle size={14} /> },
  }[type];
  return (
    <div className={`info-box ${cfg.cls}`} style={{ marginTop: 12 }}>
      {cfg.icon}
      <span style={{ fontSize: 13 }}>{children}</span>
    </div>
  );
}

function Tag({ children, color = 'var(--accent)' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}30`, margin: '0 2px' }}>
      {children}
    </span>
  );
}

export default function Help() {
  return (
    <div className="page-content">
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} color="var(--accent)" />
            </div>
            <div>
              <h1 className="page-title" style={{ marginBottom: 2 }}>Hướng Dẫn Sử Dụng</h1>
              <p className="page-subtitle">Tổng quan và hướng dẫn đầy đủ hệ thống AutoSEO</p>
            </div>
          </div>
        </div>

        {/* Tổng quan */}
        <div style={{ padding: '20px 24px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-panel)', marginBottom: 24, borderLeft: '3px solid var(--accent)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>AutoSEO là gì?</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            AutoSEO là công cụ tự động hóa quy trình tạo nội dung SEO, sử dụng <strong>Google Gemini AI</strong> để sinh tiêu đề và viết bài chuẩn SEO theo thông tin từng doanh nghiệp. Hệ thống hỗ trợ viết lẻ từng bài hoặc xử lý hàng loạt qua <strong>Gemini Batch API</strong> (giảm 50% chi phí).
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {[
              { icon: <Building2 size={12} />, label: 'Quản lý Công ty' },
              { icon: <Search size={12} />, label: 'Từ khóa SEO' },
              { icon: <FileText size={12} />, label: 'Viết bài tự động' },
              { icon: <Layers size={12} />, label: 'Batch API' },
              { icon: <Settings size={12} />, label: 'Giới hạn & API Key' },
            ].map(({ icon, label }) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                {icon} {label}
              </span>
            ))}
          </div>
        </div>

        {/* Quy trình tổng quát */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Quy trình hoạt động</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', gap: 6 }}>
            {[
              { icon: <Building2 size={13} />, label: 'Thêm Công ty', color: 'var(--info)' },
              { icon: <Search size={13} />, label: 'Thêm Từ khóa', color: 'var(--accent)' },
              { icon: <Hash size={13} />, label: 'AI sinh Tiêu đề', color: 'var(--accent)' },
              { icon: <FileText size={13} />, label: 'Viết Bài', color: 'var(--success)' },
              { icon: <Layers size={13} />, label: 'Batch (tùy chọn)', color: 'var(--warning)' },
            ].map(({ icon, label, color }, i) => (
              <React.Fragment key={label}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, background: `${color}12`, border: `1px solid ${color}30`, fontSize: 13, fontWeight: 600, color }}>
                  {icon} {label}
                </div>
                {i < 4 && <ArrowRight size={14} color="var(--text-muted)" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── SECTION 1: Cấu hình API ── */}
        <Section icon={<KeyRound />} title="Bước 1 — Cấu hình API Keys" color="var(--danger)" defaultOpen>
          <Step n="1" title="Truy cập Cài đặt → tab Cấu hình API">
            Trước khi dùng hệ thống, cần cung cấp ít nhất <strong>Gemini API Key</strong>. Vào menu <Tag>Cài đặt</Tag> → tab <Tag>Cấu hình API</Tag>.
          </Step>
          <Step n="2" title="Gemini API Key (bắt buộc)">
            Lấy key tại <strong>aistudio.google.com</strong> → <em>Get API Key</em>. Key có dạng <code style={{ background: 'var(--bg-panel)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>AIza...</code>
          </Step>
          <Step n="3" title="Gemini Model">
            Chọn model phù hợp với nhu cầu:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>gemini-2.5-flash</strong> — Nhanh, rẻ, chất lượng tốt <Tag color="var(--success)">Khuyên dùng</Tag></li>
              <li><strong>gemini-2.5-flash-lite</strong> — Rất nhanh, chi phí thấp nhất</li>
              <li><strong>gemini-2.5-pro</strong> — Chất lượng cao nhất, chi phí cao hơn</li>
              <li><strong>gemini-2.0-flash</strong> — Thế hệ trước, ổn định</li>
            </ul>
          </Step>
          <Step n="4" title="SerpAPI Key (tùy chọn)">
            Nếu có SerpAPI key (<strong>serpapi.com</strong>), hệ thống sẽ lấy dữ liệu kết quả tìm kiếm Google thực tế để AI sinh tiêu đề chính xác hơn. Nếu không có, AI vẫn tự sinh tiêu đề dựa trên kiến thức chuyên sâu.
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Nhập nhiều key để tránh hết lượt</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Hỗ trợ nhập <strong>nhiều key cách nhau bởi dấu phẩy</strong>. Mỗi lần gọi, hệ thống tự chọn ngẫu nhiên 1 key để phân tải đều — nếu key đó lỗi sẽ tự thử key khác:
              </div>
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-content)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}>
                key_abc123,key_def456,key_ghi789
              </div>
            </div>
          </Step>
          <Note type="green">Cấu hình được lưu vào database, có hiệu lực ngay — không cần restart server. Key được ẩn dạng password trên giao diện.</Note>
        </Section>

        {/* ── SECTION 2: Công ty ── */}
        <Section icon={<Building2 />} title="Bước 2 — Quản lý Website / Công ty" color="var(--info)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Mỗi bài viết được cá nhân hóa theo thông tin công ty. AI dùng dữ liệu này để viết bài phù hợp với thương hiệu, sản phẩm, và phong cách của từng đơn vị.
          </div>
          <Step n="1" title="Thêm Website / Công ty">
            Nhấn <Tag color="var(--info)">Thêm Website</Tag> và điền đầy đủ thông tin:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>Tên công ty</strong> — Tên thương hiệu hiển thị trong bài viết</li>
              <li><strong>URL website</strong> — AI sẽ chèn link trỏ về đây trong bài</li>
              <li><strong>Mã hợp đồng</strong> — Dùng để quản lý nội bộ, không ảnh hưởng AI</li>
              <li><strong>Lĩnh vực</strong> — Giúp AI hiểu ngữ cảnh ngành nghề</li>
              <li><strong>Mô tả</strong> — Thông tin chi tiết về sản phẩm, dịch vụ, đặc điểm nổi bật. Càng chi tiết, bài viết càng sát thực tế</li>
            </ul>
          </Step>
          <Note type="blue">Phần <strong>Mô tả</strong> là quan trọng nhất — AI sẽ đọc toàn bộ nội dung này để viết bài cá nhân hóa. Nên ghi rõ: sản phẩm/dịch vụ chính, điểm mạnh, thông tin liên hệ, địa chỉ...</Note>
        </Section>

        {/* ── SECTION 3: Từ khóa ── */}
        <Section icon={<Search />} title="Bước 3 — Quản lý Từ khóa SEO" color="var(--accent)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Từ khóa là trung tâm của hệ thống. Mỗi từ khóa sẽ được AI phân tích và tạo ra nhiều tiêu đề bài viết khác nhau.
          </div>
          <Step n="1" title="Thêm từ khóa mới">
            Nhấn <Tag>Thêm Từ Khóa</Tag>, chọn công ty áp dụng và nhập từ khóa SEO mục tiêu. Ví dụ: <em>"thiết kế nội thất chung cư cao cấp"</em>, <em>"dịch vụ kế toán doanh nghiệp"</em>...
          </Step>
          <Step n="2" title="Chế độ AI sinh tiêu đề tự động">
            Để trống ô <em>Tiêu đề có sẵn</em> → chọn số lượng tiêu đề (1–30) → nhấn <Tag>Phân Tích Ngay</Tag>. AI sẽ:
            <ul style={{ marginTop: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <li>Nếu có SerpAPI: phân tích top 5 kết quả Google trước, rồi sinh tiêu đề dựa trên ngữ cảnh thực tế</li>
              <li>Nếu không có SerpAPI: dùng kiến thức chuyên sâu để sinh tiêu đề đa dạng góc độ</li>
            </ul>
          </Step>
          <Step n="3" title="Chế độ nhập tiêu đề thủ công">
            Nếu đã có sẵn tiêu đề, điền vào ô <em>Tiêu đề có sẵn</em> — mỗi dòng 1 tiêu đề. Hệ thống sẽ lưu ngay, không gọi AI, không tốn token.
          </Step>
          <Note type="blue">Sau khi tạo, nhấn <strong>Chi tiết</strong> để xem danh sách tiêu đề và bắt đầu viết bài cho từng tiêu đề.</Note>
        </Section>

        {/* ── SECTION 4: Viết bài ── */}
        <Section icon={<FileText />} title="Bước 4 — Viết Bài SEO" color="var(--success)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Có hai cách viết bài: viết lẻ từng bài (realtime) và viết hàng loạt (Batch API).
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text-primary)' }}>Viết lẻ (Realtime)</div>
          <Step n="1" title="Chọn tiêu đề cần viết">
            Trong trang chi tiết từ khóa, tiêu đề nào chưa có bài (<Tag color="var(--text-muted)">Chưa viết</Tag>) thì nhấn <Tag color="var(--success)">Viết bài</Tag>.
          </Step>
          <Step n="2" title="Chờ AI xử lý">
            Gemini sẽ viết bài hoàn chỉnh gồm: nội dung Markdown ~1000 từ, SEO Title (50–60 ký tự), Meta Description (150–160 ký tự), và Image Prompts cho từng section.
          </Step>
          <Step n="3" title="Xem và sử dụng bài viết">
            Nhấn <Tag color="var(--accent)">Xem bài</Tag> để đọc nội dung. Trang xem bài hiển thị đầy đủ <strong>SEO Title</strong>, <strong>Meta Description</strong> kèm số ký tự để kiểm tra chuẩn SEO, và nội dung bài được render HTML.
          </Step>

          <div style={{ fontWeight: 700, fontSize: 13, margin: '16px 0 10px', color: 'var(--text-primary)' }}>Viết lại bài</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Nhấn <Tag color="var(--warning)">Viết lại</Tag> để xóa bài cũ và yêu cầu AI viết bản mới. Bài cũ bị xóa trước, sau đó modal viết bài mở ra tự động.
          </div>

          <Note type="yellow">Cả viết lẻ lẫn Batch đều bị giới hạn bởi <strong>Giới hạn Bài Viết/Ngày</strong>. Biến đếm không reset khi xóa bài — xóa rồi viết lại vẫn tính vào quota.</Note>
        </Section>

        {/* ── SECTION 5: Batch Jobs ── */}
        <Section icon={<Layers />} title="Bước 5 — Batch Jobs (Viết hàng loạt)" color="var(--warning)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Batch API gửi toàn bộ tiêu đề lên Gemini xử lý nền, giá rẻ hơn 50% so với realtime. Phù hợp khi cần viết nhiều bài cùng lúc.
          </div>
          <Step n="1" title="Gửi Batch Job">
            Trong trang chi tiết từ khóa, nếu còn tiêu đề chưa có bài → nhấn <Tag color="var(--warning)">Viết Tất Cả — Batch</Tag>. Hệ thống gom tất cả tiêu đề chưa viết và gửi lên Gemini một lần. Số tiêu đề trong batch <strong>không được vượt quá số bài còn lại trong hạn mức hôm nay</strong> — nếu vượt, hệ thống sẽ báo lỗi kèm số bài còn được phép.
          </Step>
          <Step n="2" title="Chờ Gemini xử lý">
            Gemini xử lý batch trong nền, thường từ <strong>vài phút đến vài giờ</strong> tùy số lượng bài. Bạn có thể đóng trình duyệt, server vẫn tự kiểm tra.
          </Step>
          <Step n="3" title="Theo dõi tại trang Batch Jobs">
            Vào menu <Tag color="var(--warning)">Batch Jobs</Tag> để xem trạng thái. Các trạng thái Gemini:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><Tag color="var(--warning)">Đang chờ trong hàng</Tag> — Gemini chưa bắt đầu xử lý</li>
              <li><Tag color="var(--accent)">Gemini đang xử lý</Tag> — Đang chạy, chờ tiếp</li>
              <li><Tag color="var(--success)">Hoàn thành</Tag> — Đã xử lý xong, sẵn sàng import</li>
            </ul>
          </Step>
          <Step n="4" title="Import kết quả">
            Server tự động import mỗi <strong>60 phút</strong>. Hoặc nhấn <Tag color="var(--warning)">Kiểm tra Tất Cả Ngay</Tag> để import ngay lập tức. Sau khi import, bài viết xuất hiện trong trang Từ Khóa.
          </Step>
          <Note type="yellow">Batch Jobs <strong>cũng bị giới hạn</strong> bởi cài đặt Giới hạn Bài Viết/Ngày — số tiêu đề trong batch không được vượt quota còn lại trong ngày. Nếu cần viết nhiều hơn, hãy tăng giới hạn trong Cài đặt hoặc chờ reset lúc 0:00.</Note>
          <Note type="yellow">Nếu muốn gửi lại một batch job: <strong>Xóa job cũ</strong> tại trang Batch Jobs → quay về Từ Khóa → nhấn "Viết Tất Cả" lại.</Note>
        </Section>

        {/* ── SECTION 6: Cài đặt ── */}
        <Section icon={<Settings />} title="Cài đặt — Giới hạn tài nguyên" color="var(--text-secondary)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Tab <strong>Cài Đặt</strong> giúp kiểm soát lượng token và số bài viết mỗi ngày để tránh phát sinh chi phí ngoài ý muốn.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Zap size={14} color="var(--accent)" />
                <strong style={{ fontSize: 13 }}>Giới hạn Token / Ngày</strong>
                <Tag color="var(--text-muted)">0 = không giới hạn</Tag>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tổng token (input + output) được phép dùng trong ngày. Gemini Flash ~0.075–0.3 USD / 1M tokens. Mỗi bài viết tiêu thụ khoảng 2,000–4,000 tokens.</div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <FileText size={14} color="var(--success)" />
                <strong style={{ fontSize: 13 }}>Giới hạn Bài Viết / Ngày</strong>
                <Tag color="var(--text-muted)">0 = không giới hạn</Tag>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Số bài tối đa được viết mỗi ngày, áp dụng cho cả viết lẻ lẫn Batch API. Biến đếm tăng mỗi lần viết thành công và <strong>không giảm khi xóa bài</strong>. Reset tự động lúc 0:00 hàng ngày.</div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Clock size={14} color="var(--warning)" />
                <strong style={{ fontSize: 13 }}>Sử dụng hôm nay</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Hiển thị token đã dùng và số bài đã viết hôm nay kèm thanh progress. Màu <span style={{ color: 'var(--success)', fontWeight: 600 }}>xanh</span> = bình thường, <span style={{ color: 'var(--warning)', fontWeight: 600 }}>vàng</span> = gần giới hạn, <span style={{ color: 'var(--danger)', fontWeight: 600 }}>đỏ</span> = đã vượt 90%.</div>
            </div>
          </div>
        </Section>

        {/* ── SECTION 7: Câu hỏi thường gặp ── */}
        <Section icon={<Info />} title="Câu hỏi thường gặp" color="var(--info)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              {
                q: 'Tôi không có SerpAPI, có dùng được không?',
                a: 'Có. SerpAPI là tùy chọn. Không có SerpAPI, AI vẫn tự sinh tiêu đề dựa trên kiến thức SEO chuyên sâu và hiểu biết về thị trường Việt Nam. Chất lượng tiêu đề vẫn tốt, chỉ thiếu dữ liệu thực tế từ Google Search.'
              },
              {
                q: 'Làm sao tránh SerpAPI bị hết lượt khi dùng nhiều?',
                a: 'Nhập nhiều key cách nhau bởi dấu phẩy trong ô SerpAPI Key (ví dụ: key1,key2,key3). Mỗi lần gọi hệ thống sẽ chọn ngẫu nhiên 1 key để phân tải đều. Nếu key được chọn trả về lỗi, hệ thống tự thử các key còn lại trước khi bỏ qua. Cách này giúp tận dụng hết quota của nhiều tài khoản SerpAPI mà không cần cấu hình thêm gì.'
              },
              {
                q: 'Bài viết có chuẩn SEO không?',
                a: 'AI được chỉ dẫn cụ thể: từ khóa chính xuất hiện trong ít nhất 2 tiêu đề H2, mật độ từ khóa 1–1.5%, có CTA cuối bài, chèn link về website công ty, thêm thông tin liên hệ, độ dài ~1000 từ. SEO Title 50–60 ký tự, Meta Description 150–160 ký tự.'
              },
              {
                q: 'Batch API khác gì viết lẻ?',
                a: 'Batch API gửi tất cả bài lên Gemini xử lý nền, giá rẻ hơn 50% nhưng không có kết quả ngay — thường từ vài phút đến vài giờ. Viết lẻ (realtime) có kết quả trong 10–30 giây nhưng tốn chi phí hơn. Cả hai đều bị kiểm soát bởi giới hạn bài viết/ngày — khi submit batch, số tiêu đề không được vượt quota còn lại trong ngày.'
              },
              {
                q: 'Tôi xóa bài rồi viết lại có bị tính vào giới hạn không?',
                a: 'Có. Giới hạn bài viết/ngày được tính theo số lần viết thực tế (lưu trong bảng token_usage), không phải số bài hiện có. Xóa bài không làm giảm biến đếm — đây là cơ chế chống lách giới hạn.'
              },
              {
                q: 'Cấu hình API Key ở đâu?',
                a: 'Vào menu Cài đặt → tab Cấu hình API. Key được lưu vào database, có hiệu lực ngay mà không cần restart server. Ngoài ra có thể đặt trong file .env ở thư mục server/ — database sẽ ưu tiên hơn .env.'
              },
              {
                q: 'Image Prompts là gì?',
                a: 'Mỗi bài viết AI tạo kèm các prompt tiếng Anh để tạo ảnh minh họa — 1 ảnh đại diện (Feature Image) + 1 ảnh cho mỗi H2. Bạn copy prompt này vào các công cụ tạo ảnh AI như Midjourney, DALL-E, hoặc Stable Diffusion.'
              },
            ].map(({ q, a }, i) => (
              <div key={i} style={{ borderBottom: i < 6 ? '1px solid var(--border)' : 'none', paddingBottom: i < 6 ? 14 : 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--text-primary)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>Q.</span> {q}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: 20 }}>
                  {a}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer note */}
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-muted)' }}>
          AutoSEO — Powered by Google Gemini AI
        </div>

      </div>
    </div>
  );
}
