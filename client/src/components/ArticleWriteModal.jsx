import React, { useState, useEffect } from 'react';
import apiClient from '../config/api';
import { X, Loader2, FileText, CheckCircle2, Sparkles, Copy, Check, Building2 } from 'lucide-react';
import { useToken } from '../context/TokenContext';

import { API } from '../config/api';

const API_COMPANY = API.companies;
const API_ARTICLE = API.articles;

// companyId được truyền cố định từ Keyword -> không cần chọn lại
const ArticleWriteModal = ({ keyword, title, companyId, keywordId, onClose, onSuccess }) => {
  const [company, setCompany] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const { refreshStats } = useToken();

  useEffect(() => {
    if (companyId) {
      apiClient.get(API_COMPANY).then(res => {
        const found = res.data.find(c => c.id === companyId);
        setCompany(found || null);
      }).catch(() => {});
    }
  }, [companyId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await apiClient.post(API_ARTICLE, { keyword, title, companyId, keywordId });
      setGeneratedArticle(res.data);
      refreshStats(); // Cập nhật token stats trên topbar
      if (onSuccess) onSuccess(res.data); // Notify parent to refresh article list
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.details || 'Lỗi khi viết bài. Vui lòng kiểm tra lại cấu hình API hoặc thử lại sau.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedArticle) return;
    navigator.clipboard.writeText(generatedArticle.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={!isGenerating ? onClose : undefined}>
      <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--accent)" />
            <span className="modal-title">Viết Bài SEO</span>
          </div>
          <button className="close-btn" onClick={onClose} disabled={isGenerating}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* INFO */}
          <div className="info-box info-box-blue" style={{ marginBottom: '20px' }}>
            <Sparkles size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <div style={{ marginBottom: '4px' }}>
                <strong>Từ khóa:</strong> <span style={{ color: '#7dd3fc' }}>{keyword}</span>
              </div>
              <div>
                <strong>Tiêu đề:</strong> <span style={{ color: '#7dd3fc' }}>{title}</span>
              </div>
            </div>
          </div>

          {/* COMPANY INFO */}
          {company && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>
                {(company.name || 'C')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{company.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{company.url}</div>
              </div>
              <Building2 size={16} color="var(--accent)" style={{ marginLeft: 'auto', opacity: 0.6 }} />
            </div>
          )}

          {/* GENERATE BUTTON / RESULT */}
          {!generatedArticle ? (
            <div>
              {error && (
                <div style={{ background: 'var(--danger-subtle)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: '#fca5a5', fontSize: '13.5px', marginBottom: '16px' }}>
                  ⚠️ {error}
                </div>
              )}
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '15px', justifyContent: 'center' }}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating
                  ? <><Loader2 className="animate-spin" size={17} /> Đang viết bài... Vui lòng chờ</>
                  : <><FileText size={17} /> Bắt Đầu Viết Bài</>
                }
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: '600', fontSize: '14px' }}>
                  <CheckCircle2 size={18} /> Viết bài thành công!
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleCopy} style={{ gap: '5px' }}>
                  {copied ? <><Check size={14} /> Đã copy</> : <><Copy size={14} /> Copy Markdown</>}
                </button>
              </div>
              <div className="article-output">
                {generatedArticle.content}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticleWriteModal;
