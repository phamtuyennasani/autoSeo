import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../config/api';
import { marked } from 'marked';
import { useNavigate } from 'react-router-dom';
import {
  Search, PenTool, Sparkles, X, Loader2, Trash2, Eye, Calendar,
  ChevronLeft, Plus, Building2, BarChart2, FileText, Hash, RefreshCw,
  CheckCircle2, PlayCircle, Clock, Layers, Tag, AlignLeft, ListOrdered, XCircle,
  Users as UsersIcon,
} from 'lucide-react';
import ArticleWriteModal from '../components/ArticleWriteModal';
import { useToken } from '../context/TokenContext';
import { useAuth } from '../context/AuthContext';

import { API } from '../config/api';

const API_KEYWORD    = API.keywords;
const API_COMPANY    = API.companies;
const API_ARTICLE    = API.articles;
const API_BATCH_JOBS = API.batchJobs;
const API_WRITE_QUEUE = API.writeQueue;

const Keywords = () => {
  const [keywords, setKeywords] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const { refreshStats } = useToken();
  const { user: currentUser, authEnabled } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin' || !currentUser;
  // Chỉ hiển thị UI phân quyền user khi AUTH bật (tránh hiện filter/cột thừa khi dùng đơn lẻ)
  const showMultiUser = authEnabled && isAdmin;

  // Filter theo user (chỉ admin)
  const [filterUserId, setFilterUserId] = useState(''); // '' = tất cả
  const [userList, setUserList] = useState([]);

  // Filter client-side
  const [searchText, setSearchText]           = useState('');
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [filterCompanies, setFilterCompanies] = useState([]); // companies hiển thị theo user filter

  // Detail view
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [articlesOfKeyword, setArticlesOfKeyword] = useState([]); // articles cho keyword đang xem
  const [loadingArticles, setLoadingArticles] = useState(false);

  // Write All state
  const [isWritingAll, setIsWritingAll] = useState(false);
  const [writeAllProgress, setWriteAllProgress] = useState({ current: 0, total: 0 });
  const [batchStatus, setBatchStatus] = useState('');
  const [hasPendingBatch, setHasPendingBatch] = useState(false);  // có job đang pending trong DB không?
  const [pendingBatchJob, setPendingBatchJob] = useState(null);   // job object nếu có

  // Add keyword modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [titleCount, setTitleCount] = useState(10);
  const [manualTitlesInput, setManualTitlesInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Article modal (single)
  const [writeModalTitle, setWriteModalTitle] = useState(null);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);

  // Article view
  const [viewingArticle, setViewingArticle] = useState(null);

  // Write Queue (SSE background)
  const [writeQueueJob, setWriteQueueJob] = useState(null); // { jobId, status, total, done, succeeded, failed, currentTitle, results }
  const sseRef = useRef(null); // giữ EventSource để có thể đóng khi cần

  // Lấy danh sách users cho dropdown (admin only, khi AUTH bật)
  useEffect(() => {
    if (showMultiUser) {
      apiClient.get('/api/users').then(r => setUserList(r.data)).catch(() => {});
    }
  }, [showMultiUser]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (userId = filterUserId) => {
    try {
      const params = {};
      if (showMultiUser && userId) params.userId = userId;
      // Companies: nếu filter user thì lấy công ty của user đó
      const comParams = (showMultiUser && userId) ? { userId } : {};
      const [kwRes, comRes] = await Promise.all([
        apiClient.get(API_KEYWORD, { params }),
        apiClient.get(API_COMPANY, { params: comParams })
      ]);
      setKeywords(kwRes.data);
      setCompanies(comRes.data);
      setFilterCompanies(comRes.data); // cập nhật dropdown công ty
      if (comRes.data.length > 0) setSelectedCompanyId(comRes.data[0].id);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticlesForKeyword = useCallback(async (keyword) => {
    setLoadingArticles(true);
    try {
      const res = await apiClient.get(API_ARTICLE, { params: { keyword } });
      setArticlesOfKeyword(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingArticles(false);
    }
  }, []);

  const handleSelectKeyword = (item) => {
    // Đóng SSE cũ nếu có
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    setWriteQueueJob(null);
    setSelectedKeyword(item);
    setArticlesOfKeyword([]);
    fetchArticlesForKeyword(item.keyword);
    fetchPendingBatchJob(item.keyword);
    // Khôi phục queue job nếu đang chạy
    const storedJobId = localStorage.getItem(`wq_${item.keyword}`);
    if (storedJobId) resumeQueueJob(storedJobId, item.keyword);
  };

  // Fetch batch job đang pending cho keyword hiện tại (status = pending)
  const fetchPendingBatchJob = async (keyword) => {
    try {
      const res = await apiClient.get(API_BATCH_JOBS, { params: { keyword } });
      // Lấy job mới nhất có status = pending (API trả về { jobs: [], lastCheck })
      const jobs = Array.isArray(res.data) ? res.data : (res.data.jobs || []);
      const pendingJob = jobs.find(j => j.status === 'pending') || null;
      setPendingBatchJob(pendingJob);
      setHasPendingBatch(!!pendingJob);
    } catch (err) {
      console.error('Lỗi fetch batch job:', err.message);
      setHasPendingBatch(false);
      setPendingBatchJob(null);
    }
  };

  // Kết nối SSE stream cho một write-queue job
  const connectQueueStream = useCallback((jobId, keyword) => {
    if (sseRef.current) { sseRef.current.close(); }
    const es = new EventSource(`${API_WRITE_QUEUE}/${jobId}/stream`);
    sseRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === 'error') {
        localStorage.removeItem(`wq_${keyword}`);
        setWriteQueueJob(null);
        es.close();
        return;
      }

      if (data.type === 'state') {
        setWriteQueueJob({ jobId, ...data });
        if (data.status === 'done') { es.close(); localStorage.removeItem(`wq_${keyword}`); }
        return;
      }

      if (data.type === 'writing') {
        setWriteQueueJob(prev => prev ? { ...prev, currentTitle: data.title, currentIndex: data.index } : prev);
        return;
      }

      if (data.type === 'progress') {
        setWriteQueueJob(prev => {
          if (!prev) return prev;
          const results = [...(prev.results || [])];
          results[data.index] = { title: data.title, status: data.status, articleId: data.articleId, error: data.error };
          return { ...prev, done: data.done, succeeded: (prev.succeeded || 0) + (data.status === 'done' ? 1 : 0), failed: (prev.failed || 0) + (data.status === 'error' ? 1 : 0), results };
        });
        // Cập nhật danh sách bài viết vừa xong
        if (data.status === 'done') {
          fetchArticlesForKeyword(keyword);
          fetchData();
          refreshStats();
        }
        return;
      }

      if (data.type === 'done') {
        setWriteQueueJob(prev => prev ? { ...prev, status: 'done', succeeded: data.succeeded, failed: data.failed } : prev);
        localStorage.removeItem(`wq_${keyword}`);
        fetchArticlesForKeyword(keyword);
        fetchData();
        refreshStats();
        es.close();
        sseRef.current = null;
      }
    };

    es.onerror = () => {
      es.close();
      sseRef.current = null;
    };
  }, [fetchArticlesForKeyword, fetchData, refreshStats]);

  // Kiểm tra và khôi phục queue job từ localStorage khi vào lại trang
  const resumeQueueJob = async (jobId, keyword) => {
    try {
      const res = await apiClient.get(`${API_WRITE_QUEUE}/${jobId}`);
      const job = res.data;
      setWriteQueueJob({ jobId, ...job });
      if (job.status === 'running') {
        connectQueueStream(jobId, keyword);
      } else {
        localStorage.removeItem(`wq_${keyword}`);
      }
    } catch {
      localStorage.removeItem(`wq_${keyword}`);
    }
  };

  // Bắt đầu viết tất cả bằng hàng đợi nền (SSE)
  const handleWriteAllQueue = async () => {
    if (!selectedKeyword || writeQueueJob?.status === 'running') return;
    const unwrittenTitles = (selectedKeyword.titles || []).filter(
      t => !articlesOfKeyword.find(a => a.title === t)
    );
    if (unwrittenTitles.length === 0) {
      alert('Tất cả tiêu đề đã có bài viết rồi!');
      return;
    }
    try {
      const res = await apiClient.post(API_WRITE_QUEUE, {
        keyword: selectedKeyword.keyword,
        titles: unwrittenTitles,
        companyId: selectedKeyword.companyId,
      });
      const { jobId } = res.data;
      localStorage.setItem(`wq_${selectedKeyword.keyword}`, jobId);
      setWriteQueueJob({ jobId, status: 'running', total: unwrittenTitles.length, done: 0, succeeded: 0, failed: 0, currentTitle: null, results: [] });
      connectQueueStream(jobId, selectedKeyword.keyword);
    } catch (err) {
      const data = err.response?.data;
      if (data?.type === 'article_limit') {
        alert(`⚠️ Vượt giới hạn bài viết hôm nay!\n\n${data.error}\n\nĐã dùng: ${data.used}/${data.limit} bài\nCòn lại: ${data.remaining ?? 0} bài`);
      } else {
        alert('Có lỗi: ' + (data?.error || err.message));
      }
    }
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    if (!keywordInput.trim() || !selectedCompanyId) return;
    setIsGenerating(true);
    const parsedManual = manualTitlesInput.trim()
      ? manualTitlesInput.split('\n').map(t => t.trim()).filter(Boolean)
      : null;
    try {
      await apiClient.post(API_KEYWORD, {
        keyword: keywordInput,
        companyId: selectedCompanyId,
        ...(parsedManual ? { manualTitles: parsedManual } : { titleCount }),
      });
      setKeywordInput('');
      setTitleCount(10);
      setManualTitlesInput('');
      setIsAddModalOpen(false);
      refreshStats(); // cập nhật token stats trên topbar
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra. Vui lòng kiểm tra lại cấu hình API hoặc thử lại sau.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteKeyword = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Xóa từ khóa này? Hành động không thể hoàn tác.")) return;
    try {
      await apiClient.delete(`${API_KEYWORD}/${id}`);
      fetchData();
      if (selectedKeyword?.id === id) setSelectedKeyword(null);
    } catch (error) {
      alert("Xóa thất bại!");
    }
  };

  // Khi viết 1 bài xong thành công, refresh danh sách bài
  const handleArticleWritten = () => {
    if (selectedKeyword) {
      fetchArticlesForKeyword(selectedKeyword.keyword);
      fetchData(); // cập nhật articleCount ngoài list
    }
  };

  // Xóa bài viết cũ rồi viết lại
  const handleRewrite = async (article) => {
    try {
      await apiClient.delete(`${API_ARTICLE}/${article.id}`);
      handleArticleWritten();
    } catch (err) {
      alert('Xóa bài cũ thất bại!');
    }
    setWriteModalTitle(article.title);
    setIsWriteModalOpen(true);
  };

  // Gửi Gemini Batch Job → trả về ngay, user xem kết quả ở trang Batch Jobs
  const handleWriteAll = async () => {
    if (!selectedKeyword || isWritingAll) return;
    const unwrittenTitles = (selectedKeyword.titles || []).filter(
      t => !articlesOfKeyword.find(a => a.title === t)
    );
    if (unwrittenTitles.length === 0) {
      alert('Tất cả tiêu đề đã có bài viết rồi!');
      return;
    }

    setIsWritingAll(true);
    setBatchStatus('Đang gửi job lên Gemini Batch API...');
    try {
      const res = await apiClient.post(API_BATCH_JOBS, {
        keyword: selectedKeyword.keyword,
        titles: unwrittenTitles,
        companyId: selectedKeyword.companyId,
      });
      // Cập nhật state từ kết quả trả về
      setPendingBatchJob(res.data);
      setHasPendingBatch(true);
      alert(`✅ Batch job đã được gửi!\n\nGemini sẽ xử lý ${res.data.total} bài viết.\nHãy kiểm tra trang Batch Jobs để theo dõi kết quả.`);
      navigate('/batch-jobs');
    } catch (err) {
      console.error('Lỗi gửi batch job:', err.message);
      const data = err.response?.data;
      if (data?.type === 'article_limit') {
        alert(`⚠️ Vượt giới hạn bài viết hôm nay!\n\n${data.error}\n\nĐã dùng: ${data.used}/${data.limit} bài\nCòn lại: ${data.remaining ?? 0} bài`);
      } else {
        alert('Có lỗi: ' + (data?.error || err.message));
      }
    } finally {
      setIsWritingAll(false);
      setBatchStatus('');
    }
  };


  const getArticleForTitle = (title) => articlesOfKeyword.find(a => a.title === title);
  const getCompany = (cId) => companies.find(c => c.id === cId);

  const formatDate = (iso) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const totalTitles = keywords.reduce((a, k) => a + (k.titleCount || 0), 0);
  const totalArticles = keywords.reduce((a, k) => a + (k.articleCount || 0), 0);

  // ============================================================
  // VIEW: Xem nội dung bài viết cụ thể
  // ============================================================
  if (viewingArticle) {
    return (
      <div>
        <div className="page-header">
          <button
            onClick={() => setViewingArticle(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '14px', fontFamily: 'Inter, sans-serif' }}
          >
            <ChevronLeft size={15} /> Quay lại tiêu đề
          </button>
          <div className="page-title-row">
            <div>
              <h1 className="page-title" style={{ fontSize: '18px' }}>{viewingArticle.title}</h1>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                <span className="badge badge-green"><CheckCircle2 size={11} /> Đã viết</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(viewingArticle.createdAt)}</span>
              </div>
            </div>
            <button
              onClick={async () => {
                if (!window.confirm('Xóa bài viết này và viết lại?')) return;
                await apiClient.delete(`${API_ARTICLE}/${viewingArticle.id}`);
                setViewingArticle(null);
                fetchArticlesForKeyword(selectedKeyword.keyword);
                fetchData();
                setWriteModalTitle(viewingArticle.title);
                setIsWriteModalOpen(true);
              }}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' }}
            >
              <RefreshCw size={15} /> Viết Lại
            </button>
          </div>
        </div>
        {/* SEO META */}
        {(viewingArticle.seo_title || viewingArticle.seo_description) && (
          <div className="panel" style={{ padding: '18px 24px', marginBottom: '16px', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
              SEO Meta
            </div>
            {viewingArticle.seo_title && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  <Tag size={11} /> SEO Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({viewingArticle.seo_title.length} ký tự)</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--bg-panel)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {viewingArticle.seo_title}
                </div>
              </div>
            )}
            {viewingArticle.seo_description && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  <AlignLeft size={11} /> Meta Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({viewingArticle.seo_description.length} ký tự)</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-panel)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', lineHeight: '1.6' }}>
                  {viewingArticle.seo_description}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="panel" style={{ padding: '28px 32px' }}>
          <div
            className="article-html-content"
            dangerouslySetInnerHTML={{ __html: marked.parse(viewingArticle.content || '') }}
          />
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW: Chi tiết từ khóa - danh sách tiêu đề
  // ============================================================
  if (selectedKeyword) {
    const company = getCompany(selectedKeyword.companyId);
    const titles = selectedKeyword.titles || [];
    const unwrittenCount = titles.filter(t => !getArticleForTitle(t)).length;
    const writtenCount = titles.length - unwrittenCount;

    return (
      <div>
        {/* HEADER */}
        <div className="page-header">
          <button
            onClick={() => setSelectedKeyword(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '14px', fontFamily: 'Inter, sans-serif', transition: 'color 0.15s ease' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <ChevronLeft size={15} /> Từ Khóa SEO
          </button>

          <div className="page-title-row">
            <div>
              <h1 className="page-title">"{selectedKeyword.keyword}"</h1>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {company && <span className="badge badge-purple"><Building2 size={11} /> {company.name}</span>}
                <span className="badge badge-blue"><Hash size={11} /> {titles.length} tiêu đề</span>
                <span className="badge badge-green"><CheckCircle2 size={11} /> {writtenCount} đã viết</span>
                {unwrittenCount > 0 && <span className="badge badge-orange"><Clock size={11} /> {unwrittenCount} chưa viết</span>}
              </div>
            </div>

            {/* NÚT VIẾT TẤT CẢ */}
            {unwrittenCount > 0 && !hasPendingBatch && !isWritingAll && !writeQueueJob && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleWriteAll} className="btn btn-primary" style={{ gap: '6px' }}>
                  <Layers size={16} /> Batch API ({unwrittenCount} bài)
                </button>
                <button onClick={handleWriteAllQueue} className="btn btn-outline" style={{ gap: '6px', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                  <ListOrdered size={16} /> Hàng Đợi SSE ({unwrittenCount} bài)
                </button>
              </div>
            )}
            {hasPendingBatch && unwrittenCount > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: '600', color: 'var(--success)' }}>
                <CheckCircle2 size={14} />
                <span>
                  Đã tạo Batch Job{pendingBatchJob?.gemini_state ? ` (${pendingBatchJob.gemini_state.replace('JOB_STATE_', '')})` : ''}
                </span>
                <button
                  onClick={() => navigate('/batch-jobs')}
                  style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-subtle)', border: 'none', borderRadius: 10, padding: '2px 8px', cursor: 'pointer' }}
                >
                  Xem job →
                </button>
              </div>
            )}
            {isWritingAll && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: '600', color: 'var(--accent)' }}>
                <Loader2 className="animate-spin" size={14} />
                {batchStatus || 'Đang gửi Batch Job...'}
              </div>
            )}
            {/* QUEUE RUNNING */}
            {writeQueueJob && writeQueueJob.status === 'running' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: '600', color: 'var(--accent)' }}>
                <Loader2 className="animate-spin" size={14} />
                <span>Hàng đợi: {writeQueueJob.done}/{writeQueueJob.total}</span>
                {writeQueueJob.currentTitle && (
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    — {writeQueueJob.currentTitle}
                  </span>
                )}
              </div>
            )}
            {/* QUEUE DONE */}
            {writeQueueJob && writeQueueJob.status === 'done' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: '600', color: 'var(--success)' }}>
                <CheckCircle2 size={14} />
                <span>Hàng đợi xong: {writeQueueJob.succeeded} thành công{writeQueueJob.failed > 0 ? `, ${writeQueueJob.failed} lỗi` : ''}</span>
                <button
                  onClick={() => setWriteQueueJob(null)}
                  style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}
                  title="Đóng"
                >
                  <XCircle size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TITLE LIST */}

        <div className="panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: writeQueueJob?.status === 'running' ? '12px' : '20px' }}>
            <Sparkles size={18} color="var(--accent)" />
            <span style={{ fontWeight: '600', fontSize: '15px' }}>Danh Sách Tiêu Đề SEO</span>
            {loadingArticles && <Loader2 size={14} className="animate-spin" color="var(--text-secondary)" />}
          </div>

          {/* QUEUE PROGRESS BAR */}
          {writeQueueJob?.status === 'running' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Loader2 size={11} className="animate-spin" />
                  {writeQueueJob.currentTitle
                    ? `Đang viết: "${writeQueueJob.currentTitle.length > 50 ? writeQueueJob.currentTitle.slice(0, 50) + '…' : writeQueueJob.currentTitle}"`
                    : 'Đang chuẩn bị...'}
                </span>
                <span style={{ fontWeight: 600 }}>{writeQueueJob.done}/{writeQueueJob.total}</span>
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(writeQueueJob.done / writeQueueJob.total) * 100}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          <div className="title-list">
            {titles.length > 0 ? titles.map((title, idx) => {
              const article = getArticleForTitle(title);
              const isThisWriting = isWritingAll && !article;
              const queueResult = writeQueueJob?.results?.[idx];
              const isQueueWritingThis = writeQueueJob?.status === 'running' && writeQueueJob?.currentIndex === idx;

              return (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: article ? 'rgba(34, 197, 94, 0.04)' : 'var(--bg-panel)',
                  border: `1px solid ${article ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.2s',
                }}>
                  {/* Index */}
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', width: '20px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {/* Status Icon */}
                  {article
                    ? <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0 }} />
                    : isQueueWritingThis
                      ? <Loader2 size={16} className="animate-spin" color="var(--accent)" style={{ flexShrink: 0 }} />
                      : queueResult?.status === 'done'
                        ? <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0 }} />
                        : queueResult?.status === 'error'
                          ? <XCircle size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
                          : hasPendingBatch
                            ? <Layers size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                            : <Clock size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  }

                  {/* Title */}
                  <span style={{ fontSize: '14px', lineHeight: '1.5', color: 'var(--text-primary)', flex: 1 }}>
                    {title}
                  </span>

                  {/* Date written */}
                  {article && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {formatDate(article.createdAt)}
                    </span>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {article ? (
                      <>
                        <button
                          onClick={() => setViewingArticle(article)}
                          className="btn btn-sm btn-highlight"
                          style={{ gap: '5px' }}
                        >
                          <Eye size={13} /> Xem bài
                        </button>
                        <button
                          onClick={() => {
                            setViewingArticle(null);
                            handleRewrite(article);
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ gap: '5px', color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.3)' }}
                          disabled={isWritingAll}
                        >
                          <RefreshCw size={13} /> Viết lại
                        </button>
                      </>
                    ) : isQueueWritingThis ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '3px 9px', borderRadius: 20 }}>
                        <Loader2 className="animate-spin" size={11} /> Đang viết...
                      </span>
                    ) : writeQueueJob?.status === 'running' && queueResult === undefined ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', background: 'var(--bg-panel)', padding: '3px 9px', borderRadius: 20, border: '1px solid var(--border)' }}>
                        <Clock size={11} /> Chờ viết
                      </span>
                    ) : queueResult?.status === 'error' ? (
                      <button
                        onClick={() => { setWriteModalTitle(title); setIsWriteModalOpen(true); }}
                        className="btn btn-primary btn-sm"
                        title={queueResult.error}
                      >
                        <RefreshCw size={13} /> Thử lại
                      </button>
                    ) : hasPendingBatch ? (
                      // Đã gửi batch → hiện badge, không cho viết lẻ nữa
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '3px 9px', borderRadius: 20 }}>
                        <Layers size={11} /> Đã gửi Batch
                      </span>
                    ) : (
                      <button
                        onClick={() => { setWriteModalTitle(title); setIsWriteModalOpen(true); }}
                        className="btn btn-primary btn-sm"
                        disabled={isWritingAll}
                      >
                        {isThisWriting
                          ? <><Loader2 className="animate-spin" size={13} /> Đang viết...</>
                          : <><PenTool size={13} /> Viết bài</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Lỗi tạo tiêu đề. Kiểm tra lại API Key.
              </div>
            )}
          </div>
        </div>

        {/* MODAL VIẾT BÀI (single) */}
        {isWriteModalOpen && writeModalTitle && (
          <ArticleWriteModal
            keyword={selectedKeyword.keyword}
            title={writeModalTitle}
            companyId={selectedKeyword.companyId}
            onClose={() => { setIsWriteModalOpen(false); setWriteModalTitle(null); }}
            onSuccess={handleArticleWritten}
          />
        )}
      </div>
    );
  }

  // ============================================================
  // VIEW: Danh sách từ khóa (mặc định)
  // ============================================================
  const filteredKeywords = keywords
    .filter(k => !searchText      || k.keyword.toLowerCase().includes(searchText.toLowerCase()))
    .filter(k => !filterCompanyId || k.companyId === filterCompanyId);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Quản Lý Từ Khóa SEO</h1>
            <p className="page-subtitle">Phân tích từ khóa và tự động sinh tiêu đề chuẩn SEO tối ưu</p>
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="btn btn-primary">
            <Plus size={16} /> Thêm Từ Khóa
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="panel" style={{ padding: '10px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Ô tìm kiếm */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              className="input-field"
              type="text"
              placeholder="Tìm kiếm từ khóa..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ paddingLeft: 32, height: 34, fontSize: 13 }}
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', display: 'flex', padding: 2,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Lọc theo user — chỉ admin và khi AUTH bật */}
          {showMultiUser && userList.length > 0 && (
            <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 140 }}>
              <UsersIcon size={13} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', pointerEvents: 'none',
              }} />
              <select
                value={filterUserId}
                onChange={e => {
                  const uid = e.target.value;
                  setFilterUserId(uid);
                  setFilterCompanyId(''); // reset công ty khi đổi user
                  fetchData(uid);
                }}
                className="input-field"
                style={{ paddingLeft: 30, height: 34, fontSize: 13, cursor: 'pointer',
                  borderColor: filterUserId ? 'var(--accent)' : undefined,
                }}
              >
                <option value="">Tất cả users</option>
                {userList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.username}{u.role === 'admin' ? ' (admin)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Lọc theo công ty — hiển thị theo user đang filter */}
          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 140 }}>
            <Building2 size={13} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <select
              value={filterCompanyId}
              onChange={e => setFilterCompanyId(e.target.value)}
              className="input-field"
              style={{ paddingLeft: 30, height: 34, fontSize: 13, cursor: 'pointer',
                borderColor: filterCompanyId ? 'var(--accent)' : undefined,
              }}
            >
              <option value="">
                {filterUserId ? 'Công ty của user này' : 'Tất cả công ty'}
              </option>
              {filterCompanies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Số kết quả + nút xóa filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
            {(searchText || filterCompanyId || filterUserId) && (
              <button
                onClick={() => {
                  setSearchText('');
                  setFilterCompanyId('');
                  setFilterUserId('');
                  fetchData('');
                }}
                style={{
                  padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <X size={11} /> Xóa lọc
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filteredKeywords.length} kết quả
            </span>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-row">
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">Tổng Từ Khóa</div>
              <div className="stat-card-value">{keywords.length}</div>
            </div>
            <div className="stat-card-icon" style={{ background: 'var(--accent-subtle)' }}>
              <Search size={18} color="var(--accent)" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">Tổng Tiêu Đề</div>
              <div className="stat-card-value">{totalTitles}</div>
            </div>
            <div className="stat-card-icon" style={{ background: 'var(--info-subtle)' }}>
              <BarChart2 size={18} color="var(--info)" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">Bài đã Viết</div>
              <div className="stat-card-value">{totalArticles}</div>
            </div>
            <div className="stat-card-icon" style={{ background: 'var(--success-subtle)' }}>
              <FileText size={18} color="var(--success)" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="stat-card-label">Websites</div>
              <div className="stat-card-value">{companies.length}</div>
            </div>
            <div className="stat-card-icon" style={{ background: 'var(--warning-subtle)' }}>
              <Building2 size={18} color="var(--warning)" />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="table-container">
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div className="skeleton" style={{ height: 14, width: '20%', borderRadius: 4 }}></div>
              <div className="skeleton" style={{ height: 14, width: '15%', borderRadius: 4 }}></div>
            </div>
          ))}
        </div>
        ) : filteredKeywords.length === 0 ? (
          <div className="table-container">
            <div className="table-empty">
              <div className="table-empty-icon"><Search size={24} /></div>
              <div className="table-empty-text">{keywords.length === 0 ? 'Chưa có từ khóa nào' : 'Không tìm thấy kết quả'}</div>
              <div className="table-empty-hint">{keywords.length === 0 ? 'Nhấn "Thêm Từ Khóa" để bắt đầu' : 'Thử thay đổi bộ lọc'}</div>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-header" style={{ gridTemplateColumns: showMultiUser ? '3fr 2fr 1.5fr 1fr 100px 120px' : '3fr 2fr 1.5fr 1fr 120px' }}>
              <div>Từ Khóa</div>
              <div>Website</div>
              <div>Thống Kê</div>
              <div>Ngày Tạo</div>
              {showMultiUser && <div>Người Tạo</div>}
              <div></div>
            </div>
            {filteredKeywords.map(item => {
              const company = getCompany(item.companyId);
              const creator = showMultiUser ? userList.find(u => u.id === item.createdBy) : null;
              return (
                <div key={item.id} className="table-row" style={{ gridTemplateColumns: showMultiUser ? '3fr 2fr 1.5fr 1fr 100px 120px' : '3fr 2fr 1.5fr 1fr 120px' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '3px' }}>{item.keyword}</div>
                  <div className="badge badge-purple" style={{ fontSize: '10.5px', padding: '2px 7px' }}>SEO Keyword</div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {company ? (
                    <>
                      <div style={{ width: 24, height: 24, borderRadius: 5, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: 'var(--accent)', flexShrink: 0 }}>
                        {(company.name || 'C')[0].toUpperCase()}
                      </div>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company.name}</span>
                    </>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className="badge badge-blue" style={{ width: 'fit-content' }}><Hash size={10} /> {item.titleCount || 0} tiêu đề</div>
                  <div className="badge badge-green" style={{ width: 'fit-content' }}><FileText size={10} /> {item.articleCount || 0} bài</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(item.createdAt)}</div>
                {showMultiUser && (
                  <div>
                    {creator ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                        background: 'var(--bg-hover)', border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                      }}>
                        {creator.username}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button onClick={() => handleSelectKeyword(item)} className="btn btn-highlight btn-sm"><Eye size={14} /> Chi tiết</button>
                  <button onClick={(e) => handleDeleteKeyword(item.id, e)} className="btn btn-danger-ghost btn-icon" title="Xóa"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
          </div>
        )}

      {/* MODAL THÊM TỪ KHÓA */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => !isGenerating && setIsAddModalOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent)" /> Tạo Từ Khóa Mới
              </div>
              <button className="close-btn" disabled={isGenerating} onClick={() => setIsAddModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddKeyword}>
                <div className="input-group">
                  <label className="input-label">Website / Công Ty áp dụng *</label>
                  {companies.length === 0 ? (
                    <div style={{ background: 'var(--warning-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '13px', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      Chưa có website nào. Vui lòng tạo tại trang "Website & Công Ty" trước.
                    </div>
                  ) : (
                    <select className="input-field" value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} required disabled={isGenerating}>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name} — {c.url}</option>)}
                    </select>
                  )}
                </div>
                <div className="input-group">
                  <label className="input-label">Từ khóa SEO cần phân tích *</label>
                  <input
                    type="text" className="input-field"
                    placeholder="VD: Thiết kế nội thất chung cư cao cấp"
                    value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                    required disabled={isGenerating} autoFocus
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">
                    Tiêu đề có sẵn
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(Tùy chọn — mỗi tiêu đề 1 dòng)</span>
                  </label>
                  <textarea
                    className="input-field"
                    rows={4}
                    placeholder={'Nhập tiêu đề thủ công, mỗi dòng 1 tiêu đề.\nNếu để trống, AI sẽ tự sinh tiêu đề.'}
                    value={manualTitlesInput}
                    onChange={e => setManualTitlesInput(e.target.value)}
                    disabled={isGenerating}
                  />
                  {manualTitlesInput.trim() && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
                      {manualTitlesInput.split('\n').filter(t => t.trim()).length} tiêu đề
                    </div>
                  )}
                </div>

                {!manualTitlesInput.trim() && (
                  <div className="input-group">
                    <label className="input-label">
                      Số tiêu đề AI cần tạo
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>(1 – 30)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="range" min={1} max={30} step={1}
                        value={titleCount}
                        onChange={e => setTitleCount(Number(e.target.value))}
                        disabled={isGenerating}
                        style={{ flex: 1, accentColor: 'var(--accent)' }}
                      />
                      <input
                        type="number" min={1} max={30}
                        value={titleCount}
                        onChange={e => setTitleCount(Math.max(1, Math.min(30, Number(e.target.value) || 10)))}
                        disabled={isGenerating}
                        style={{ width: 56, textAlign: 'center', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}
                      />
                    </div>
                  </div>
                )}

                <div className="info-box info-box-blue" style={{ marginBottom: '16px' }}>
                  <Sparkles size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                  {manualTitlesInput.trim()
                    ? <span>Sẽ lưu <strong>{manualTitlesInput.split('\n').filter(t => t.trim()).length} tiêu đề</strong> bạn đã nhập, không dùng AI.</span>
                    : <span>Hệ thống sẽ tự động phân tích và sinh <strong>{titleCount} tiêu đề</strong> tối ưu SEO cho từ khóa này.</span>
                  }
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)} disabled={isGenerating}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={isGenerating || companies.length === 0}>
                    {isGenerating
                      ? <><Loader2 className="animate-spin" size={15} /> Đang xử lý...</>
                      : manualTitlesInput.trim()
                        ? <><Plus size={15} /> Lưu Từ Khóa</>
                        : <><Sparkles size={15} /> Phân Tích Ngay</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Keywords;
