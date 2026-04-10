import React, { useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, Building2, Search, FileText,
  Layers, Settings, KeyRound, AlertTriangle, CheckCircle2,
  ArrowRight, Info, Users, ListOrdered, BarChart2,
  Send, Globe, Brain, Target, Sparkles, LayoutList, MessageCircle, Trash2,
  Shield, Database, ScrollText, Terminal,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

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

function FlowPill({ icon, label, color }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, background: `${color}18`, border: `1px solid ${color}40`, fontSize: 13, fontWeight: 600, color }}>
      {icon} {label}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   HELP PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function Help() {
  return (
    <div className="page-content">
      <div style={{ margin: '0 auto' }}>

        {/* ── HEADER ── */}
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

        {/* ── TỔNG QUAN ── */}
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

        {/* ── QUY TRÌNH ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Quy trình hoạt động</div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <FlowPill icon={<Building2 size={13} />} label="Thêm Công ty" color="#0ea5e9" />
            <ArrowRight size={14} color="var(--text-muted)" />
            <FlowPill icon={<Search size={13} />} label="Nhập Từ khóa" color="#6366f1" />
            <ArrowRight size={14} color="var(--text-muted)" />
            <FlowPill icon={<FileText size={13} />} label="AI Viết Bài" color="#16a34a" />
            <ArrowRight size={14} color="var(--text-muted)" />
            <FlowPill icon={<Send size={13} />} label="Đăng lên Website" color="#a78bfa" />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            PHẦN 1 — BẮT ĐẦU NHANH
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={12} /> Phần 1 — Bắt đầu nhanh
        </div>

        {/* ── SECTION: AI Chatbot ── */}
        <Section icon={<MessageCircle />} title="Trợ lý AI — Hỏi đáp tức thì" color="#06b6d4" defaultOpen>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Hệ thống tích hợp <strong>trợ lý AI</strong> giải đáp mọi thắc mắc về cách sử dụng ngay lập tức —
            thay vì đọc toàn bộ tài liệu, hỏi trực tiếp và nhận câu trả lời tức thì.
          </div>

          {/* Visual */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(6,182,212,0.2)', background: 'rgba(6,182,212,0.05)', marginBottom: 16 }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>AI</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#06b6d4', marginBottom: 6 }}>Trợ lý AutoSEO</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Xin chào! Tôi là trợ lý AutoSEO. Bạn có thể hỏi tôi về bất kỳ tính năng nào trong hệ thống —
                như cách viết bài, cài đặt API, Keyword Planner, hay bất kỳ điều gì bạn chưa rõ.
              </div>
            </div>
          </div>

          <Step n="1" title="Mở trợ lý">
            Nhìn xuống góc <strong>dưới bên phải</strong> màn hình → nhấn biểu tượng chat <MessageCircle size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />.
            Biểu tượng hiển thị trên tất cả các trang.
          </Step>

          <Step n="2" title="Đặt câu hỏi">
            Gõ câu hỏi → nhấn <strong>Enter</strong>. Ví dụ:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                '"Làm sao để viết nhiều bài cùng lúc?"',
                '"Tại sao bài viết của tôi bị lỗi?"',
                '"Cách cài đặt tự động đăng bài?"',
                '"Sự khác nhau giữa Hàng đợi và Xử lý hàng loạt?"',
              ].map(q => (
                <li key={q} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{q}</li>
              ))}
            </ul>
          </Step>

          <Step n="3" title="Xóa cuộc trò chuyện">
            Nhấn <Trash2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> trên thanh tiêu đề cửa sổ để bắt đầu mới.
          </Step>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            <Card title="Enter — Gửi tin nhắn" desc="Nhấn Enter để gửi câu hỏi ngay lập tức." color="rgba(6,182,212,0.2)" />
            <Card title="Shift + Enter — Xuống dòng" desc="Giữ Shift rồi nhấn Enter để viết nhiều dòng trước khi gửi." color="rgba(6,182,212,0.2)" />
          </div>

          <Note type="blue">Trợ lý nhớ ngữ cảnh cuộc hội thoại — hỏi "Keyword Planner là gì?" rồi tiếp "Vậy Pillar là gì?" trợ lý vẫn hiểu bạn đang hỏi về Keyword Planner.</Note>
          <Note type="yellow">Trợ lý chỉ giải đáp thắc mắc — không thực hiện thao tác thay bạn như tạo bài hay xóa dữ liệu.</Note>
        </Section>

        {/* ── SECTION: API Keys ── */}
        <Section icon={<KeyRound />} title="Bước 1 — Cấu hình API Keys" color="var(--danger)" defaultOpen>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Trước khi sử dụng bất kỳ tính năng AI nào, cần ít nhất một <strong>Gemini API Key</strong>.
            Vào menu <Tag>Cài đặt</Tag> → tab <Tag>Cấu hình API</Tag>.
          </div>

          <Step n="1" title="Lấy Gemini API Key">
            Truy cập <strong>aistudio.google.com</strong> → đăng nhập → chọn <em>Get API Key</em> → tạo key mới.
            Copy và dán vào ô <em>Gemini API Key</em> trong Cài đặt.
          </Step>

          <Step n="2" title="Nhập nhiều API Key (khuyến nghị)">
            Nhập nhiều key cách nhau bởi dấu phẩy. Hệ thống tự luân phiên — giúp viết nhiều bài liên tục mà không bị giới hạn tốc độ.
          </Step>

          <Step n="3" title="Chọn Model AI">
            <ul style={{ marginTop: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>gemini-2.5-flash</strong> — Nhanh, chất lượng tốt <Tag color="var(--success)">Khuyên dùng</Tag></li>
              <li><strong>gemini-2.5-flash-lite</strong> — Nhanh nhất, chi phí thấp nhất</li>
              <li><strong>gemini-2.5-pro</strong> — Chất lượng bài viết cao nhất</li>
            </ul>
          </Step>

          <Step n="4" title="SerpAPI Key (tùy chọn)">
            Giúp AI tham khảo kết quả Google thực tế khi sinh tiêu đề. Không bắt buộc — hệ thống vẫn hoạt động đầy đủ nếu không có.
          </Step>

          <Note type="green">Key được ẩn trên giao diện — nhấn icon mắt để xem. Mỗi người dùng có thể cấu hình key cá nhân riêng (ưu tiên hơn key hệ thống).</Note>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            PHẦN 2 — QUY TRÌNH CHÍNH
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={12} /> Phần 2 — Quy trình chính
        </div>

        {/* ── SECTION: Công ty ── */}
        <Section icon={<Building2 />} title="Bước 2 — Quản lý Website / Công ty" color="var(--info)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Mỗi bài viết được AI cá nhân hóa theo thông tin công ty. Hệ thống hỗ trợ nhiều công ty — mỗi công ty có cấu hình riêng biệt.
          </div>

          <Step n="1" title="Thêm Website / Công ty mới">
            Nhấn <Tag color="var(--info)">Thêm Website</Tag> và điền thông tin:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>Tên công ty</strong> — Tên thương hiệu sẽ được đề cập trong bài viết</li>
              <li><strong>URL website</strong> — Địa chỉ website; AI chèn link trỏ về đây trong bài</li>
              <li><strong>Lĩnh vực</strong> — Ngành nghề hoạt động, giúp AI viết đúng chuyên môn</li>
              <li><strong>Mã hợp đồng</strong> — Dùng khi đăng bài tự động lên hệ thống đối tác</li>
              <li><strong>Mô tả</strong> — Thông tin chi tiết về sản phẩm, dịch vụ, điểm mạnh. <strong>Càng chi tiết, bài viết càng chính xác.</strong></li>
            </ul>
          </Step>

          <Step n="2" title="Cấu hình đăng bài tự động">
            Trong phần chỉnh sửa công ty, bật <strong>Tự động đăng bài</strong> — mỗi bài viết xong sẽ tự động gửi lên website đối tác.
          </Step>

          <Step n="3" title="Cấu hình Internal Links">
            Bật tính năng <strong>Internal Links</strong> trong cài đặt công ty để hệ thống tự động chèn liên kết nội bộ vào bài viết —
            giúp tăng topical authority và liên kết các bài viết liên quan với nhau.
          </Step>

          <Note type="blue">Phần <strong>Mô tả</strong> là quan trọng nhất. Nên ghi rõ: sản phẩm/dịch vụ chính, điểm mạnh, thông tin liên hệ, địa chỉ, slogan.</Note>
          <Note type="yellow">Xóa công ty sẽ <strong>xóa toàn bộ</strong> từ khóa và bài viết liên quan. Thao tác không thể hoàn tác.</Note>
        </Section>

        {/* ── SECTION: Từ khóa ── */}
        <Section icon={<Search />} title="Bước 3 — Quản lý Từ khóa SEO" color="var(--accent)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Từ khóa là trung tâm của hệ thống. Mỗi từ khóa có nhiều tiêu đề bài viết và AI viết từng bài theo tiêu đề.
          </div>

          <Step n="1" title="Thêm từ khóa mới">
            Nhấn <Tag>Thêm Từ Khóa</Tag>, chọn công ty và nhập từ khóa SEO mục tiêu.
            Ví dụ: <em>"dịch vụ vận chuyển hàng đi Canada"</em>, <em>"thiết kế nội thất phòng khách"</em>...
          </Step>

          <Step n="2" title="Để AI tự sinh tiêu đề">
            Để trống ô <em>Tiêu đề có sẵn</em>, chọn số lượng tiêu đề (1–30) rồi nhấn <Tag>Phân Tích Ngay</Tag>.
            AI phân tích từ khóa và sinh ra các tiêu đề đa dạng góc độ, tối ưu SEO.
          </Step>

          <Step n="3" title="Tự nhập tiêu đề thủ công">
            Điền vào ô <em>Tiêu đề có sẵn</em> — mỗi dòng một tiêu đề.
            Hệ thống lưu ngay mà không gọi AI, không tốn chi phí.
          </Step>

          <Note type="blue">Nhấn vào tên từ khóa trong danh sách để vào trang chi tiết — xem và quản lý từng tiêu đề, bài viết đã tạo.</Note>
        </Section>

        {/* ── SECTION: Viết bài ── */}
        <Section icon={<FileText />} title="Bước 4 — Viết Bài SEO" color="var(--success)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Có <strong>3 chế độ viết bài</strong>. Chọn chế độ phù hợp với nhu cầu.
          </div>

          <SubHead><FileText size={14} color="var(--success)" /> Chế độ 1 — Viết từng bài</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            Trong trang chi tiết từ khóa, nhấn <Tag color="var(--success)">Viết bài</Tag> ở tiêu đề nào chưa có bài.
            AI viết bài hoàn chỉnh khoảng <strong>1.000 từ</strong> gồm: nội dung, SEO Title, Meta Description và gợi ý ảnh minh họa.
            Thường mất <strong>10–30 giây</strong>.
          </div>

          <SubHead><ListOrdered size={14} color="var(--accent)" /> Chế độ 2 — Hàng đợi (viết tự động lần lượt)</SubHead>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            Nhấn <Tag color="var(--accent)">Hàng Đợi</Tag> để viết lần lượt tất cả tiêu đề chưa có bài.
            Bài hoàn chỉnh hiện lên ngay sau khi từng bài xong. Có thể nhấn <Tag color="var(--danger)">Dừng</Tag> bất cứ lúc nào.
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
            Mỗi bài kèm <strong>gợi ý ảnh minh họa</strong> (prompt tiếng Anh) — dùng cho Midjourney, DALL-E hoặc các công cụ tạo ảnh AI khác.
          </div>

          <Note type="yellow">Giới hạn số bài viết mỗi ngày được cài trong <strong>Cài đặt</strong>. Xóa bài rồi viết lại vẫn tính vào quota ngày hôm đó.</Note>
        </Section>

        {/* ── SECTION: Đăng bài ── */}
        <Section icon={<Send />} title="Bước 5 — Đăng bài lên Website" color="#a78bfa">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Sau khi bài được viết, hệ thống có thể tự động hoặc thủ công gửi bài lên website thông qua API.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>1</span>
                Đăng từng bài (thủ công)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Trong trang chi tiết từ khóa, bài nào chưa đăng sẽ có nút <Tag color="#a78bfa">Đăng</Tag>. Nhấn để đăng ngay lập tức.
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
                Bật <strong>Tự động đăng bài</strong> trong cài đặt công ty. Mỗi bài viết xong sẽ tự động được đăng — không cần thao tác thủ công. Badge <Tag color="var(--success)">Đã đăng</Tag> hiển thị ngay.
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

          <Note type="blue">Cần cài đặt <strong>API URL đăng bài</strong> tại <Tag>Cài đặt</Tag> → tab Cài Đặt, hoặc trong từng trang cài đặt công ty.</Note>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            PHẦN 3 — TÍNH NĂNG NÂNG CAO
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={12} /> Phần 3 — Tính năng nâng cao
        </div>

        {/* ── SECTION: Keyword Planner ── */}
        <Section icon={<Brain />} title="Keyword Planner — Lên kế hoạch nội dung" color="#8b5cf6">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Keyword Planner giúp xây dựng chiến lược nội dung theo chủ đề — AI tự động phân nhóm từ khóa,
            gợi ý bài pillar và bài hỗ trợ, sau đó viết bài hàng loạt theo kế hoạch.
            <strong> Phù hợp khi muốn xây dựng cả một mảng nội dung hoàn chỉnh</strong>, thay vì viết từng bài rời rạc.
          </div>

          <Step n="1" title="Tạo Plan mới">
            Vào menu <Tag color="#8b5cf6">Keyword Planner</Tag> → nhấn <Tag color="#8b5cf6">Tạo Plan</Tag>.
            Đặt tên plan, chọn công ty, nhập danh sách từ khóa (mỗi dòng một từ khóa).
          </Step>

          <Step n="2" title="Chạy AI phân tích">
            Nhấn <Tag color="#8b5cf6">AI Phân tích</Tag>. AI sẽ:
            <ul style={{ marginTop: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <li>Phân nhóm từ khóa theo chủ đề (clustering)</li>
              <li>Xác định <strong>bài Pillar</strong> (bài chính, tổng quan) cho mỗi nhóm</li>
              <li>Xác định <strong>bài Supporting</strong> (bài hỗ trợ, chi tiết hơn)</li>
              <li>Gán ý định tìm kiếm và mức độ ưu tiên cho từng từ khóa</li>
            </ul>
          </Step>

          <Step n="3" title="Viết bài theo plan">
            Chọn các từ khóa cần viết → nhấn <Tag color="#8b5cf6">Tạo bài hàng loạt</Tag>.
            Hệ thống xếp vào hàng đợi và viết lần lượt trong nền — theo dõi tiến độ ở tab <em>Tiến độ</em>.
          </Step>

          <Step n="4" title="Xem bài viết đã tạo">
            Keyword đã viết xong sẽ hiển thị nút <Tag color="var(--success)">Xem bài</Tag>.
            Nhấn để đọc nội dung ngay trên trang, không cần chuyển trang.
          </Step>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <Card title="Bài Pillar" desc="Bài viết tổng quan, bao quát toàn bộ chủ đề — dài hơn, hướng đến từ khóa độ khó cao hơn. Là bài trung tâm để các bài hỗ trợ liên kết về." color="rgba(139,92,246,0.25)" />
            <Card title="Bài Supporting" desc="Bài viết đi sâu vào một khía cạnh cụ thể — ngắn hơn, từ khóa long-tail. Liên kết nội bộ về bài Pillar để tăng topical authority." color="rgba(139,92,246,0.15)" />
          </div>

          <Note type="blue">Giúp tăng thứ hạng tổng thể cho toàn bộ chủ đề trên Google — đây là chiến lược SEO chuyên sâu.</Note>
        </Section>

        {/* ── SECTION: Phân tích Website ── */}
        <Section icon={<Globe />} title="Phân tích Website — Gợi ý từ khóa từ nội dung hiện có" color="var(--info)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Tự động quét toàn bộ website, đọc nội dung các trang, rồi đề xuất danh sách từ khóa còn thiếu.
            <strong> Dùng khi bắt đầu với website mới hoặc muốn tìm "lỗ hổng" nội dung</strong>.
          </div>

          <Step n="1" title="Nhập địa chỉ website">
            Vào menu <Tag color="var(--info)">Phân tích Website</Tag> → nhấn <Tag color="var(--info)">Phân tích Website Mới</Tag>.
            Nhập URL website và chọn công ty liên quan.
          </Step>

          <Step n="2" title="Hệ thống tự động quét">
            Quét tất cả trang theo chiều sâu, thu thập tiêu đề, nội dung, cấu trúc.
            Log tiến trình hiển thị trực tiếp — theo dõi đang quét đến đâu.
          </Step>

          <Step n="3" title="Xem kết quả gợi ý từ khóa">
            Sau khi xong, AI đề xuất <strong>25–40 từ khóa</strong> gồm 4 loại:
            <ul style={{ marginTop: 6, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <li><strong>Content Gap</strong> — Chủ đề liên quan nhưng website chưa có bài viết nào</li>
              <li><strong>Thin Content</strong> — Chủ đề đã có nhưng nội dung còn quá mỏng</li>
              <li><strong>Long-tail</strong> — Từ khóa dài, ít cạnh tranh, dễ lên top hơn</li>
              <li><strong>Semantic</strong> — Từ khóa liên quan giúp tăng độ uy tín tổng thể</li>
            </ul>
          </Step>

          <Step n="4" title="Xem danh sách trang đã quét">
            Tab <em>Danh sách trang</em> liệt kê tất cả trang đã quét kèm số lượng từ — giúp xác định trang nào đang có nội dung mỏng.
          </Step>

          <Note type="blue">Có thể cấu hình số trang tối đa và độ sâu quét để kiểm soát phạm vi phân tích.</Note>
          <Note type="yellow">Thời gian phụ thuộc vào số trang. Website nhỏ (~50 trang) thường xong trong 1–2 phút. Website lớn có thể mất vài phút.</Note>
        </Section>

        {/* ── SECTION: Batch Jobs ── */}
        <Section icon={<Layers />} title="Xử lý hàng loạt (Batch Jobs)" color="var(--warning)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Chế độ <strong>Xử lý hàng loạt</strong> gửi toàn bộ tiêu đề cho Gemini xử lý nền — tiết kiệm 50% chi phí API.
            Phù hợp khi cần viết số lượng lớn và không cần kết quả ngay.
          </div>

          <Step n="1" title="Gửi yêu cầu xử lý hàng loạt">
            Trong trang chi tiết từ khóa, nhấn <Tag color="var(--warning)">Xử lý hàng loạt</Tag>.
            Tất cả tiêu đề chưa có bài sẽ được gom lại và gửi lên Gemini một lần.
          </Step>

          <Step n="2" title="Theo dõi tại trang Batch Jobs">
            Vào menu <Tag color="var(--warning)">Batch Jobs</Tag> để xem trạng thái:
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><Tag color="var(--warning)">Đang chờ</Tag> — Gemini chưa bắt đầu xử lý</li>
              <li><Tag color="var(--accent)">Đang xử lý</Tag> — Gemini đang chạy</li>
              <li><Tag color="var(--success)">Hoàn thành</Tag> — Đã xong, bài viết đã được nhập về hệ thống</li>
            </ul>
          </Step>

          <Step n="3" title="Kết quả tự động nhập về">
            Hệ thống tự động kiểm tra và nhập kết quả định kỳ.
            Hoặc nhấn <Tag color="var(--warning)">Kiểm tra ngay</Tag> để nhập kết quả ngay lập tức.
          </Step>

          <Note type="yellow">Muốn gửi lại: xóa job cũ tại trang Batch Jobs → quay về trang Từ Khóa → nhấn Xử lý hàng loạt lại.</Note>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            PHẦN 4 — QUẢN TRỊ HỆ THỐNG (Admin/Root)
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={12} /> Phần 4 — Quản trị hệ thống
        </div>

        {/* ── SECTION: Cài đặt ── */}
        <Section icon={<Settings />} title="Cài đặt hệ thống" color="var(--text-secondary)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Vào menu <Tag>Cài đặt</Tag> để cấu hình các thông số hoạt động của hệ thống.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <Card title="Giới hạn Token / Ngày" desc="Tổng lượng xử lý AI được phép trong một ngày. Đặt 0 = không giới hạn. Thanh tiến trình màu xanh = bình thường, vàng = gần giới hạn, đỏ = sắp hết." />
            <Card title="Giới hạn Bài Viết / Ngày" desc="Số bài tối đa được viết mỗi ngày — áp dụng cho cả 3 chế độ viết bài. Reset lúc 0:00 hàng ngày." />
            <Card title="API URL đăng bài mặc định" desc="Địa chỉ API để hệ thống gửi bài lên website. Áp dụng cho các công ty không có URL riêng." />
            <Card title="Bật/Tắt Trợ lý AI" desc="Root admin có thể bật hoặc tắt chatbot tại đây. Khi tắt, biểu tượng chat sẽ không hiển thị." />
          </div>

          <Note type="blue">Xem lịch sử sử dụng AI theo ngày tại menu <Tag>Thống kê</Tag>.</Note>
        </Section>

        {/* ── SECTION: Quản lý User ── */}
        <Section icon={<Users />} title="Quản lý Tài khoản (Admin)" color="var(--info)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Admin có thể quản lý tài khoản người dùng tại menu <Tag color="var(--info)">Tài khoản</Tag>.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <Card title="Tạo tài khoản mới" desc="Nhập tên đăng nhập, họ tên, email, mật khẩu và vai trò (admin hoặc người dùng thông thường)." />
            <Card title="Khóa / mở khóa tài khoản" desc="Bật/tắt trạng thái hoạt động của user. Tài khoản bị khóa không thể đăng nhập." />
            <Card title="Giới hạn bài viết riêng" desc="Đặt số bài tối đa mỗi ngày cho từng user. Để 0 để áp dụng theo giới hạn chung của hệ thống." />
            <Card title="API key cá nhân" desc="Mỗi user có thể tự cấu hình Gemini API key riêng trong Cài đặt của mình. Key cá nhân được ưu tiên hơn key hệ thống." />
          </div>

          <Note type="blue">Admin có thể viết bài cho keyword của bất kỳ user nào. Bài viết sẽ hiển thị đầy đủ trong giao diện của user đó.</Note>
        </Section>

        {/* ── SECTION: Hợp đồng & CRM ── */}
        <Section icon={<ScrollText />} title="Hợp đồng & Tích hợp CRM (Root)" color="var(--warning)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Chỉ tài khoản <strong>Root</strong> mới truy cập được các mục này.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <Card title="Hợp đồng" desc="Quản lý hợp đồng khách hàng tích hợp với CRM bên ngoài. Mỗi hợp đồng giới hạn số lượng công ty và lĩnh vực hoạt động." color="rgba(234,179,8,0.2)" />
            <Card title="Webhook Events" desc="Xem log các sự kiện webhook nhận từ hệ thống CRM bên ngoài. Theo dõi payload, trạng thái xử lý và thời gian nhận." color="rgba(234,179,8,0.2)" />
          </div>

          <Note type="yellow">Webhook cho phép hệ thống bên ngoài (CRM) gửi yêu cầu tạo từ khóa tự động — không cần thao tác thủ công.</Note>
        </Section>

        {/* ── SECTION: Queue & DLQ ── */}
        <Section icon={<Database />} title="Queue & DLQ (Root)" color="var(--danger)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Hệ thống có 2 hàng đợi nền xử lý tự động: <strong>Keyword Queue</strong> (tạo tiêu đề) và <strong>Title Queue</strong> (viết bài).
            Nếu xử lý thất bại, job sẽ được chuyển vào <strong>DLQ (Dead Letter Queue)</strong> để xem lại và replay.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <Card title="Queue Monitor" desc="Theo dõi trạng thái của tất cả job đang chờ và đang xử lý trong hàng đợi nền. Xem số lượng pending, processing, completed, failed." color="rgba(239,68,68,0.15)" />
            <Card title="DLQ Viewer" desc="Xem các job đã thất bại nhiều lần và không tự động retry được. Có thể xem chi tiết lỗi và nhấn Replay để chạy lại." color="rgba(239,68,68,0.15)" />
          </div>

          <Note type="blue">Hệ thống tự động retry DLQ job tối đa 3 lần. Sau 3 lần thất bại, job sẽ dừng ở DLQ và chờ admin xử lý thủ công.</Note>
        </Section>

        {/* ── SECTION: Server Logs ── */}
        <Section icon={<Terminal />} title="Server Logs (Root)" color="var(--text-secondary)">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
            Xem log hoạt động của server theo thời gian thực qua WebSocket.
            Hữu ích khi cần debug lỗi hoặc theo dõi hoạt động hệ thống.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Card title="Real-time log streaming" desc="Log được stream về qua WebSocket ngay khi có sự kiện — không cần refresh trang." />
            <Card title="Filter theo service" desc="Lọc log theo service cụ thể: API, AI, Queue Worker, Batch Job, CRM..." />
            <Card title="Filter theo mức độ" desc="Lọc theo mức độ: INFO, WARN, ERROR — giúp tập trung vào các vấn đề quan trọng." />
          </div>

          <Note type="blue">Log được định dạng JSON cấu trúc với: timestamp, level, service, message và context. Dễ dàng parse và phân tích.</Note>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════════
            PHẦN 5 — FAQ
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={12} /> Phần 5 — Câu hỏi thường gặp
        </div>

        {/* ── SECTION: FAQ ── */}
        <Section icon={<Info />} title="Câu hỏi thường gặp" color="var(--info)" defaultOpen>
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
                a: 'Mỗi bài viết kèm các gợi ý ảnh minh họa bằng tiếng Anh — một ảnh đại diện và một ảnh cho mỗi phần nội dung. Copy gợi ý này vào Midjourney, DALL-E hoặc các công cụ tạo ảnh AI khác.'
              },
              {
                q: 'Xóa bài rồi viết lại có bị tính vào giới hạn không?',
                a: 'Có. Giới hạn tính theo số lần viết thực tế, không phải số bài hiện có. Xóa bài không làm giảm biến đếm — đây là cơ chế kiểm soát chi phí.'
              },
              {
                q: 'Keyword Planner khác gì so với quản lý Từ khóa thông thường?',
                a: 'Quản lý Từ khóa phù hợp khi viết từng bài riêng lẻ. Keyword Planner phù hợp khi xây dựng cả một mảng nội dung theo chủ đề — AI tự phân nhóm, xác định bài chính và bài hỗ trợ, giúp tăng thứ hạng tổng thể.'
              },
              {
                q: 'Phân tích Website mất bao lâu?',
                a: 'Website nhỏ (dưới 50 trang) thường xong trong 1–2 phút. Website lớn hơn có thể mất vài phút. Theo dõi log tiến trình trực tiếp trên giao diện.'
              },
              {
                q: 'Đăng bài thất bại, tôi phải làm gì?',
                a: 'Bài bị lỗi hiển thị badge "Lỗi đăng" và nút "Thử lại". Nhấn "Thử lại" để gửi lại. Nếu vẫn lỗi, kiểm tra lại URL API đăng bài đã cài đúng chưa trong Cài đặt hoặc cài đặt công ty.'
              },
              {
                q: 'Nhập nhiều Gemini API Key có lợi gì?',
                a: 'Hệ thống tự luân phiên dùng từng key — giúp phân tải đều, tránh bị giới hạn tốc độ khi viết nhiều bài liên tiếp, đặc biệt khi dùng Hàng đợi hoặc Xử lý hàng loạt.'
              },
              {
                q: 'Làm sao thêm internal links tự động?',
                a: 'Vào Công ty → phần Internal Links → bật tính năng và cấu hình các URL muốn link tới trong bài. Hệ thống sẽ tự động chèn liên kết nội bộ vào bài viết.'
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

        {/* ── FOOTER ── */}
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--text-muted)' }}>
          AutoSEO — Hệ thống hỗ trợ sản xuất nội dung SEO tự động bằng AI cho website doanh nghiệp.
        </div>

      </div>
    </div>
  );
}
