import React, { useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, Building2, Search, FileText,
  Layers, Settings, KeyRound, Zap, AlertTriangle, CheckCircle2,
  ArrowRight, Info, Hash, Clock, Users, ListOrdered, BarChart2,
  RefreshCw, Copy, ShieldCheck, Upload, Globe, Link, Send,
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
      {open && <div style={{ padding: '20px 24px', background: 'var(--bg-panel)' }}>{children}</div>}
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
    blue:   { cls: 'info-box-blue',   icon: <Info size={14} /> },
    green:  { cls: 'info-box-green',  icon: <CheckCircle2 size={14} /> },
    yellow: { cls: 'info-box-yellow', icon: <AlertTriangle size={14} /> },
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

function SubHead({ children }) {
  return (
    <div style={{ fontWeight: 700, fontSize: 13, margin: '18px 0 10px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
      {children}
    </div>
  );
}

function CodeBox({ children }) {
  return (
    <div style={{ margin: '8px 0', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}>
      {children}
    </div>
  );
}

function FieldRow({ name, desc }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <code style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--bg-panel)', padding: '2px 8px', borderRadius: 4, flexShrink: 0, alignSelf: 'flex-start' }}>{name}</code>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</span>
    </div>
  );
}

export default function Help() {
  return (
    <div className="page-content">
      <div style={{ margin: '0 auto' }}>

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
            AutoSEO là công cụ tự động hóa quy trình tạo nội dung SEO, sử dụng <strong>Google Gemini AI</strong> để sinh tiêu đề và viết bài chuẩn SEO theo thông tin từng doanh nghiệp. Hệ thống hỗ trợ 3 chế độ viết bài: viết lẻ realtime, hàng đợi SSE, và <strong>Gemini Batch API</strong> (giảm 50% chi phí). Sau khi bài được tạo, có thể <strong>đăng lên hệ thống bên thứ 3</strong> qua API tự động hoặc thủ công. Hỗ trợ một hay nhiều Gemini API Key với cơ chế <strong>xoay vòng tự động</strong>.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {[
              { icon: <Building2 size={12} />, label: 'Quản lý Công ty' },
              { icon: <Search size={12} />, label: 'Từ khóa SEO' },
              { icon: <FileText size={12} />, label: 'Viết bài tự động' },
              { icon: <ListOrdered size={12} />, label: 'Hàng đợi SSE' },
              { icon: <Layers size={12} />, label: 'Batch API' },
              { icon: <Upload size={12} />, label: 'Đăng bài tự động' },
              { icon: <Users size={12} />, label: 'Quản lý User' },
              { icon: <BarChart2 size={12} />, label: 'Thống kê Token' },
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
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {[
              { icon: <Building2 size={13} />, label: 'Thêm Công ty', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.35)' },
              { icon: <Search size={13} />, label: 'Thêm Từ khóa', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)' },
              { icon: <Hash size={13} />, label: 'AI sinh Tiêu đề', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)' },
              { icon: <FileText size={13} />, label: 'Viết Bài', color: '#16a34a', bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.35)' },
              { icon: <Layers size={13} />, label: 'Batch (tùy chọn)', color: '#b45309', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
              { icon: <Upload size={13} />, label: 'Đăng API', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.35)' },
            ].map(({ icon, label, color, bg, border }, i) => (
              <React.Fragment key={label}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, background: bg, border: `1px solid ${border}`, fontSize: 13, fontWeight: 600, color }}>
                  {icon} {label}
                </div>
                {i < 5 && <ArrowRight size={14} color="var(--text-muted)" />}
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
            <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={12} /> Xoay vòng nhiều key (Key Rotation)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Hỗ trợ nhập <strong>nhiều key Gemini cách nhau bởi dấu phẩy</strong>. Mỗi lần gọi AI, hệ thống tự xoay vòng (round-robin) lần lượt qua từng key — giúp phân tải đều, tránh bị giới hạn rate của một key đơn:
              </div>
              <CodeBox>AIza111...,AIza222...,AIza333...</CodeBox>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Badge <strong>N keys</strong> hiển thị trên ô cấu hình khi có nhiều key. Khi bật "Hiện key", danh sách từng key được liệt kê kèm preview đầu/cuối để dễ kiểm tra.
              </div>
            </div>
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
            Nếu có SerpAPI key (<strong>serpapi.com</strong>), hệ thống sẽ lấy dữ liệu kết quả tìm kiếm Google thực tế để AI sinh tiêu đề chính xác hơn. Nếu không có, AI vẫn tự sinh tiêu đề dựa trên kiến thức chuyên sâu về SEO và thị trường Việt Nam.
          </Step>

          <Note type="green">Cấu hình được lưu vào database, có hiệu lực ngay — không cần restart server. Key được ẩn (blur) trên giao diện, nhấn icon mắt để xem.</Note>
          <Note type="blue">Nếu hệ thống bật xác thực (AUTH), mỗi user có thể cấu hình API key cá nhân riêng. Key cá nhân được ưu tiên hơn key hệ thống và không bị giới hạn token/bài.</Note>
        </Section>

        {/* ── SECTION 2: Công ty ── */}
        <Section icon={<Building2 />} title="Bước 2 — Quản lý Website / Công ty" color="var(--info)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Mỗi bài viết được cá nhân hóa theo thông tin công ty. AI dùng dữ liệu này để viết bài phù hợp với thương hiệu, sản phẩm và phong cách của từng đơn vị.
          </div>
          <Step n="1" title="Thêm Website / Công ty">
            Nhấn <Tag color="var(--info)">Thêm Website</Tag> và điền đầy đủ thông tin:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>Tên công ty</strong> — Tên thương hiệu hiển thị trong bài viết</li>
              <li><strong>URL website</strong> — AI sẽ chèn link trỏ về đây trong bài; cũng dùng làm gốc URL khi đăng bài qua API</li>
              <li><strong>Mã hợp đồng</strong> — Gửi kèm payload khi đăng bài qua API (trường <code style={{ fontSize: 12 }}>ma_hd</code>)</li>
              <li><strong>Lĩnh vực</strong> — Giúp AI hiểu ngữ cảnh ngành nghề; cũng gửi kèm payload (trường <code style={{ fontSize: 12 }}>linh_vuc</code>)</li>
              <li><strong>Mô tả</strong> — Thông tin chi tiết về sản phẩm, dịch vụ, đặc điểm nổi bật. Càng chi tiết, bài viết càng sát thực tế</li>
            </ul>
          </Step>

          <SubHead><Upload size={14} color="#a78bfa" /> Cấu hình đăng bài tự động (per-company)</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
            Mỗi công ty có thể cấu hình riêng:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>API URL đăng bài (override)</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>URL endpoint riêng của công ty này. Nếu để trống, hệ thống dùng URL mặc định đã cài trong <Tag>Cài đặt</Tag>. URL của công ty luôn được ưu tiên hơn URL mặc định.</div>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Tự động đăng bài (Auto-publish)</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Khi bật, mỗi bài viết xong sẽ được tự động POST lên API ngay lập tức — không cần thao tác thủ công. Công ty bật Auto-publish hiển thị badge <Tag color="#a78bfa">Auto-post</Tag> trong danh sách.</div>
            </div>
          </div>

          <Note type="blue">Phần <strong>Mô tả</strong> là quan trọng nhất — AI đọc toàn bộ để cá nhân hóa bài viết. Nên ghi: sản phẩm/dịch vụ chính, điểm mạnh, thông tin liên hệ, địa chỉ...</Note>
          <Note type="yellow">Xóa công ty sẽ <strong>xóa toàn bộ</strong> từ khóa, tiêu đề và bài viết liên quan. Thao tác không thể hoàn tác.</Note>
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
              <li>Nếu có SerpAPI: phân tích top 5 kết quả Google, sinh tiêu đề dựa trên ngữ cảnh thực tế</li>
              <li>Nếu không có SerpAPI: dùng kiến thức SEO chuyên sâu để sinh tiêu đề đa dạng góc độ</li>
              <li>Số tiêu đề thực tế trả về đúng bằng số đã chọn (server cắt bớt nếu AI trả về dư)</li>
            </ul>
          </Step>
          <Step n="3" title="Chế độ nhập tiêu đề thủ công">
            Nếu đã có sẵn tiêu đề, điền vào ô <em>Tiêu đề có sẵn</em> — mỗi dòng 1 tiêu đề. Hệ thống lưu ngay, không gọi AI, không tốn token.
          </Step>
          <Note type="blue">Danh sách từ khóa hiển thị số tiêu đề và số bài đã viết. Nhấn tên từ khóa để vào trang chi tiết và quản lý từng tiêu đề.</Note>
        </Section>

        {/* ── SECTION 4: Viết bài ── */}
        <Section icon={<FileText />} title="Bước 4 — Viết Bài SEO" color="var(--success)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Có <strong>3 chế độ viết bài</strong>. Mỗi chế độ phù hợp với tình huống khác nhau.
          </div>

          {/* Viết lẻ */}
          <SubHead><FileText size={14} color="var(--success)" /> Chế độ 1 — Viết lẻ (Realtime)</SubHead>
          <Step n="1" title="Chọn tiêu đề cần viết">
            Trong trang chi tiết từ khóa, tiêu đề nào chưa có bài → nhấn <Tag color="var(--success)">Viết bài</Tag>.
          </Step>
          <Step n="2" title="Chờ AI xử lý">
            Gemini viết bài hoàn chỉnh: nội dung ~1000 từ, SEO Title (50–60 ký tự), Meta Description (150–160 ký tự), Từ khóa, Image Prompts cho từng section. Thường mất 10–30 giây.
          </Step>
          <Step n="3" title="Xem bài viết">
            Nhấn <Tag color="var(--accent)">Xem bài</Tag>. Panel bên phải hiển thị <strong>SEO Title</strong>, <strong>Meta Description</strong>, <strong>Từ khóa</strong> — tất cả đều có nút <Copy size={11} style={{ display: 'inline' }} /> copy nhanh. Nội dung bài được render HTML đầy đủ.
          </Step>

          {/* SSE Queue */}
          <SubHead><ListOrdered size={14} color="var(--accent)" /> Chế độ 2 — Hàng Đợi SSE (Viết tuần tự, realtime)</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
            Nhấn <Tag color="var(--accent)">Hàng Đợi SSE</Tag> để viết lần lượt tất cả tiêu đề chưa có bài. Bài viết hoàn chỉnh <strong>ngay sau khi mỗi bài xong</strong>, không cần chờ toàn bộ.
          </div>
          <ul style={{ paddingLeft: 22, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <li>Thanh tiến trình hiển thị real-time: bài đang viết, đã xong bao nhiêu, còn bao nhiêu</li>
            <li>Có thể nhấn <Tag color="var(--danger)">Dừng</Tag> để dừng sau bài đang viết</li>
            <li>Bài nào viết xong hiện lên danh sách ngay, không cần refresh</li>
            <li>Chi phí tương đương viết lẻ (realtime), nhưng không cần thao tác từng tiêu đề</li>
          </ul>

          {/* Batch */}
          <SubHead><Layers size={14} color="var(--warning)" /> Chế độ 3 — Batch API (Xử lý nền, rẻ hơn 50%)</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
            Nhấn <Tag color="var(--warning)">Batch API</Tag> để gửi toàn bộ tiêu đề lên Gemini xử lý nền. Không có kết quả ngay — Gemini xử lý từ vài phút đến vài giờ. Chi tiết xem <strong>Bước 5</strong>.
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)', border: '1px solid var(--border)', marginTop: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>So sánh 3 chế độ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
              {[
                { label: 'Viết lẻ', speed: '10–30s/bài', cost: 'Đầy đủ', tag: 'Từng bài', tagColor: 'var(--success)' },
                { label: 'Hàng đợi SSE', speed: '~10–30s/bài', cost: 'Đầy đủ', tag: 'Tự động', tagColor: 'var(--accent)' },
                { label: 'Batch API', speed: 'Vài phút–giờ', cost: 'Giảm 50%', tag: 'Nền', tagColor: 'var(--warning)' },
              ].map(({ label, speed, cost, tag, tagColor }) => (
                <div key={label} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-content)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}><Tag color={tagColor}>{tag}</Tag></div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
                  <div style={{ color: 'var(--text-muted)' }}>⏱ {speed}</div>
                  <div style={{ color: 'var(--text-muted)' }}>💰 {cost}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, margin: '18px 0 8px', color: 'var(--text-primary)' }}>Viết lại bài</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Nhấn <Tag color="var(--warning)">Viết lại</Tag> để xóa bài cũ và viết bản mới. Bài cũ bị xóa trước, sau đó modal viết bài mở tự động.
          </div>

          <Note type="yellow">Tất cả chế độ đều bị giới hạn bởi <strong>Giới hạn Bài Viết/Ngày</strong>. Biến đếm không giảm khi xóa bài — xóa rồi viết lại vẫn tính vào quota.</Note>
          <Note type="blue">Khi admin viết bài giùm user (viết từ tài khoản admin trong context keyword của user), bài viết sẽ hiển thị đầy đủ trên giao diện của user.</Note>
        </Section>

        {/* ── SECTION 5: Batch Jobs ── */}
        <Section icon={<Layers />} title="Bước 5 — Batch Jobs (Chi tiết)" color="var(--warning)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Batch API gửi toàn bộ tiêu đề lên Gemini xử lý nền, giá rẻ hơn 50% so với realtime. Phù hợp khi cần viết nhiều bài và không cần kết quả ngay lập tức.
          </div>
          <Step n="1" title="Gửi Batch Job">
            Trong trang chi tiết từ khóa, nếu còn tiêu đề chưa có bài → nhấn <Tag color="var(--warning)">Batch API</Tag>. Hệ thống gom tất cả tiêu đề chưa viết và gửi lên Gemini một lần. Số tiêu đề <strong>không được vượt quá quota còn lại hôm nay</strong> — nếu vượt, hệ thống báo lỗi kèm số bài còn được phép.
          </Step>
          <Step n="2" title="Chờ Gemini xử lý">
            Gemini xử lý batch trong nền, thường từ <strong>vài phút đến vài giờ</strong> tùy số lượng. Có thể đóng trình duyệt — server vẫn tự kiểm tra.
          </Step>
          <Step n="3" title="Theo dõi tại trang Batch Jobs">
            Vào menu <Tag color="var(--warning)">Batch Jobs</Tag> để xem trạng thái. Các trạng thái Gemini:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><Tag color="var(--warning)">Đang chờ trong hàng</Tag> — Gemini chưa bắt đầu</li>
              <li><Tag color="var(--accent)">Gemini đang xử lý</Tag> — Đang chạy, chờ tiếp</li>
              <li><Tag color="var(--success)">Hoàn thành</Tag> — Đã xong, sẵn sàng import</li>
            </ul>
          </Step>
          <Step n="4" title="Import kết quả">
            Server tự động import mỗi <strong>60 phút</strong>. Hoặc nhấn <Tag color="var(--warning)">Kiểm tra Tất Cả Ngay</Tag> để import ngay. Sau khi import, bài viết xuất hiện trong trang Từ Khóa.
          </Step>
          <Note type="yellow">Nếu muốn gửi lại: <strong>Xóa job cũ</strong> tại trang Batch Jobs → quay về Từ Khóa → nhấn "Batch API" lại.</Note>
        </Section>

        {/* ── SECTION 6: Publish API ── */}
        <Section icon={<Upload />} title="Bước 6 — Đăng Bài Lên API Bên Thứ 3" color="#a78bfa">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Sau khi bài được viết, hệ thống có thể <strong>tự động hoặc thủ công POST</strong> bài lên hệ thống bên thứ 3 qua API. Hỗ trợ 3 hình thức: đăng từng bài, đăng hàng loạt, và tự động sau khi viết xong.
          </div>

          {/* Cấu hình API URL */}
          <SubHead><Settings size={14} color="#a78bfa" /> Cấu hình API URL</SubHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>URL mặc định toàn hệ thống</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cài tại <Tag>Cài đặt</Tag> → tab <Tag>Cài Đặt</Tag> → mục "API URL Đăng Bài (Mặc Định)". Áp dụng cho tất cả công ty không có URL riêng.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
              <ArrowRight size={12} /> URL của công ty <strong>luôn ưu tiên hơn</strong> URL mặc định hệ thống
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>URL riêng theo từng công ty</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cài trong <Tag>Website / Công ty</Tag> → Chỉnh sửa → trường "API URL Đăng Bài". Nếu nhập URL này, chỉ bài của công ty đó dùng URL riêng.</div>
            </div>
          </div>

          {/* 3 hình thức đăng */}
          <SubHead><Send size={14} color="#a78bfa" /> 3 hình thức đăng bài</SubHead>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>1</span>
                Đăng từng bài (thủ công)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Trong chi tiết từ khóa, bài nào chưa được đăng sẽ có nút <Tag color="#a78bfa">Post</Tag>. Nhấn để đăng ngay. Nếu lần trước lỗi, nút đổi thành <Tag color="var(--warning)">Thử lại</Tag>.
              </div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>2</span>
                Đăng hàng loạt (batch publish)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Nhấn nút <Tag color="#a78bfa">Post hàng loạt</Tag> trên toolbar (chỉ hiện khi không có hàng đợi SSE đang chạy). Hệ thống tìm tất cả bài chưa đăng trong từ khóa và POST lên API lần lượt. Kết quả thành công/thất bại hiển thị ngay sau khi xong.
              </div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>3</span>
                Tự động sau khi viết (Auto-publish)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Bật công tắc <strong>Tự động đăng bài</strong> trong cài đặt công ty. Mỗi khi bài được viết xong (realtime, SSE, hoặc batch import), server tự động POST lên API — không cần thao tác thủ công. Kết quả hiển thị badge <Tag color="var(--success)">Đã post #ID</Tag> ngay trên giao diện.
              </div>
            </div>
          </div>

          {/* Payload */}
          <SubHead><Globe size={14} color="#a78bfa" /> Cấu trúc dữ liệu gửi đi (JSON Payload)</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Mỗi request là HTTP POST với <code style={{ fontSize: 12 }}>Content-Type: application/json</code>. Payload gồm:
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 12 }}>
            <FieldRow name="title_seo" desc="SEO Title của bài viết (50–60 ký tự)" />
            <FieldRow name="des_seo" desc="Meta Description của bài viết (150–160 ký tự)" />
            <FieldRow name="link_seo" desc="URL bài viết = URL website công ty + slug của tiêu đề (VD: https://example.com/thiet-ke-noi-that)" />
            <FieldRow name="tukhoa_seo" desc="Từ khóa SEO chính (từ khóa đã đặt trong hệ thống)" />
            <FieldRow name="content_seo" desc="Nội dung bài viết đầy đủ dạng HTML" />
            <FieldRow name="ma_hd" desc="Mã hợp đồng của công ty" />
            <FieldRow name="linh_vuc" desc="Lĩnh vực hoạt động của công ty" />
            <FieldRow name="email" desc="Email của user đã tạo từ khóa (lấy từ bảng users theo người tạo keyword)" />
          </div>
          <CodeBox>{`{
  "title_seo":   "Thiết Kế Nội Thất Chung Cư Cao Cấp - Xu Hướng 2024",
  "des_seo":     "Khám phá xu hướng thiết kế nội thất chung cư cao cấp...",
  "link_seo":    "https://noidecor.vn/thiet-ke-noi-that-chung-cu-cao-cap",
  "tukhoa_seo":  "thiết kế nội thất chung cư",
  "content_seo": "<h1>...</h1><p>...</p>...",
  "ma_hd":       "HD-2024-001",
  "linh_vuc":    "Nội thất",
  "email":       "user@example.com"
}`}</CodeBox>

          {/* Trạng thái */}
          <SubHead><CheckCircle2 size={14} color="var(--success)" /> Trạng thái bài sau khi đăng</SubHead>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Chưa đăng', color: 'var(--text-muted)', desc: 'Bài chưa được POST lên API' },
              { label: 'Đã post #ID', color: 'var(--success)', desc: 'Đã đăng thành công, có ID từ hệ thống đối tác' },
              { label: 'Lỗi post', color: 'var(--danger)', desc: 'API trả về lỗi, có thể thử lại' },
            ].map(({ label, color, desc }) => (
              <div key={label} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-panel)', border: '1px solid var(--border)', fontSize: 12 }}>
                <div style={{ fontWeight: 700, color, marginBottom: 4 }}>{label}</div>
                <div style={{ color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            ))}
          </div>

          <Note type="green">API bên thứ 3 cần trả về JSON có trường <code style={{ fontSize: 12 }}>id</code>, <code style={{ fontSize: 12 }}>ID</code>, hoặc <code style={{ fontSize: 12 }}>post_id</code> — hệ thống sẽ lưu làm External ID và hiển thị kèm badge "Đã post".</Note>
          <Note type="yellow">Hiện tại chưa có xác thực (auth) khi gọi API bên thứ 3. Tính năng xác thực sẽ được bổ sung sau. Đảm bảo API endpoint của bạn chấp nhận request không cần token nếu muốn dùng ngay.</Note>
          <Note type="blue">Nếu chưa cấu hình URL nào (cả hệ thống lẫn công ty), nút Post và Post hàng loạt sẽ báo lỗi <em>"Chưa cấu hình API URL"</em>.</Note>
        </Section>

        {/* ── SECTION 7: Quản lý User (admin) ── */}
        <Section icon={<Users />} title="Quản lý Tài khoản (Admin)" color="var(--info)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Khi hệ thống bật xác thực (<code style={{ background: 'var(--bg-panel)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>AUTH_ENABLED=true</code>), admin có thể quản lý tài khoản người dùng tại menu <Tag color="var(--info)">Tài khoản</Tag>.
          </div>

          <SubHead><ShieldCheck size={14} color="var(--info)" /> Thông tin tài khoản</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            Mỗi user có các thông tin: <strong>Tên đăng nhập</strong>, <strong>Họ tên</strong> (full_name), <strong>Email</strong>, <strong>Số điện thoại</strong>, vai trò (<em>admin / user</em>), trạng thái (<em>hoạt động / tạm khóa</em>).
            Họ tên được ưu tiên hiển thị trên header và trong danh sách thay cho username.
          </div>

          <SubHead><KeyRound size={14} color="var(--danger)" /> Cấu hình API & giới hạn per-user</SubHead>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'API key riêng', desc: 'User nhập Gemini API key cá nhân trong Cài đặt. Khi có key riêng, hệ thống dùng key đó — không bị giới hạn token/bài và không ảnh hưởng key hệ thống.' },
              { label: 'Dùng key hệ thống', desc: 'Admin bật "Cho phép dùng key hệ thống" cho từng user. Khi bật, user dùng key hệ thống nhưng bị giới hạn bởi token/bài đã cài đặt.' },
              { label: 'Giới hạn Token/Ngày', desc: 'Giới hạn token riêng cho user này (0 = theo hệ thống).' },
              { label: 'Giới hạn Bài Viết/Ngày', desc: 'Số bài tối đa user được viết mỗi ngày (0 = theo hệ thống).' },
            ].map(({ label, desc }) => (
              <div key={label} style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{desc}</div>
              </div>
            ))}
          </div>

          <Note type="blue">Admin viết bài cho keyword của user (từ danh sách user, hoặc khi lọc theo user) — bài viết sẽ hiển thị đầy đủ trong giao diện của user đó, không bị ẩn.</Note>
          <Note type="yellow">User bị tạm khóa (<em>is_active = false</em>) không thể đăng nhập cho đến khi được admin kích hoạt lại.</Note>
        </Section>

        {/* ── SECTION 8: Cài đặt ── */}
        <Section icon={<Settings />} title="Cài đặt — Giới hạn & Thống kê" color="var(--text-secondary)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Tab <strong>Cài Đặt</strong> kiểm soát token và số bài viết mỗi ngày để tránh phát sinh chi phí ngoài ý muốn.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Zap size={14} color="var(--accent)" />
                <strong style={{ fontSize: 13 }}>Giới hạn Token / Ngày</strong>
                <Tag color="var(--text-muted)">0 = không giới hạn</Tag>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tổng token (input + output) trong ngày. Gemini Flash ~0.075–0.3 USD / 1M tokens. Mỗi bài viết ~2,000–4,000 tokens.</div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <FileText size={14} color="var(--success)" />
                <strong style={{ fontSize: 13 }}>Giới hạn Bài Viết / Ngày</strong>
                <Tag color="var(--text-muted)">0 = không giới hạn</Tag>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Áp dụng cho cả 3 chế độ viết bài. Biến đếm tăng mỗi lần viết thành công và <strong>không giảm khi xóa bài</strong>. Reset lúc 0:00 hàng ngày.</div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Upload size={14} color="#a78bfa" />
                <strong style={{ fontSize: 13 }}>API URL Đăng Bài (Mặc Định)</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>URL endpoint bên thứ 3 mà hệ thống sẽ POST bài đến. Dùng cho các công ty không có URL riêng. Để trống nếu chưa cấu hình.</div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Clock size={14} color="var(--warning)" />
                <strong style={{ fontSize: 13 }}>Sử dụng hôm nay</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Hiển thị token và bài đã dùng kèm thanh progress. <span style={{ color: 'var(--success)', fontWeight: 600 }}>Xanh</span> = bình thường, <span style={{ color: 'var(--warning)', fontWeight: 600 }}>vàng</span> = gần giới hạn, <span style={{ color: 'var(--danger)', fontWeight: 600 }}>đỏ</span> = &gt;90%.</div>
            </div>
          </div>

          <SubHead><BarChart2 size={14} color="var(--accent)" /> Thống kê Token</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Menu <Tag>Thống kê</Tag> hiển thị lịch sử sử dụng token theo ngày, theo loại (tiêu đề / bài viết / batch), ước tính chi phí theo USD. Có thể reset thống kê (chỉ xóa log, không ảnh hưởng bài viết).
          </div>
        </Section>

        {/* ── SECTION 9: Câu hỏi thường gặp ── */}
        <Section icon={<Info />} title="Câu hỏi thường gặp" color="var(--info)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              {
                q: 'Gemini API Key xoay vòng hoạt động như thế nào?',
                a: 'Nhập nhiều key Gemini cách nhau bởi dấu phẩy (VD: AIza111,AIza222,AIza333). Mỗi lần gọi AI, server dùng thuật toán round-robin — lần 1 dùng key 1, lần 2 dùng key 2... Đến cuối danh sách thì quay lại từ đầu. Cơ chế này phân tải đều giữa các key, giúp tránh bị rate limit khi viết nhiều bài liên tiếp.'
              },
              {
                q: 'Tôi không có SerpAPI, có dùng được không?',
                a: 'Có. SerpAPI là tùy chọn. Không có SerpAPI, AI vẫn tự sinh tiêu đề dựa trên kiến thức SEO chuyên sâu và hiểu biết về thị trường Việt Nam. Chất lượng tiêu đề vẫn tốt, chỉ thiếu ngữ cảnh thực tế từ Google Search.'
              },
              {
                q: 'Hàng đợi SSE khác gì Batch API?',
                a: 'Hàng đợi SSE viết bài tuần tự realtime — từng bài hoàn chỉnh ngay sau khi xong, có thể dừng giữa chừng, chi phí đầy đủ. Batch API gửi tất cả lên Gemini xử lý nền — kết quả sau vài phút đến vài giờ, rẻ hơn 50% nhưng không có kết quả ngay. Cả hai đều bị giới hạn bởi quota bài/ngày.'
              },
              {
                q: 'Bài viết có chuẩn SEO không?',
                a: 'AI được chỉ dẫn cụ thể: từ khóa chính trong ít nhất 2 H2, mật độ từ khóa 1–1.5%, có CTA cuối bài, chèn link website công ty, thêm thông tin liên hệ, độ dài ~1000 từ. SEO Title 50–60 ký tự, Meta Description 150–160 ký tự — đều có nút copy nhanh trên giao diện.'
              },
              {
                q: 'Đăng bài lên API bên thứ 3 hoạt động thế nào?',
                a: 'Hệ thống HTTP POST JSON payload đến URL đã cài đặt. Payload gồm: title_seo, des_seo, link_seo (URL công ty + slug tiêu đề), tukhoa_seo, content_seo, ma_hd (mã hợp đồng), linh_vuc, và email của người tạo từ khóa. API bên thứ 3 cần trả về 200 OK kèm JSON có trường id/ID/post_id để hiển thị External ID.'
              },
              {
                q: 'link_seo được tạo ra như thế nào?',
                a: 'link_seo = URL website công ty + "/" + slug của tiêu đề bài. Slug là tiêu đề được chuyển thành chữ thường, bỏ dấu tiếng Việt, thay khoảng trắng bằng dấu gạch ngang. VD: tiêu đề "Thiết Kế Nội Thất Chung Cư" → slug "thiet-ke-noi-that-chung-cu" → link_seo = "https://example.com/thiet-ke-noi-that-chung-cu".'
              },
              {
                q: 'Auto-publish và đăng thủ công khác nhau điểm nào?',
                a: 'Auto-publish: bật trong cài đặt công ty, mỗi bài được viết xong (bất kỳ chế độ nào) sẽ tự động POST lên API — không cần thao tác. Đăng thủ công: nhấn nút Post từng bài hoặc Post hàng loạt sau khi đã viết xong. Cả hai dùng cùng một payload và cùng API URL đã cấu hình.'
              },
              {
                q: 'Nếu đăng bài thất bại, có thử lại không?',
                a: 'Có. Bài bị lỗi sẽ hiển thị badge "Lỗi post" và nút "Thử lại" thay thế nút "Post". Nhấn "Thử lại" để gọi lại API. Nút "Post hàng loạt" chỉ gửi các bài chưa đăng (unpublished) và các bài lỗi — không gửi lại bài đã đăng thành công.'
              },
              {
                q: 'Admin viết bài giùm user có hiển thị cho user không?',
                a: 'Có. Khi admin viết bài trong context của một keyword thuộc user (ví dụ lọc theo user rồi viết), bài viết được lưu với companyId và keyword của user đó. Giao diện user fetch articles theo keyword + companyId (không lọc theo người viết), nên bài admin viết hiển thị đầy đủ cho user.'
              },
              {
                q: 'Tôi xóa bài rồi viết lại có bị tính vào giới hạn không?',
                a: 'Có. Giới hạn bài viết/ngày tính theo số lần viết thực tế (lưu trong token_usage), không phải số bài hiện có. Xóa bài không làm giảm biến đếm — đây là cơ chế chống lách giới hạn.'
              },
              {
                q: 'Image Prompts là gì?',
                a: 'Mỗi bài viết AI tạo kèm các prompt tiếng Anh để tạo ảnh minh họa — 1 ảnh đại diện (Feature Image) + 1 ảnh cho mỗi section H2. Copy prompt vào Midjourney, DALL-E, hoặc Stable Diffusion để tạo ảnh.'
              },
              {
                q: 'Cấu hình API Key ở đâu?',
                a: 'Vào menu Cài đặt → tab Cấu hình API. Key lưu vào database, có hiệu lực ngay không cần restart. Cũng có thể đặt trong file .env ở thư mục server/ — database ưu tiên hơn .env. Khi AUTH bật, mỗi user có thể đặt key cá nhân tại tab Cấu hình API trong Cài đặt của mình.'
              },
            ].map(({ q, a }, i, arr) => (
              <div key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i < arr.length - 1 ? 14 : 0 }}>
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

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-muted)' }}>
          AutoSEO — Hệ thống hỗ trợ viết bài chuẩn SEO tự động bằng AI cho website doanh nghiệp.
        </div>

      </div>
    </div>
  );
}
