import React, { useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, Building2, Search, FileText,
  Layers, Settings, KeyRound, Zap, AlertTriangle, CheckCircle2,
  ArrowRight, Info, Users, ListOrdered, BarChart2,
  Send, Globe, Brain, Target, Sparkles, LayoutList, MessageCircle, Trash2,
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

function Card({ title, desc, color = 'var(--border)' }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${color}`, background: 'var(--bg-panel)' }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</div>
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
            AutoSEO là công cụ tự động hóa toàn bộ quy trình sản xuất nội dung SEO cho website doanh nghiệp —
            từ nghiên cứu từ khóa, lên kế hoạch nội dung, đến viết bài hoàn chỉnh bằng <strong>Google Gemini AI</strong>.
            Mỗi bài viết được cá nhân hóa theo thông tin từng công ty, chuẩn SEO đầu ra với đầy đủ tiêu đề, mô tả và nội dung.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {[
              { icon: <Building2 size={12} />, label: 'Quản lý Công ty' },
              { icon: <Search size={12} />, label: 'Từ khóa SEO' },
              { icon: <FileText size={12} />, label: 'Viết bài tự động' },
              { icon: <LayoutList size={12} />, label: 'Keyword Planner' },
              { icon: <Globe size={12} />, label: 'Phân tích Website' },
              { icon: <Layers size={12} />, label: 'Xử lý hàng loạt' },
              { icon: <Send size={12} />, label: 'Đăng bài tự động' },
              { icon: <BarChart2 size={12} />, label: 'Thống kê' },
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
              { icon: <Search size={13} />, label: 'Nhập Từ khóa', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)' },
              { icon: <FileText size={13} />, label: 'AI Viết Bài', color: '#16a34a', bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.35)' },
              { icon: <Send size={13} />, label: 'Đăng lên Website', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
            ].map(({ icon, label, color, bg, border }, i) => (
              <React.Fragment key={label}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, background: bg, border: `1px solid ${border}`, fontSize: 13, fontWeight: 600, color }}>
                  {icon} {label}
                </div>
                {i < 3 && <ArrowRight size={14} color="var(--text-muted)" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── SECTION: Trợ lý AI ── */}
        <Section icon={<MessageCircle />} title="Trợ lý AI — Hỏi đáp tức thì" color="#06b6d4" defaultOpen>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Hệ thống có tích hợp <strong>trợ lý AI</strong> luôn sẵn sàng giải đáp mọi thắc mắc về cách sử dụng.
            Thay vì đọc toàn bộ tài liệu, bạn có thể hỏi trực tiếp và nhận câu trả lời ngay lập tức.
          </div>

          {/* Visual minh họa */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(6,182,212,0.2)', background: 'rgba(6,182,212,0.05)', marginBottom: 16 }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>AI</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#06b6d4', marginBottom: 6 }}>Trợ lý AutoSEO</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Xin chào! Tôi là trợ lý AutoSEO. Bạn có thể hỏi tôi về bất kỳ tính năng nào trong hệ thống —
                như cách viết bài, cài đặt API, sử dụng Keyword Planner, hay bất kỳ điều gì bạn chưa rõ.
              </div>
            </div>
          </div>

          <Step n="1" title="Mở trợ lý">
            Nhìn xuống góc <strong>dưới bên phải</strong> màn hình — nhấn vào biểu tượng chat <MessageCircle size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> để mở cửa sổ trợ lý.
            Biểu tượng này hiển thị trên tất cả các trang trong hệ thống.
          </Step>

          <Step n="2" title="Đặt câu hỏi">
            Gõ câu hỏi vào ô nhập liệu và nhấn <strong>Enter</strong> để gửi. Ví dụ câu hỏi bạn có thể hỏi:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                '"Làm sao để viết nhiều bài cùng lúc?"',
                '"Keyword Planner dùng để làm gì?"',
                '"Tại sao bài viết của tôi bị lỗi?"',
                '"Cách cài đặt tự động đăng bài?"',
                '"Sự khác nhau giữa Hàng đợi và Xử lý hàng loạt?"',
              ].map(q => (
                <li key={q} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{q}</li>
              ))}
            </ul>
          </Step>

          <Step n="3" title="Xóa cuộc trò chuyện">
            Nhấn biểu tượng <Trash2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> trên thanh tiêu đề cửa sổ trợ lý để bắt đầu cuộc trò chuyện mới. Lịch sử sẽ bị xóa và trợ lý trả lời từ đầu.
          </Step>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            <Card title="Enter — Gửi tin nhắn" desc="Nhấn Enter để gửi câu hỏi ngay lập tức." color="rgba(6,182,212,0.2)" />
            <Card title="Shift + Enter — Xuống dòng" desc="Giữ Shift rồi nhấn Enter để viết nhiều dòng trước khi gửi." color="rgba(6,182,212,0.2)" />
          </div>

          <Note type="blue">Trợ lý nhớ ngữ cảnh cuộc hội thoại — bạn có thể hỏi tiếp theo mà không cần nhắc lại câu trước. Ví dụ: hỏi "Keyword Planner là gì?" rồi tiếp "Vậy Pillar là gì?" trợ lý vẫn hiểu bạn đang hỏi về Keyword Planner.</Note>
          <Note type="yellow">Trợ lý chỉ giải đáp thắc mắc về cách sử dụng hệ thống — không thực hiện thao tác thay bạn như tạo bài hay xóa dữ liệu.</Note>
        </Section>

        {/* ── SECTION 1: API Keys ── */}
        <Section icon={<KeyRound />} title="Bước 1 — Cấu hình API Keys" color="var(--danger)" defaultOpen>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Trước khi sử dụng bất kỳ tính năng nào liên quan đến AI, bạn cần cung cấp ít nhất một <strong>Gemini API Key</strong>.
            Vào menu <Tag>Cài đặt</Tag> → tab <Tag>Cấu hình API</Tag> để thiết lập.
          </div>

          <Step n="1" title="Lấy Gemini API Key">
            Truy cập <strong>aistudio.google.com</strong> → đăng nhập bằng tài khoản Google → chọn <em>Get API Key</em> → tạo key mới.
            Copy key và dán vào ô <em>Gemini API Key</em> trong phần Cài đặt.
          </Step>

          <Step n="2" title="Nhập nhiều API Key (khuyến nghị)">
            Bạn có thể nhập nhiều key cách nhau bởi dấu phẩy. Hệ thống sẽ tự luân phiên sử dụng từng key —
            giúp viết nhiều bài liên tục mà không lo bị giới hạn tốc độ từ một key duy nhất.
          </Step>

          <Step n="3" title="Chọn Model AI">
            <ul style={{ marginTop: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>gemini-2.5-flash</strong> — Nhanh, chất lượng tốt <Tag color="var(--success)">Khuyên dùng</Tag></li>
              <li><strong>gemini-2.5-flash-lite</strong> — Nhanh nhất, chi phí thấp nhất</li>
              <li><strong>gemini-2.5-pro</strong> — Chất lượng bài viết cao nhất</li>
            </ul>
          </Step>

          <Step n="4" title="SerpAPI Key (không bắt buộc)">
            SerpAPI giúp AI tham khảo kết quả tìm kiếm Google thực tế khi sinh tiêu đề bài viết — cho ra tiêu đề sát xu hướng hơn.
            Không có SerpAPI, hệ thống vẫn hoạt động đầy đủ — AI tự sinh tiêu đề dựa trên kiến thức SEO chuyên sâu.
          </Step>

          <Note type="green">Cấu hình lưu ngay, có hiệu lực tức thì. Key được ẩn trên giao diện — nhấn icon mắt để xem nội dung.</Note>
          <Note type="blue">Mỗi người dùng có thể cấu hình API key cá nhân riêng. Key cá nhân được ưu tiên hơn key hệ thống.</Note>
        </Section>

        {/* ── SECTION 2: Công ty ── */}
        <Section icon={<Building2 />} title="Bước 2 — Quản lý Website / Công ty" color="var(--info)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Mỗi bài viết được AI cá nhân hóa theo thông tin công ty. Hệ thống hỗ trợ nhiều công ty — mỗi công ty có cấu hình riêng biệt.
          </div>

          <Step n="1" title="Thêm Website / Công ty mới">
            Nhấn <Tag color="var(--info)">Thêm Website</Tag> và điền thông tin:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>Tên công ty</strong> — Tên thương hiệu sẽ được đề cập trong bài viết</li>
              <li><strong>URL website</strong> — Địa chỉ website; AI sẽ chèn link trỏ về đây trong bài</li>
              <li><strong>Lĩnh vực</strong> — Ngành nghề hoạt động, giúp AI viết đúng chuyên môn</li>
              <li><strong>Mã hợp đồng</strong> — Dùng khi đăng bài tự động lên hệ thống đối tác</li>
              <li><strong>Mô tả</strong> — Thông tin chi tiết về sản phẩm, dịch vụ, điểm mạnh. <strong>Càng chi tiết, bài viết càng chính xác.</strong></li>
            </ul>
          </Step>

          <Step n="2" title="Cấu hình đăng bài tự động">
            Trong phần chỉnh sửa công ty, bạn có thể bật <strong>Tự động đăng bài</strong> — mỗi bài được viết xong sẽ tự động gửi lên hệ thống website đối tác mà không cần thao tác thủ công.
          </Step>

          <Note type="blue">Phần <strong>Mô tả</strong> là quan trọng nhất. Nên ghi rõ: sản phẩm/dịch vụ chính, điểm mạnh, thông tin liên hệ, địa chỉ, slogan nếu có.</Note>
          <Note type="yellow">Xóa công ty sẽ <strong>xóa toàn bộ</strong> từ khóa và bài viết liên quan. Thao tác không thể hoàn tác.</Note>
        </Section>

        {/* ── SECTION 3: Từ khóa ── */}
        <Section icon={<Search />} title="Bước 3 — Quản lý Từ khóa SEO" color="var(--accent)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Từ khóa là trung tâm của hệ thống. Mỗi từ khóa sẽ có nhiều tiêu đề bài viết và AI sẽ viết từng bài theo tiêu đề đó.
          </div>

          <Step n="1" title="Thêm từ khóa mới">
            Nhấn <Tag>Thêm Từ Khóa</Tag>, chọn công ty và nhập từ khóa SEO mục tiêu.
            Ví dụ: <em>"dịch vụ vận chuyển hàng đi Canada"</em>, <em>"thiết kế nội thất phòng khách"</em>...
          </Step>

          <Step n="2" title="Để AI tự sinh tiêu đề">
            Để trống ô <em>Tiêu đề có sẵn</em>, chọn số lượng tiêu đề cần tạo (1–30) rồi nhấn <Tag>Phân Tích Ngay</Tag>.
            AI sẽ phân tích từ khóa và sinh ra các tiêu đề đa dạng góc độ, tối ưu cho SEO.
          </Step>

          <Step n="3" title="Tự nhập tiêu đề thủ công">
            Nếu đã có sẵn tiêu đề, điền vào ô <em>Tiêu đề có sẵn</em> — mỗi dòng một tiêu đề.
            Hệ thống lưu ngay mà không gọi AI, không tốn chi phí.
          </Step>

          <Note type="blue">Nhấn vào tên từ khóa trong danh sách để vào trang chi tiết — xem và quản lý từng tiêu đề, bài viết đã tạo.</Note>
        </Section>

        {/* ── SECTION 4: Viết bài ── */}
        <Section icon={<FileText />} title="Bước 4 — Viết Bài SEO" color="var(--success)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Có <strong>3 chế độ viết bài</strong>. Chọn chế độ phù hợp với nhu cầu.
          </div>

          <SubHead><FileText size={14} color="var(--success)" /> Chế độ 1 — Viết từng bài</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            Trong trang chi tiết từ khóa, nhấn <Tag color="var(--success)">Viết bài</Tag> ở tiêu đề nào chưa có bài.
            AI viết bài hoàn chỉnh khoảng <strong>1.000 từ</strong> bao gồm: nội dung, SEO Title, Meta Description và gợi ý ảnh minh họa.
            Thường mất <strong>10–30 giây</strong>.
          </div>

          <SubHead><ListOrdered size={14} color="var(--accent)" /> Chế độ 2 — Hàng đợi (viết tự động lần lượt)</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            Nhấn <Tag color="var(--accent)">Hàng Đợi</Tag> để viết lần lượt tất cả tiêu đề chưa có bài — không cần thao tác từng cái.
            Bài hoàn chỉnh hiện lên ngay sau khi từng bài được viết xong. Có thể nhấn <Tag color="var(--danger)">Dừng</Tag> bất cứ lúc nào.
          </div>

          <SubHead><Layers size={14} color="var(--warning)" /> Chế độ 3 — Xử lý hàng loạt (tiết kiệm chi phí 50%)</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            Nhấn <Tag color="var(--warning)">Xử lý hàng loạt</Tag> để gửi toàn bộ tiêu đề cho AI xử lý nền.
            Kết quả không có ngay — Gemini xử lý trong nền từ <strong>vài phút đến vài giờ</strong>.
            Có thể đóng trình duyệt, hệ thống tự nhận kết quả khi xong.
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-panel)', border: '1px solid var(--border)', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>So sánh 3 chế độ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
              {[
                { label: 'Viết từng bài', speed: '10–30s/bài', cost: 'Chi phí đầy đủ', tagColor: 'var(--success)' },
                { label: 'Hàng đợi', speed: '10–30s/bài', cost: 'Chi phí đầy đủ', tagColor: 'var(--accent)' },
                { label: 'Hàng loạt', speed: 'Vài phút – vài giờ', cost: 'Tiết kiệm 50%', tagColor: 'var(--warning)' },
              ].map(({ label, speed, cost, tagColor }) => (
                <div key={label} style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-content)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: tagColor }}>{label}</div>
                  <div style={{ color: 'var(--text-muted)' }}>⏱ {speed}</div>
                  <div style={{ color: 'var(--text-muted)' }}>💰 {cost}</div>
                </div>
              ))}
            </div>
          </div>

          <SubHead>Xem và sử dụng bài viết</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Nhấn <Tag color="var(--accent)">Xem bài</Tag> để mở bài viết. Giao diện hiển thị đầy đủ:
            <strong> SEO Title</strong>, <strong>Meta Description</strong>, <strong>từ khóa</strong> — tất cả có nút copy nhanh.
            Bài viết cũng kèm <strong>gợi ý ảnh minh họa</strong> (prompt tiếng Anh) cho từng phần — có thể dùng để tạo ảnh bằng các công cụ AI như Midjourney, DALL-E.
          </div>

          <Note type="yellow">Giới hạn số bài viết mỗi ngày được cài trong phần <strong>Cài đặt</strong>. Xóa bài rồi viết lại vẫn tính vào quota ngày hôm đó.</Note>
        </Section>

        {/* ── SECTION 5: Keyword Planner ── */}
        <Section icon={<Brain />} title="Keyword Planner — Lên kế hoạch nội dung" color="#8b5cf6">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Keyword Planner giúp bạn xây dựng chiến lược nội dung theo chủ đề — AI tự động phân nhóm từ khóa,
            gợi ý bài pillar và bài hỗ trợ, sau đó viết bài hàng loạt theo kế hoạch.
          </div>

          <Step n="1" title="Tạo Plan mới">
            Vào menu <Tag color="#8b5cf6">Keyword Planner</Tag> → nhấn <Tag color="#8b5cf6">Tạo Plan</Tag>.
            Đặt tên plan, chọn công ty, sau đó nhập danh sách từ khóa (mỗi dòng một từ khóa) muốn triển khai nội dung.
          </Step>

          <Step n="2" title="Chạy AI phân tích">
            Sau khi thêm từ khóa, nhấn <Tag color="#8b5cf6">AI Phân tích</Tag>. AI sẽ:
            <ul style={{ marginTop: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <li>Phân nhóm từ khóa theo chủ đề (clustering)</li>
              <li>Xác định <strong>bài Pillar</strong> (bài chính, tổng quan) cho mỗi nhóm</li>
              <li>Xác định <strong>bài Supporting</strong> (bài hỗ trợ, chi tiết hơn)</li>
              <li>Gán ý định tìm kiếm và mức độ ưu tiên cho từng từ khóa</li>
            </ul>
          </Step>

          <Step n="3" title="Viết bài theo plan">
            Chọn các từ khóa cần viết → nhấn <Tag color="#8b5cf6">Tạo bài hàng loạt</Tag>.
            Hệ thống xếp vào hàng đợi và viết lần lượt trong nền — bạn có thể theo dõi tiến độ ở tab <em>Tiến độ</em>.
          </Step>

          <Step n="4" title="Xem bài viết đã tạo">
            Keyword nào đã viết xong sẽ hiển thị nút <Tag color="var(--success)">Xem bài</Tag>.
            Nhấn vào để đọc nội dung bài ngay trên trang, không cần chuyển sang trang khác.
          </Step>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <Card title="Bài Pillar" desc="Bài viết tổng quan, bao quát toàn bộ chủ đề — thường dài hơn, hướng đến từ khóa độ khó cao hơn. Đây là bài trung tâm để các bài hỗ trợ liên kết về." color="rgba(139,92,246,0.25)" />
            <Card title="Bài Supporting" desc="Bài viết đi sâu vào một khía cạnh cụ thể của chủ đề — ngắn hơn, từ khóa long-tail. Liên kết nội bộ về bài Pillar để tăng topical authority." color="rgba(139,92,246,0.15)" />
          </div>

          <Note type="blue">Keyword Planner phù hợp khi bạn muốn xây dựng một mảng chủ đề hoàn chỉnh thay vì viết từng bài rời rạc. Giúp tăng thứ hạng tổng thể cho toàn bộ chủ đề trên Google.</Note>
        </Section>

        {/* ── SECTION 6: Website Analysis ── */}
        <Section icon={<Globe />} title="Phân tích Website — Gợi ý từ khóa từ nội dung hiện có" color="var(--info)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Tính năng này tự động quét toàn bộ website của bạn, đọc nội dung các trang, rồi đề xuất
            danh sách từ khóa còn thiếu để bổ sung vào chiến lược SEO.
          </div>

          <Step n="1" title="Nhập địa chỉ website">
            Vào menu <Tag color="var(--info)">Phân tích Website</Tag> → nhấn <Tag color="var(--info)">Phân tích Website Mới</Tag>.
            Nhập URL website (ví dụ: <em>https://example.com</em>) và chọn công ty liên quan.
          </Step>

          <Step n="2" title="Hệ thống tự động quét">
            Sau khi nhấn bắt đầu, hệ thống sẽ:
            <ul style={{ marginTop: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <li>Quét tự động tất cả trang của website theo chiều sâu</li>
              <li>Thu thập tiêu đề, nội dung, cấu trúc trang</li>
              <li>Gửi dữ liệu cho AI để phân tích</li>
            </ul>
            Log tiến trình hiển thị trực tiếp — bạn có thể theo dõi hệ thống đang quét đến đâu.
          </Step>

          <Step n="3" title="Xem kết quả gợi ý từ khóa">
            Sau khi phân tích xong, AI đề xuất <strong>25–40 từ khóa</strong> gồm 4 loại:
            <ul style={{ marginTop: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <li><strong>Content Gap</strong> — Chủ đề liên quan nhưng website chưa có bài viết nào</li>
              <li><strong>Thin Content</strong> — Chủ đề đã có nhưng nội dung còn quá mỏng</li>
              <li><strong>Long-tail</strong> — Từ khóa dài, ít cạnh tranh, dễ lên top hơn</li>
              <li><strong>Semantic</strong> — Từ khóa liên quan giúp tăng độ uy tín tổng thể</li>
            </ul>
          </Step>

          <Step n="4" title="Xem danh sách trang đã quét">
            Tab <em>Danh sách trang</em> liệt kê tất cả trang đã quét kèm số lượng từ — giúp bạn xác định trang nào đang có nội dung mỏng cần bổ sung.
          </Step>

          <Note type="blue">Có thể cấu hình số trang tối đa và độ sâu quét để kiểm soát phạm vi phân tích.</Note>
          <Note type="yellow">Thời gian phân tích phụ thuộc vào số trang của website. Website lớn có thể mất vài phút để hoàn tất.</Note>
        </Section>

        {/* ── SECTION 7: Batch Jobs ── */}
        <Section icon={<Layers />} title="Xử lý hàng loạt (Batch Jobs)" color="var(--warning)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Khi chọn chế độ <strong>Xử lý hàng loạt</strong>, toàn bộ tiêu đề được gửi cho Gemini xử lý nền — tiết kiệm 50% chi phí so với viết realtime.
            Phù hợp khi cần viết số lượng lớn và không cần kết quả ngay.
          </div>

          <Step n="1" title="Gửi yêu cầu xử lý hàng loạt">
            Trong trang chi tiết từ khóa, nhấn <Tag color="var(--warning)">Xử lý hàng loạt</Tag>.
            Tất cả tiêu đề chưa có bài sẽ được gom lại và gửi lên Gemini một lần.
          </Step>

          <Step n="2" title="Theo dõi tại trang Batch Jobs">
            Vào menu <Tag color="var(--warning)">Batch Jobs</Tag> để xem trạng thái. Các trạng thái:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><Tag color="var(--warning)">Đang chờ</Tag> — Gemini chưa bắt đầu xử lý</li>
              <li><Tag color="var(--accent)">Đang xử lý</Tag> — Gemini đang chạy</li>
              <li><Tag color="var(--success)">Hoàn thành</Tag> — Đã xong, bài viết đã được nhập về hệ thống</li>
            </ul>
          </Step>

          <Step n="3" title="Kết quả tự động nhập về">
            Hệ thống tự động kiểm tra và nhập kết quả định kỳ. Hoặc nhấn <Tag color="var(--warning)">Kiểm tra ngay</Tag> để nhập kết quả ngay lập tức.
            Sau khi nhập, bài viết xuất hiện trong trang Từ Khóa như bình thường.
          </Step>

          <Note type="yellow">Muốn gửi lại: xóa job cũ tại trang Batch Jobs → quay về trang Từ Khóa → nhấn Xử lý hàng loạt lại.</Note>
        </Section>

        {/* ── SECTION 8: Đăng bài ── */}
        <Section icon={<Send />} title="Đăng bài lên Website" color="#a78bfa">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Sau khi bài được viết, hệ thống có thể tự động hoặc thủ công gửi bài lên website của bạn thông qua API.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>1</span>
                Đăng từng bài (thủ công)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Trong trang chi tiết từ khóa, bài nào chưa được đăng sẽ có nút <Tag color="#a78bfa">Đăng</Tag>. Nhấn để đăng ngay lập tức.
              </div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>2</span>
                Đăng hàng loạt
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Nhấn <Tag color="#a78bfa">Đăng hàng loạt</Tag> trên thanh công cụ để gửi tất cả bài chưa đăng lên website cùng lúc.
              </div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>3</span>
                Tự động đăng sau khi viết xong (Auto-publish)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Bật <strong>Tự động đăng bài</strong> trong cài đặt công ty. Mỗi bài viết xong (dù viết lẻ, hàng đợi hay hàng loạt) sẽ tự động được đăng — không cần thao tác thủ công. Badge <Tag color="var(--success)">Đã đăng</Tag> hiển thị ngay trên giao diện.
              </div>
            </div>
          </div>

          <SubHead>Trạng thái bài sau khi đăng</SubHead>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Chưa đăng', color: 'var(--text-muted)', desc: 'Bài chưa được gửi lên website' },
              { label: 'Đã đăng', color: 'var(--success)', desc: 'Đăng thành công, có ID từ website' },
              { label: 'Lỗi đăng', color: 'var(--danger)', desc: 'Gặp lỗi, nhấn Thử lại để gửi lại' },
            ].map(({ label, color, desc }) => (
              <div key={label} style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-panel)', border: '1px solid var(--border)', fontSize: 12 }}>
                <div style={{ fontWeight: 700, color, marginBottom: 4 }}>{label}</div>
                <div style={{ color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            ))}
          </div>

          <Note type="blue">Cần cài đặt <strong>API URL đăng bài</strong> tại <Tag>Cài đặt</Tag> → tab Cài Đặt, hoặc trong từng trang cài đặt công ty. Nếu chưa cấu hình, nút đăng sẽ báo lỗi.</Note>
        </Section>

        {/* ── SECTION 9: Quản lý User ── */}
        <Section icon={<Users />} title="Quản lý Tài khoản (Admin)" color="var(--info)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Admin có thể quản lý tài khoản người dùng tại menu <Tag color="var(--info)">Tài khoản</Tag>.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <Card title="Tạo tài khoản mới" desc="Nhập tên đăng nhập, họ tên, email, mật khẩu và vai trò (admin hoặc người dùng thông thường)." />
            <Card title="Khóa / mở khóa tài khoản" desc="Bật/tắt trạng thái hoạt động của user. Tài khoản bị khóa không thể đăng nhập cho đến khi được mở lại." />
            <Card title="Giới hạn bài viết riêng" desc="Đặt số bài tối đa mỗi ngày cho từng user. Để 0 để áp dụng theo giới hạn chung của hệ thống." />
            <Card title="API key cá nhân" desc="Mỗi user có thể tự cấu hình Gemini API key riêng trong Cài đặt của mình. Key cá nhân được ưu tiên hơn key hệ thống và không bị giới hạn quota." />
          </div>

          <Note type="blue">Admin có thể viết bài cho keyword của bất kỳ user nào. Bài viết sẽ hiển thị đầy đủ trong giao diện của user đó.</Note>
        </Section>

        {/* ── SECTION 10: Cài đặt ── */}
        <Section icon={<Settings />} title="Cài đặt hệ thống" color="var(--text-secondary)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Vào menu <Tag>Cài đặt</Tag> để cấu hình các thông số hoạt động của hệ thống.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Zap size={14} color="var(--accent)" />
                <strong style={{ fontSize: 13 }}>Giới hạn Token / Ngày</strong>
                <Tag color="var(--text-muted)">0 = không giới hạn</Tag>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tổng lượng xử lý AI được phép trong một ngày. Mỗi bài viết tiêu thụ một lượng nhất định — cài giới hạn này để kiểm soát chi phí.</div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <FileText size={14} color="var(--success)" />
                <strong style={{ fontSize: 13 }}>Giới hạn Bài Viết / Ngày</strong>
                <Tag color="var(--text-muted)">0 = không giới hạn</Tag>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Số bài tối đa được viết mỗi ngày — áp dụng cho cả 3 chế độ viết bài. Reset lúc 0:00 hàng ngày.</div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Send size={14} color="#a78bfa" />
                <strong style={{ fontSize: 13 }}>API URL đăng bài mặc định</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Địa chỉ API để hệ thống gửi bài lên website. Áp dụng cho các công ty không có URL riêng. Công ty nào có URL riêng sẽ được ưu tiên dùng URL đó.</div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <BarChart2 size={14} color="var(--accent)" />
                <strong style={{ fontSize: 13 }}>Thống kê sử dụng</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Xem lịch sử sử dụng AI theo ngày tại menu <Tag>Thống kê</Tag>. Thanh tiến trình màu <span style={{ color: 'var(--success)', fontWeight: 600 }}>xanh</span> = bình thường, <span style={{ color: 'var(--warning)', fontWeight: 600 }}>vàng</span> = gần giới hạn, <span style={{ color: 'var(--danger)', fontWeight: 600 }}>đỏ</span> = sắp hết.</div>
            </div>
          </div>
        </Section>

        {/* ── SECTION 11: FAQ ── */}
        <Section icon={<Info />} title="Câu hỏi thường gặp" color="var(--info)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              {
                q: 'Tôi không có SerpAPI, hệ thống có dùng được không?',
                a: 'Hoàn toàn được. SerpAPI chỉ là tùy chọn bổ sung. Không có SerpAPI, AI vẫn tự sinh tiêu đề dựa trên kiến thức SEO chuyên sâu. Chất lượng vẫn tốt, chỉ thiếu dữ liệu thực tế từ Google Search.'
              },
              {
                q: 'Hàng đợi và Xử lý hàng loạt khác nhau thế nào?',
                a: 'Hàng đợi viết bài lần lượt và cho kết quả ngay sau mỗi bài — chi phí đầy đủ. Xử lý hàng loạt gửi tất cả cho Gemini xử lý nền — kết quả sau vài phút đến vài giờ, nhưng tiết kiệm 50% chi phí.'
              },
              {
                q: 'Bài viết có chuẩn SEO không?',
                a: 'AI được hướng dẫn cụ thể: từ khóa chính xuất hiện trong tiêu đề và các phần H2, mật độ từ khóa phù hợp, có kêu gọi hành động (CTA) cuối bài, chèn link về website công ty. SEO Title 50–60 ký tự, Meta Description 150–160 ký tự.'
              },
              {
                q: 'Image Prompts là gì?',
                a: 'Mỗi bài viết AI tạo kèm các gợi ý ảnh minh họa bằng tiếng Anh — một ảnh đại diện và một ảnh cho mỗi phần nội dung. Copy gợi ý này vào Midjourney, DALL-E hoặc các công cụ tạo ảnh AI khác để tạo ảnh cho bài.'
              },
              {
                q: 'Xóa bài rồi viết lại có bị tính vào giới hạn không?',
                a: 'Có. Giới hạn tính theo số lần viết thực tế, không phải số bài hiện có. Xóa bài không làm giảm biến đếm — đây là cơ chế kiểm soát chi phí.'
              },
              {
                q: 'Keyword Planner khác gì so với quản lý Từ khóa thông thường?',
                a: 'Quản lý Từ khóa phù hợp khi viết từng bài riêng lẻ theo từ khóa cụ thể. Keyword Planner phù hợp khi bạn muốn xây dựng cả một mảng nội dung theo chủ đề — AI tự phân nhóm, xác định bài chính và bài hỗ trợ, giúp tăng thứ hạng tổng thể cho toàn bộ chủ đề.'
              },
              {
                q: 'Phân tích Website mất bao lâu?',
                a: 'Phụ thuộc vào số trang của website. Website nhỏ (dưới 50 trang) thường xong trong 1–2 phút. Website lớn hơn có thể mất vài phút. Bạn có thể theo dõi log tiến trình trực tiếp trên giao diện.'
              },
              {
                q: 'Đăng bài thất bại, tôi phải làm gì?',
                a: 'Bài bị lỗi sẽ hiển thị badge "Lỗi đăng" và nút "Thử lại". Nhấn "Thử lại" để gửi lại. Nếu vẫn lỗi, kiểm tra lại URL API đăng bài đã cài đúng chưa trong phần Cài đặt hoặc cài đặt công ty.'
              },
              {
                q: 'Nhập nhiều Gemini API Key có lợi gì?',
                a: 'Khi nhập nhiều key cách nhau bởi dấu phẩy, hệ thống tự luân phiên dùng từng key. Điều này giúp phân tải đều — tránh bị giới hạn tốc độ khi viết nhiều bài liên tiếp, đặc biệt hữu ích khi dùng chế độ Hàng đợi hoặc Xử lý hàng loạt.'
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
          AutoSEO — Hệ thống hỗ trợ sản xuất nội dung SEO tự động bằng AI cho website doanh nghiệp.
        </div>

      </div>
    </div>
  );
}
