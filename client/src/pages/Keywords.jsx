import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import apiClient from '../config/api';
import { marked } from 'marked';
import { useNavigate } from 'react-router-dom';
import {
  Search, PenTool, Sparkles, X, Loader2, Trash2, Eye, Calendar,
  ChevronLeft, Plus, Building2, BarChart2, FileText, Hash, RefreshCw,
  CheckCircle2, PlayCircle, Clock, Layers, Tag, AlignLeft, ListOrdered, XCircle,
  Users as UsersIcon, Copy, Check, Edit3, ChevronRight, Zap,
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
  const [hasPendingBatch, setHasPendingBatch] = useState(false);  // có job đang pending/scheduled trong DB không?
  const [pendingBatchJob, setPendingBatchJob] = useState(null);   // job object mới nhất nếu có
  const [pendingBatchTitles, setPendingBatchTitles] = useState(new Set()); // tất cả titles đang trong pending/scheduled batch
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchModalScheduleEnabled, setBatchModalScheduleEnabled] = useState(false);
  const [batchModalTime, setBatchModalTime] = useState('');
  const [batchCheckedTitles, setBatchCheckedTitles] = useState(new Set());

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
  const [copySuccess, setCopySuccess] = useState(null);

  // Edit article modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [editForm, setEditForm] = useState({ content: '', seo_title: '', seo_description: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Version history modal
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [articleVersions, setArticleVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState(null);

  // Pagination (keyword list)
  const [kwPage, setKwPage] = useState(1);
  const [kwTotal, setKwTotal] = useState(0);
  const [kwTotalTitles, setKwTotalTitles] = useState(0);
  const [kwTotalArticles, setKwTotalArticles] = useState(0);
  const KW_PAGE_SIZE = 20;

  // Write Queue (SSE background)
  const [writeQueueJob, setWriteQueueJob] = useState(null); // { jobId, status, total, done, succeeded, failed, currentTitle, results }
  const [checkedTitles, setCheckedTitles] = useState(new Set()); // titles được check để viết bằng hàng đợi SSE
  const sseRef = useRef(null); // giữ EventSource để có thể đóng khi cần
  const articleContentRef = useRef(null);

  // Lấy danh sách users cho dropdown (admin only, khi AUTH bật)
  useEffect(() => {
    if (showMultiUser) {
      apiClient.get('/api/users').then(r => setUserList(r.data)).catch(() => {});
    }
  }, [showMultiUser]);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setCheckedTitles(new Set()); }, [selectedKeyword?.id]);

  const fetchData = async (userId = filterUserId, page = kwPage, search = searchText, companyId = filterCompanyId) => {
    try {
      const params = { page, limit: KW_PAGE_SIZE };
      if (showMultiUser && userId) params.userId = userId;
      if (search) params.search = search;
      if (companyId) params.companyId = companyId;
      const comParams = (showMultiUser && userId) ? { userId } : {};
      const [kwRes, comRes] = await Promise.all([
        apiClient.get(API_KEYWORD, { params }),
        apiClient.get(API_COMPANY, { params: comParams })
      ]);
      const kwPayload = kwRes.data;
      setKeywords(kwPayload.data ?? kwPayload);
      setKwTotal(kwPayload.pagination?.total ?? (kwPayload.data ?? kwPayload).length);
      setKwTotalTitles(kwPayload.stats?.totalTitles ?? 0);
      setKwTotalArticles(kwPayload.stats?.totalArticles ?? 0);
      setCompanies(comRes.data);
      setFilterCompanies(comRes.data);
      if (comRes.data.length > 0) setSelectedCompanyId(comRes.data[0].id);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticlesForKeyword = useCallback(async (keyword, companyId) => {
    setLoadingArticles(true);
    try {
      const params = companyId ? { keyword, companyId } : { keyword };
      const res = await apiClient.get(API_ARTICLE, { params });
      const payload = res.data;
      setArticlesOfKeyword(payload.data ?? payload);
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
    fetchArticlesForKeyword(item.keyword, item.companyId);
    fetchPendingBatchJob(item.keyword);
    // Khôi phục queue job nếu đang chạy
    const storedJobId = localStorage.getItem(`wq_${item.keyword}`);
    if (storedJobId) resumeQueueJob(storedJobId, item.keyword, item.companyId);
  };

  // Fetch batch job đang pending cho keyword hiện tại (status = pending)
  const fetchPendingBatchJob = async (keyword) => {
    try {
      const res = await apiClient.get(API_BATCH_JOBS, { params: { keyword } });
      const jobs = Array.isArray(res.data) ? res.data : (res.data.jobs || []);
      const pendingJobs = jobs.filter(j => j.status === 'pending' || j.status === 'scheduled');
      const pendingJob = pendingJobs[0] || null;
      // Gom tất cả titles từ các pending/scheduled jobs
      const allPendingTitles = new Set(
        pendingJobs.flatMap(j => { try { return JSON.parse(j.titles || '[]'); } catch { return []; } })
      );
      setPendingBatchJob(pendingJob);
      setHasPendingBatch(pendingJobs.length > 0);
      setPendingBatchTitles(allPendingTitles);
    } catch (err) {
      console.error('Lỗi fetch batch job:', err.message);
      setHasPendingBatch(false);
      setPendingBatchJob(null);
      setPendingBatchTitles(new Set());
    }
  };

  // Kết nối SSE stream cho một write-queue job
  const connectQueueStream = useCallback((jobId, keyword, companyId) => {
    if (sseRef.current) { sseRef.current.close(); }
    const token = localStorage.getItem('autoseo_token');
    const streamUrl = `${API_WRITE_QUEUE}/${jobId}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const es = new EventSource(streamUrl);
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
        if (data.status === 'done' && data.article) {
          // Cập nhật trực tiếp vào articlesOfKeyword — không cần HTTP round-trip
          setArticlesOfKeyword(prev => prev.find(a => a.id === data.article.id) ? prev : [...prev, data.article]);
          fetchData();
          refreshStats();
        }
        return;
      }

      if (data.type === 'done') {
        setWriteQueueJob(prev => prev ? { ...prev, status: 'done', succeeded: data.succeeded, failed: data.failed } : prev);
        localStorage.removeItem(`wq_${keyword}`);
        fetchArticlesForKeyword(keyword, companyId);
        fetchData();
        refreshStats();
        es.close();
        sseRef.current = null;
        if (data.failed > 0) {
          toast.warning(`Hàng đợi hoàn tất: ${data.succeeded} thành công, ${data.failed} lỗi`, { description: `Từ khóa: ${keyword}` });
        } else {
          toast.success(`Hàng đợi hoàn tất: ${data.succeeded} bài đã viết`, { description: `Từ khóa: ${keyword}` });
        }
      }

      if (data.type === 'cancelled') {
        setWriteQueueJob(prev => prev ? { ...prev, status: 'cancelled', succeeded: data.succeeded, failed: data.failed } : prev);
        localStorage.removeItem(`wq_${keyword}`);
        fetchArticlesForKeyword(keyword, companyId);
        fetchData();
        refreshStats();
        es.close();
        sseRef.current = null;
        toast.info(`Hàng đợi đã dừng: ${data.succeeded} bài đã viết`, { description: `Từ khóa: ${keyword}` });
      }
    };

    es.onerror = () => {
      es.close();
      sseRef.current = null;
    };
  }, [fetchArticlesForKeyword, fetchData, refreshStats]);

  // Dừng write-queue job đang chạy
  const handleStopQueue = async () => {
    if (!writeQueueJob?.jobId) return;
    try {
      await apiClient.delete(`${API_WRITE_QUEUE}/${writeQueueJob.jobId}`);
    } catch { /* server tự emit 'cancelled' qua SSE */ }
  };

  // Kiểm tra và khôi phục queue job từ localStorage khi vào lại trang
  const resumeQueueJob = async (jobId, keyword, companyId) => {
    try {
      const res = await apiClient.get(`${API_WRITE_QUEUE}/${jobId}`);
      const job = res.data;
      setWriteQueueJob({ jobId, ...job });
      if (job.status === 'running') {
        connectQueueStream(jobId, keyword, companyId);
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
    const allUnwritten = (selectedKeyword.titles || []).filter(
      t => !articlesOfKeyword.find(a => a.title === t) && !pendingBatchTitles.has(t)
    );
    const unwrittenTitles = checkedTitles.size > 0
      ? allUnwritten.filter(t => checkedTitles.has(t))
      : allUnwritten;
    if (unwrittenTitles.length === 0) {
      toast.info('Tất cả tiêu đề đã có bài viết rồi!');
      return;
    }
    try {
      const res = await apiClient.post(API_WRITE_QUEUE, {
        keyword: selectedKeyword.keyword,
        titles: unwrittenTitles,
        companyId: selectedKeyword.companyId,
        keywordId: selectedKeyword.id,
      });
      const { jobId } = res.data;
      localStorage.setItem(`wq_${selectedKeyword.keyword}`, jobId);
      setWriteQueueJob({ jobId, status: 'running', total: unwrittenTitles.length, done: 0, succeeded: 0, failed: 0, currentTitle: null, results: [] });
      connectQueueStream(jobId, selectedKeyword.keyword, selectedKeyword.companyId);
    } catch (err) {
      const data = err.response?.data;
      if (data?.type === 'article_limit') {
        toast.error('Vượt giới hạn bài viết hôm nay!', { description: `Đã dùng: ${data.used}/${data.limit} bài • Còn lại: ${data.remaining ?? 0} bài` });
      } else {
        toast.error('Có lỗi: ' + (data?.error || err.message));
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
      toast.error('Có lỗi xảy ra. Vui lòng kiểm tra lại cấu hình API hoặc thử lại sau.');
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
      toast.error('Xóa thất bại!');
    }
  };

  // Khi viết 1 bài xong thành công, refresh danh sách bài
  const handleArticleWritten = () => {
    if (selectedKeyword) {
      fetchArticlesForKeyword(selectedKeyword.keyword, selectedKeyword.companyId);
      fetchData(); // cập nhật articleCount ngoài list
    }
  };

  // Xóa bài viết cũ rồi viết lại
  const handleRewrite = async (article) => {
    try {
      await apiClient.delete(`${API_ARTICLE}/${article.id}`);
      handleArticleWritten();
    } catch (err) {
      toast.error('Xóa bài cũ thất bại!');
    }
    setWriteModalTitle(article.title);
    setIsWriteModalOpen(true);
  };

  // Mở modal chỉnh sửa bài viết
  const handleEditArticle = (article) => {
    setEditingArticle(article);
    setEditForm({
      content: article.content || '',
      seo_title: article.seo_title || '',
      seo_description: article.seo_description || '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingArticle) return;
    setIsSavingEdit(true);
    try {
      const res = await apiClient.put(`${API_ARTICLE}/${editingArticle.id}`, editForm);
      setArticlesOfKeyword(prev => prev.map(a => a.id === editingArticle.id ? res.data : a));
      if (viewingArticle?.id === editingArticle.id) setViewingArticle(res.data);
      setIsEditModalOpen(false);
      setEditingArticle(null);
    } catch (err) {
      toast.error('Lưu thất bại: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenVersions = async (article) => {
    setIsVersionModalOpen(true);
    setArticleVersions([]);
    setLoadingVersions(true);
    try {
      const res = await apiClient.get(`${API_ARTICLE}/${article.id}/versions`);
      setArticleVersions(res.data);
    } catch (err) {
      toast.error('Không tải được lịch sử: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (versionId) => {
    if (!viewingArticle) return;
    if (!window.confirm('Khôi phục phiên bản này? Bản hiện tại sẽ được lưu lại trong lịch sử.')) return;
    setRestoringVersionId(versionId);
    try {
      // Optimistic: xóa ngay khỏi UI trước khi chờ server
      setArticleVersions(prev => prev.filter(v => v.id !== versionId));
      const res = await apiClient.post(`${API_ARTICLE}/${viewingArticle.id}/restore/${versionId}`);
      setViewingArticle(res.data);
      setArticlesOfKeyword(prev => prev.map(a => a.id === res.data.id ? res.data : a));
      // Reload versions từ server để đồng bộ
      const vRes = await apiClient.get(`${API_ARTICLE}/${res.data.id}/versions`);
      setArticleVersions(vRes.data);
    } catch (err) {
      toast.error('Khôi phục thất bại: ' + (err.response?.data?.error || err.message));
    } finally {
      setRestoringVersionId(null);
    }
  };

  // Gửi Gemini Batch Job — nhận scheduledAt (ISO string) nếu hẹn giờ, null nếu gửi ngay
  const handleWriteAll = async (scheduledAt = null) => {
    if (!selectedKeyword || isWritingAll) return;
    const allUnwritten = (selectedKeyword.titles || []).filter(
      t => !articlesOfKeyword.find(a => a.title === t)
    );
    const unwrittenTitles = batchCheckedTitles.size > 0
      ? allUnwritten.filter(t => batchCheckedTitles.has(t))
      : allUnwritten;
    if (unwrittenTitles.length === 0) {
      toast.info('Tất cả tiêu đề đã có bài viết rồi!');
      return;
    }

    setIsBatchModalOpen(false);
    setIsWritingAll(true);
    setBatchStatus(scheduledAt ? 'Đang hẹn giờ...' : 'Đang gửi job lên Gemini Batch API...');
    try {
      const body = { keyword: selectedKeyword.keyword, titles: unwrittenTitles, companyId: selectedKeyword.companyId, keywordId: selectedKeyword.id };
      if (scheduledAt) body.scheduledAt = scheduledAt;
      const res = await apiClient.post(API_BATCH_JOBS, body);
      setPendingBatchJob(res.data);
      setHasPendingBatch(true);
    } catch (err) {
      console.error('Lỗi gửi batch job:', err.message);
      const data = err.response?.data;
      if (data?.type === 'article_limit') {
        toast.error('Vượt giới hạn bài viết hôm nay!', { description: `Đã dùng: ${data.used}/${data.limit} bài • Còn lại: ${data.remaining ?? 0} bài` });
      } else {
        toast.error('Có lỗi: ' + (data?.error || err.message));
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


  // ============================================================
  // VIEW: Xem nội dung bài viết cụ thể
  // ============================================================
  if (viewingArticle) {
    const slugify = (str) => str
      .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a')
      .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e')
      .replace(/ì|í|ị|ỉ|ĩ/g, 'i')
      .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o')
      .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u')
      .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y')
      .replace(/đ/g, 'd')
      .replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'a')
      .replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'e')
      .replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'i')
      .replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'o')
      .replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'u')
      .replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'y')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const articleCompany = getCompany(selectedKeyword?.companyId);
    const companyUrl = (articleCompany?.url || '').replace(/\/$/, '');
    const suggestedUrl = viewingArticle.seo_title
      ? `${companyUrl}/${slugify(viewingArticle.seo_title)}`
      : '';

    const copyText = (text) => {
      if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text);
      }
      // fallback execCommand
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return Promise.resolve();
    };

    const makeCopyFn = (key, overrideValue) => async () => {
      try {
        if (overrideValue !== undefined) {
          await copyText(overrideValue);
        } else if (key === 'content' && articleContentRef.current) {
          const el = articleContentRef.current;
          const cv = getComputedStyle(document.documentElement);
          const v = (n) => cv.getPropertyValue(n).trim();
          const clone = el.cloneNode(true);
          const q = (sel, styles) => clone.querySelectorAll(sel).forEach(e => Object.assign(e.style, styles));
          // wrapper
          Object.assign(clone.style, { fontSize:'15px', lineHeight:'1.85', color:v('--text-primary'), maxWidth:'820px' });
          // headings shared
          q('h1,h2,h3,h4', { fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', color:v('--text-primary'), marginTop:'2em', marginBottom:'0.6em', lineHeight:'1.4', letterSpacing:'-0.2px' });
          q('h1', { fontSize:'26px', borderBottom:`2px solid ${v('--border')}`, paddingBottom:'10px' });
          q('h2', { fontSize:'20px' });
          q('h3', { fontSize:'17px' });
          q('h4', { fontSize:'15px' });
          q('p',  { marginBottom:'1.2em', color:v('--text-primary') });
          q('ul,ol', { paddingLeft:'1.6em', marginBottom:'1.2em' });
          q('li', { marginBottom:'0.4em' });
          q('blockquote', { borderLeft:`3px solid ${v('--accent')}`, padding:'10px 16px', margin:'1.5em 0', background:v('--accent-subtle'), borderRadius:`0 ${v('--radius-sm')} ${v('--radius-sm')} 0`, color:v('--text-secondary'), fontStyle:'italic' });
          q('code', { fontFamily:"'Fira Code','Consolas',monospace", fontSize:'13px', background:'rgba(99,102,241,0.1)', color:'#a78bfa', padding:'2px 6px', borderRadius:'4px' });
          q('pre',  { background:v('--bg-root'), border:`1px solid ${v('--border')}`, borderRadius:v('--radius-md'), padding:'16px 20px', overflowX:'auto', margin:'1.5em 0' });
          q('pre code', { background:'none', padding:'0', color:v('--text-primary'), fontSize:'13.5px' });
          q('strong', { fontWeight:'700', color:v('--text-primary') });
          q('em',     { fontStyle:'italic', color:v('--text-secondary') });
          q('a',  { color:v('--accent'), textDecoration:'underline', textUnderlineOffset:'3px' });
          q('hr', { border:'none', borderTop:`1px solid ${v('--border')}`, margin:'2em 0' });
          q('table', { width:'100%', borderCollapse:'collapse', margin:'1.5em 0', fontSize:'14px' });
          q('th,td', { padding:'10px 14px', border:`1px solid ${v('--border')}`, textAlign:'left' });
          q('th', { background:v('--bg-panel'), fontWeight:'600', color:v('--text-primary') });
          await copyText(clone.outerHTML);
        } else {
          await copyText(viewingArticle[key] || '');
        }
        setCopySuccess(key);
        setTimeout(() => setCopySuccess(null), 2000);
      } catch (err) {
        console.error('[copy] failed:', err);
      }
    };
    const CopyBtn = ({ field, value }) => (
      <button
        onClick={makeCopyFn(field, value)}
        title="Copy"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '11px', fontWeight: '500', padding: '3px 10px',
          background: copySuccess === field ? 'rgba(34,197,94,0.12)' : 'var(--accent-subtle)',
          border: `1px solid ${copySuccess === field ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.35)'}`,
          borderRadius: '5px', cursor: 'pointer',
          color: copySuccess === field ? '#4ade80' : 'var(--accent)',
          transition: 'all 0.2s', fontFamily: 'Inter, sans-serif', flexShrink: 0,
        }}
      >
        {copySuccess === field ? <><Check size={11} /> Đã copy</> : <><Copy size={11} /> Copy</>}
      </button>
    );

    return (<>
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleEditArticle(viewingArticle)}
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit3 size={15} /> Chỉnh Sửa
              </button>
              <button
                onClick={() => handleOpenVersions(viewingArticle)}
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Clock size={15} /> Lịch Sử
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm('Xóa bài viết này và viết lại?')) return;
                  await apiClient.delete(`${API_ARTICLE}/${viewingArticle.id}`);
                  setViewingArticle(null);
                  fetchArticlesForKeyword(selectedKeyword.keyword, selectedKeyword.companyId);
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
        </div>
        {/* SEO META */}
        {(viewingArticle.seo_title || viewingArticle.seo_description || viewingArticle.keyword) && (
          <div className="panel" style={{ padding: '18px 24px', marginBottom: '16px', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
              SEO Meta
            </div>
            {viewingArticle.seo_title && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex',justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  <div style={{ display: 'flex',alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)',  }}>
                    <Tag size={11} /> SEO Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({viewingArticle.seo_title.length} ký tự)</span>
                  </div>
                  <CopyBtn field="seo_title" />
                </div>
                <div id="seo-title" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--bg-panel)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {viewingArticle.seo_title}
                </div>
              </div>
            )}
            {viewingArticle.seo_description && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex',justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  <div style={{ display: 'flex',alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)',  }}>
                    <AlignLeft size={11} /> Meta Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({viewingArticle.seo_description.length} ký tự)</span>
                  </div>
                  <CopyBtn field="seo_description" />
                </div>
                <div id="seo-description" style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-panel)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', lineHeight: '1.6' }}>
                  {viewingArticle.seo_description}
                </div>
              </div>
            )}
            {viewingArticle.keyword && (
              <div style={{ marginBottom: suggestedUrl ? '12px' : '0' }}>
                <div style={{ display: 'flex',justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  <div style={{ display: 'flex',alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)',  }}>
                    <Hash size={11} /> Từ khóa
                  </div>
                  <CopyBtn field="keyword" />
                </div>
                <div id="seo-keyword" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', background: 'var(--bg-panel)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {viewingArticle.keyword}
                </div>
              </div>
            )}
            {suggestedUrl && (
              <div>
                <div style={{ display: 'flex',justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  <div style={{ display: 'flex',alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)',  }}>
                    <ChevronRight size={11} /> Link Gợi ý
                  </div>
                  <CopyBtn field="suggested_url" value={suggestedUrl} />
                </div>
                <div id='seo-link' style={{ fontSize: '13px', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99,102,241,0.25)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {suggestedUrl}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="panel" style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <CopyBtn field="content" />
          </div>
          <div
            ref={articleContentRef}
            className="article-html-content"
            id='seo-html-content'
            dangerouslySetInnerHTML={{ __html: marked.parse(viewingArticle.content || '') }}
          />
        </div>
      </div>

      {/* VERSION HISTORY MODAL — trong cùng return block của viewingArticle */}
      {isVersionModalOpen && (
        <div className="modal-overlay" onClick={() => setIsVersionModalOpen(false)}>
          <div className="modal-dialog" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="var(--accent)" /> Lịch Sử Phiên Bản
              </div>
              <button className="close-btn" onClick={() => setIsVersionModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingVersions ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  <Loader2 className="animate-spin" size={22} style={{ margin: '0 auto 8px' }} />
                  Đang tải lịch sử...
                </div>
              ) : articleVersions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Chưa có phiên bản nào được lưu.<br />
                  <span style={{ fontSize: 12 }}>Lịch sử được lưu tự động khi bạn chỉnh sửa bài.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {articleVersions.map((v, i) => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.seo_title || '(không có SEO title)'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          Phiên bản {articleVersions.length - i} · {formatDate(v.savedAt)}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline"
                        disabled={restoringVersionId === v.id}
                        onClick={() => handleRestoreVersion(v.id)}
                        style={{ flexShrink: 0, gap: 5 }}
                      >
                        {restoringVersionId === v.id
                          ? <><Loader2 className="animate-spin" size={12} /> Đang khôi phục...</>
                          : <><RefreshCw size={12} /> Khôi phục</>}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT ARTICLE MODAL */}
      {isEditModalOpen && editingArticle && (
        <div className="modal-overlay" onClick={() => !isSavingEdit && setIsEditModalOpen(false)}>
          <div className="modal-dialog" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="var(--accent)" /> Chỉnh Sửa Bài Viết
              </div>
              <button className="close-btn" disabled={isSavingEdit} onClick={() => setIsEditModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveEdit}>
                <div className="input-group">
                  <label className="input-label">SEO Title</label>
                  <input
                    type="text" className="input-field"
                    value={editForm.seo_title}
                    onChange={e => setEditForm(f => ({ ...f, seo_title: e.target.value }))}
                    disabled={isSavingEdit}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {editForm.seo_title.length} ký tự (khuyến nghị ≤ 60)
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Meta Description</label>
                  <textarea
                    className="input-field" rows={3}
                    value={editForm.seo_description}
                    onChange={e => setEditForm(f => ({ ...f, seo_description: e.target.value }))}
                    disabled={isSavingEdit}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {editForm.seo_description.length} ký tự (khuyến nghị ≤ 160)
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Nội dung bài viết (Markdown)</label>
                  <textarea
                    className="input-field" rows={14} style={{ fontFamily: 'monospace', fontSize: 13 }}
                    value={editForm.content}
                    onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                    disabled={isSavingEdit}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={isSavingEdit}>
                    {isSavingEdit
                      ? <><Loader2 className="animate-spin" size={15} /> Đang lưu...</>
                      : <><CheckCircle2 size={15} /> Lưu bài</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
    );
  }

  // ============================================================
  // VIEW: Chi tiết từ khóa - danh sách tiêu đề
  // ============================================================
  if (selectedKeyword) {
    const company = getCompany(selectedKeyword.companyId);
    const titles = selectedKeyword.titles || [];
    const unwrittenTitles = titles.filter(t => !getArticleForTitle(t));
    const unwrittenCount = unwrittenTitles.length;
    const writtenCount = titles.length - unwrittenCount;
    // Tiêu đề eligible cho SSE: chưa viết + chưa nằm trong pending batch
    const sseCandidates = unwrittenTitles.filter(t => !pendingBatchTitles.has(t));
    const checkedUnwritten = sseCandidates.filter(t => checkedTitles.has(t));
    const allUnwrittenChecked = sseCandidates.length > 0 && checkedUnwritten.length === sseCandidates.length;
    const toggleSelectAll = () => {
      if (allUnwrittenChecked) {
        setCheckedTitles(new Set());
      } else {
        setCheckedTitles(new Set(sseCandidates));
      }
    };

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
            {!isWritingAll && !writeQueueJob && (unwrittenCount > 0 || sseCandidates.length > 0) && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {unwrittenCount > 0 && (
                  <button onClick={() => { setBatchCheckedTitles(new Set()); setIsBatchModalOpen(true); }} className="btn btn-primary" style={{ gap: '6px' }}>
                    <Layers size={16} /> Batch API ({unwrittenCount} bài)
                  </button>
                )}
                {sseCandidates.length > 0 && (
                  <button
                    onClick={handleWriteAllQueue}
                    className="btn btn-outline"
                    style={{
                      gap: '6px',
                      color: 'var(--accent)',
                      background: checkedUnwritten.length > 0 ? 'rgba(99,102,241,0.08)' : 'transparent',
                      fontWeight: checkedUnwritten.length > 0 ? 600 : undefined,
                    }}
                  >
                    <ListOrdered size={16} />
                    {checkedUnwritten.length > 0
                      ? `Gửi Yêu Cầu · ${checkedUnwritten.length} đã chọn`
                      : `Gửi Yêu Cầu (${sseCandidates.length} bài)`}
                  </button>
                )}
              </div>
            )}
            {hasPendingBatch && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: pendingBatchJob?.status === 'scheduled' ? 'rgba(99,102,241,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${pendingBatchJob?.status === 'scheduled' ? 'rgba(99,102,241,0.25)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: '600', color: pendingBatchJob?.status === 'scheduled' ? 'var(--accent)' : 'var(--success)' }}>
                {pendingBatchJob?.status === 'scheduled' ? <Clock size={14} /> : <CheckCircle2 size={14} />}
                <span>
                  {pendingBatchJob?.status === 'scheduled'
                    ? `Batch hẹn lúc ${pendingBatchJob.scheduled_at ? new Date(pendingBatchJob.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}`
                    : `Đã tạo Batch Job${pendingBatchJob?.gemini_state ? ` (${pendingBatchJob.gemini_state.replace('JOB_STATE_', '')})` : ''}`}
                </span>
                <button
                  onClick={() => navigate('/batch-jobs')}
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-subtle)', border: 'none', borderRadius: 10, padding: '2px 8px', cursor: 'pointer' }}
                >
                  Xem →
                </button>
                <button
                  onClick={async () => {
                    if (pendingBatchJob?.id) {
                      try { await apiClient.delete(`${API_BATCH_JOBS}/${pendingBatchJob.id}`); } catch (e) { /* ignore */ }
                    }
                    fetchPendingBatchJob(selectedKeyword.keyword);
                  }}
                  title="Xóa batch job này và gửi lại"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'none', border: '1px solid currentColor', cursor: 'pointer', opacity: 0.5, padding: 0, color: 'inherit' }}
                >
                  <X size={11} />
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
                <button
                  onClick={handleStopQueue}
                  style={{ marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  title="Dừng hàng đợi sau bài đang viết"
                >
                  <X size={12} /> Dừng
                </button>
              </div>
            )}
            {/* QUEUE CANCELLED */}
            {writeQueueJob && writeQueueJob.status === 'cancelled' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: '600', color: 'var(--danger)' }}>
                <XCircle size={14} />
                <span>Đã dừng: {writeQueueJob.succeeded} thành công{writeQueueJob.failed > 0 ? `, ${writeQueueJob.failed} lỗi` : ''}</span>
                <button
                  onClick={() => setWriteQueueJob(null)}
                  style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}
                  title="Đóng"
                >
                  <XCircle size={14} />
                </button>
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
            {sseCandidates.length > 0 && !writeQueueJob && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {checkedUnwritten.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '3px 9px', borderRadius: 20 }}>
                    {checkedUnwritten.length}/{sseCandidates.length} đã chọn
                  </span>
                )}
                <button
                  onClick={toggleSelectAll}
                  style={{
                    fontSize: 12, fontWeight: 500,
                    color: allUnwrittenChecked ? 'var(--danger)' : 'var(--accent)',
                    background: allUnwrittenChecked ? 'rgba(239,68,68,0.07)' : 'rgba(99,102,241,0.07)',
                    border: `1px solid ${allUnwrittenChecked ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`,
                    cursor: 'pointer', padding: '4px 12px', borderRadius: 20,
                  }}
                >
                  {allUnwrittenChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>
            )}
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
              const queueResult = writeQueueJob?.results?.find(r => r?.title === title);
              const isQueueWritingThis = writeQueueJob?.status === 'running' && writeQueueJob?.currentTitle === title;

              const isChecked = checkedTitles.has(title);
              const isCheckable = !article && !writeQueueJob && !pendingBatchTitles.has(title);
              return (
                <div
                  key={idx}
                  onClick={isCheckable ? () => setCheckedTitles(prev => { const next = new Set(prev); isChecked ? next.delete(title) : next.add(title); return next; }) : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: article
                      ? 'rgba(34,197,94,0.04)'
                      : isChecked
                        ? 'rgba(99,102,241,0.05)'
                        : 'var(--bg-panel)',
                    border: `1px solid ${article
                      ? 'rgba(34,197,94,0.2)'
                      : isChecked
                        ? 'rgba(99,102,241,0.35)'
                        : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.15s',
                    cursor: isCheckable ? 'pointer' : 'default',
                  }}>
                  {/* Custom Checkbox - chỉ hiện cho tiêu đề chưa viết và khi không có queue */}
                  {isCheckable && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{ flexShrink: 0 }}
                    >
                      <div
                        onClick={() => setCheckedTitles(prev => { const next = new Set(prev); isChecked ? next.delete(title) : next.add(title); return next; })}
                        style={{
                          width: 18, height: 18, borderRadius: 5, cursor: 'pointer',
                          border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                          background: isChecked ? 'var(--accent)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s', flexShrink: 0,
                        }}
                      >
                        {isChecked && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                    </div>
                  )}

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
                          : pendingBatchTitles.has(title)
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
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
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
                          onClick={() => handleEditArticle(article)}
                          className="btn btn-sm btn-outline"
                          style={{ gap: '5px' }}
                        >
                          <Edit3 size={13} /> Sửa
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
                    ) : pendingBatchTitles.has(title) ? (
                      // Tiêu đề này đang nằm trong batch job đang chờ
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
            keywordId={selectedKeyword.id}
            onClose={() => { setIsWriteModalOpen(false); setWriteModalTitle(null); }}
            onSuccess={handleArticleWritten}
          />
        )}

        {/* EDIT ARTICLE MODAL */}
        {isEditModalOpen && editingArticle && (
          <div className="modal-overlay" onClick={() => !isSavingEdit && setIsEditModalOpen(false)}>
            <div className="modal-dialog" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit3 size={18} color="var(--accent)" /> Chỉnh Sửa Bài Viết
                </div>
                <button className="close-btn" disabled={isSavingEdit} onClick={() => setIsEditModalOpen(false)}>✕</button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSaveEdit}>
                  <div className="input-group">
                    <label className="input-label">SEO Title</label>
                    <input
                      type="text" className="input-field"
                      value={editForm.seo_title}
                      onChange={e => setEditForm(f => ({ ...f, seo_title: e.target.value }))}
                      disabled={isSavingEdit}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {editForm.seo_title.length} ký tự (khuyến nghị ≤ 60)
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Meta Description</label>
                    <textarea
                      className="input-field" rows={3}
                      value={editForm.seo_description}
                      onChange={e => setEditForm(f => ({ ...f, seo_description: e.target.value }))}
                      disabled={isSavingEdit}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {editForm.seo_description.length} ký tự (khuyến nghị ≤ 160)
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Nội Dung (Markdown)</label>
                    <textarea
                      className="input-field"
                      rows={18}
                      value={editForm.content}
                      onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                      disabled={isSavingEdit}
                      style={{ fontFamily: "'Fira Code','Consolas',monospace", fontSize: 13, resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>Hủy</button>
                    <button type="submit" className="btn btn-primary" disabled={isSavingEdit}>
                      {isSavingEdit
                        ? <><Loader2 className="animate-spin" size={15} /> Đang lưu...</>
                        : <><CheckCircle2 size={15} /> Lưu bài</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* BATCH MODAL */}
        {isBatchModalOpen && (() => {
          const allTitles = selectedKeyword.titles || [];
          // Tiêu đề chưa viết và CHƯA nằm trong pending batch nào
          const allUnwritten = allTitles.filter(t =>
            !articlesOfKeyword.find(a => a.title === t) && !pendingBatchTitles.has(t)
          );
          const batchChecked = allUnwritten.filter(t => batchCheckedTitles.has(t));
          const sendCount = batchChecked.length > 0 ? batchChecked.length : allUnwritten.length;
          const allUnwrittenBatchChecked = allUnwritten.length > 0 && batchChecked.length === allUnwritten.length;

          const toggleBatchTitle = (t) => setBatchCheckedTitles(prev => {
            const next = new Set(prev);
            next.has(t) ? next.delete(t) : next.add(t);
            return next;
          });
          const toggleBatchSelectAll = () => setBatchCheckedTitles(
            allUnwrittenBatchChecked ? new Set() : new Set(allUnwritten)
          );

          const computeScheduledAt = () => {
            if (!batchModalTime) return null;
            const [hh, mm] = batchModalTime.split(':').map(Number);
            const d = new Date();
            d.setSeconds(0, 0);
            d.setHours(hh, mm);
            if (d <= new Date()) d.setDate(d.getDate() + 1);
            return d;
          };
          const scheduledDate = batchModalScheduleEnabled ? computeScheduledAt() : null;

          return (
            <div className="modal-overlay" onClick={() => setIsBatchModalOpen(false)}>
              <div className="modal-dialog" style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

                {/* Accent top bar */}
                <div style={{ height: 4, background: 'linear-gradient(90deg, var(--accent), var(--accent-hover, var(--accent)))' }} />

                {/* Header */}
                <div className="modal-header" style={{ padding: '18px 22px 14px' }}>
                  <div>
                    <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={18} color="var(--accent)" /> Gửi Batch API
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 20, fontWeight: 600, fontSize: 11 }}>
                        {selectedKeyword.keyword}
                      </span>
                      <span>·</span>
                      <span>
                        <strong style={{ color: 'var(--accent)' }}>{sendCount}</strong>
                        {batchChecked.length > 0 ? ` / ${allUnwritten.length}` : ''} bài sẽ gửi
                      </span>
                      <span>·</span>
                      <span style={{ color: 'var(--warning)', fontWeight: 600 }}>⚡ Tiết kiệm 50% chi phí</span>
                    </div>
                  </div>
                  <button className="close-btn" onClick={() => setIsBatchModalOpen(false)}>✕</button>
                </div>

                <div className="modal-body" style={{ padding: '0 22px 18px' }}>

                  {/* Title list with checkboxes */}
                  <div style={{ marginTop: 10, marginBottom: 12 }}>
                    {/* List header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Danh sách tiêu đề ({allTitles.length})
                      </span>
                      {allUnwritten.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {batchChecked.length > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '2px 7px', borderRadius: 10 }}>
                              {batchChecked.length}/{allUnwritten.length} đã chọn
                            </span>
                          )}
                          <button
                            onClick={toggleBatchSelectAll}
                            style={{
                              fontSize: 11, fontWeight: 500, cursor: 'pointer', padding: '3px 10px', borderRadius: 20,
                              color: allUnwrittenBatchChecked ? 'var(--danger)' : 'var(--accent)',
                              background: allUnwrittenBatchChecked ? 'rgba(239,68,68,0.07)' : 'rgba(99,102,241,0.07)',
                              border: `1px solid ${allUnwrittenBatchChecked ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`,
                            }}
                          >
                            {allUnwrittenBatchChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Scrollable list */}
                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 2 }}>
                      {allTitles.map((t, i) => {
                        const isWritten = !!articlesOfKeyword.find(a => a.title === t);
                        const isPending = pendingBatchTitles.has(t);
                        const isDisabled = isWritten || isPending;
                        const isChecked = batchCheckedTitles.has(t);
                        return (
                          <div
                            key={i}
                            onClick={!isDisabled ? () => toggleBatchTitle(t) : undefined}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '5px 8px', borderRadius: 'var(--radius-sm)',
                              background: isDisabled ? 'transparent' : isChecked ? 'rgba(99,102,241,0.06)' : 'var(--bg-page)',
                              border: `1px solid ${isDisabled ? 'transparent' : isChecked ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                              cursor: isDisabled ? 'default' : 'pointer',
                              opacity: isDisabled ? 0.55 : 1,
                              transition: 'all 0.12s',
                            }}
                          >
                            {isWritten ? (
                              <CheckCircle2 size={13} color="var(--success)" style={{ flexShrink: 0 }} />
                            ) : isPending ? (
                              <Layers size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                            ) : (
                              <div style={{
                                width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                                border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                                background: isChecked ? 'var(--accent)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.12s',
                              }}>
                                {isChecked && <Check size={9} color="#fff" strokeWidth={3} />}
                              </div>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0, width: 16, textAlign: 'right' }}>
                              {i + 1}
                            </span>
                            <span style={{
                              fontSize: 11.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              color: isDisabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                            }}>
                              {t}
                            </span>
                            {isWritten && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--success)', background: 'rgba(34,197,94,0.1)', padding: '1px 6px', borderRadius: 10, flexShrink: 0 }}>
                                Đã viết
                              </span>
                            )}
                            {isPending && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: 10, flexShrink: 0 }}>
                                Đang batch
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mode selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {/* Gửi ngay */}
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      padding: '12px 16px', borderRadius: 'var(--radius-md)',
                      border: `2px solid ${!batchModalScheduleEnabled ? 'var(--accent)' : 'var(--border)'}`,
                      background: !batchModalScheduleEnabled ? 'var(--accent-subtle)' : 'var(--bg-panel)',
                    }}>
                      <input type="radio" name="batchMode" checked={!batchModalScheduleEnabled}
                        onChange={() => setBatchModalScheduleEnabled(false)} style={{ display: 'none' }} />
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: !batchModalScheduleEnabled ? 'var(--accent)' : 'var(--bg-page)',
                        border: `1px solid ${!batchModalScheduleEnabled ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                        <Zap size={16} color={!batchModalScheduleEnabled ? '#fff' : 'var(--text-muted)'} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: !batchModalScheduleEnabled ? 'var(--accent)' : 'var(--text-primary)' }}>Gửi ngay</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Submit lên Gemini Batch API ngay lập tức</div>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${!batchModalScheduleEnabled ? 'var(--accent)' : 'var(--border)'}`,
                        background: !batchModalScheduleEnabled ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {!batchModalScheduleEnabled && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                      </div>
                    </label>

                    {/* Hẹn giờ */}
                    <label style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                      padding: '12px 16px', borderRadius: 'var(--radius-md)',
                      border: `2px solid ${batchModalScheduleEnabled ? 'var(--accent)' : 'var(--border)'}`,
                      background: batchModalScheduleEnabled ? 'var(--accent-subtle)' : 'var(--bg-panel)',
                    }}>
                      <input type="radio" name="batchMode" checked={batchModalScheduleEnabled}
                        onChange={() => setBatchModalScheduleEnabled(true)} style={{ display: 'none' }} />
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: batchModalScheduleEnabled ? 'var(--accent)' : 'var(--bg-page)',
                        border: `1px solid ${batchModalScheduleEnabled ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                        <Clock size={16} color={batchModalScheduleEnabled ? '#fff' : 'var(--text-muted)'} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: batchModalScheduleEnabled ? 'var(--accent)' : 'var(--text-primary)' }}>Hẹn giờ gửi</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Lưu lại, tự động submit đúng giờ đã chọn</div>
                        {batchModalScheduleEnabled && (
                          <div style={{ marginTop: 12 }}>
                            <input
                              type="time"
                              value={batchModalTime}
                              onChange={e => setBatchModalTime(e.target.value)}
                              className="input-field"
                              style={{ width: 140, padding: '8px 12px', fontSize: 16, fontWeight: 700, letterSpacing: 1 }}
                              autoFocus
                            />
                            {scheduledDate ? (
                              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                                <CheckCircle2 size={13} color="var(--success)" />
                                <span>Sẽ gửi vào <strong style={{ color: 'var(--accent)' }}>{scheduledDate.toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong></span>
                              </div>
                            ) : (
                              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Chọn giờ để xem lịch hẹn</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                        border: `2px solid ${batchModalScheduleEnabled ? 'var(--accent)' : 'var(--border)'}`,
                        background: batchModalScheduleEnabled ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {batchModalScheduleEnabled && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                      </div>
                    </label>
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '14px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--bg-panel)' }}>
                  <button className="btn btn-outline" onClick={() => setIsBatchModalOpen(false)}>Hủy</button>
                  <button
                    className="btn btn-primary"
                    style={{ gap: 7, minWidth: 150 }}
                    disabled={(batchModalScheduleEnabled && !batchModalTime) || sendCount === 0}
                    onClick={() => handleWriteAll(scheduledDate ? scheduledDate.toISOString() : null)}
                  >
                    {batchModalScheduleEnabled ? <Clock size={14} /> : <Zap size={14} />}
                    {batchModalScheduleEnabled && batchModalTime
                      ? `Hẹn lúc ${batchModalTime} · ${sendCount} bài`
                      : `Gửi ngay · ${sendCount} bài`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ============================================================
  // VIEW: Danh sách từ khóa (mặc định)
  // ============================================================
  const filteredKeywords = keywords;

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
              onChange={e => {
                const val = e.target.value;
                setSearchText(val);
                setKwPage(1);
                fetchData(filterUserId, 1, val, filterCompanyId);
              }}
              style={{ paddingLeft: 32, fontSize: 14 }}
            />
            {searchText && (
              <button
                onClick={() => { setSearchText(''); setKwPage(1); fetchData(filterUserId, 1, '', filterCompanyId); }}
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
                  setFilterCompanyId('');
                  setKwPage(1);
                  fetchData(uid, 1, searchText, '');
                }}
                className="input-field"
                style={{ paddingLeft: 30, fontSize: 14, cursor: 'pointer',
                  borderColor: filterUserId ? 'var(--accent)' : undefined,
                }}
              >
                <option value="">Tất cả Tài Khoản</option>
                {userList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.username}{u.role === 'admin' ? ' (admin)' : ''}
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
              onChange={e => {
                const cid = e.target.value;
                setFilterCompanyId(cid);
                setKwPage(1);
                fetchData(filterUserId, 1, searchText, cid);
              }}
              className="input-field"
              style={{ paddingLeft: 30, fontSize: 14, cursor: 'pointer',
                borderColor: filterCompanyId ? 'var(--accent)' : undefined,
              }}
            >
              <option value="">
                Danh sách Website/Công ty 
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
                  setKwPage(1);
                  fetchData('', 1, '', '');
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
              {kwTotal} kết quả
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
              <div className="stat-card-value">{kwTotal || keywords.length}</div>
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
              <div className="stat-card-value">{kwTotalTitles}</div>
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
              <div className="stat-card-value">{kwTotalArticles}</div>
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
            <div className="table-header" style={{ gridTemplateColumns: showMultiUser ? '1fr 130px 110px 130px 110px' : '1fr 130px 110px 110px' }}>
              <div>Từ Khóa</div>
              <div>Thống Kê</div>
              <div>Ngày Tạo</div>
              {showMultiUser && <div>Người Tạo</div>}
              <div></div>
            </div>
            {filteredKeywords.map(item => {
              const company = getCompany(item.companyId);
              const creator = showMultiUser ? userList.find(u => u.id === item.createdBy) : null;
              return (
                <div key={item.id} className="table-row" style={{ gridTemplateColumns: showMultiUser ? '1fr 130px 110px 130px 110px' : '1fr 130px 110px 110px' }}>
                  {/* Từ khóa + công ty */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.keyword}
                    </div>
                    {company ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 3, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: 'var(--accent)', flexShrink: 0 }}>
                          {(company.name || 'C')[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {company.name}
                        </span>
                      </div>
                    ) : (
                      <div className="badge badge-purple" style={{ fontSize: '10px', padding: '1px 6px', width: 'fit-content' }}>SEO Keyword</div>
                    )}
                  </div>

                  {/* Thống kê */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="badge badge-blue" style={{ width: 'fit-content' }}><Hash size={10} /> {item.titleCount || 0} tiêu đề</div>
                    <div className="badge badge-green" style={{ width: 'fit-content' }}><FileText size={10} /> {item.articleCount || 0} bài</div>
                  </div>

                  {/* Ngày tạo */}
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(item.createdAt)}</div>

                  {/* Người tạo */}
                  {showMultiUser && (
                    <div>
                      {creator ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                          background: 'var(--bg-hover)', border: '1px solid var(--border)',
                          color: 'var(--text-secondary)', maxWidth: '100%',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {creator.full_name || creator.username}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>
                  )}

                  {/* Hành động */}
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleSelectKeyword(item)} className="btn btn-highlight btn-sm"><Eye size={14} /> Chi tiết</button>
                    <button onClick={(e) => handleDeleteKeyword(item.id, e)} className="btn btn-danger-ghost btn-icon" title="Xóa"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* PAGINATION */}
      {kwTotal > KW_PAGE_SIZE && (
        <KwPagination
          page={kwPage}
          total={kwTotal}
          pageSize={KW_PAGE_SIZE}
          onChange={(p) => { setKwPage(p); fetchData(filterUserId, p, searchText, filterCompanyId); }}
        />
      )}

      {/* EDIT ARTICLE MODAL */}
      {isEditModalOpen && editingArticle && (
        <div className="modal-overlay" onClick={() => !isSavingEdit && setIsEditModalOpen(false)}>
          <div className="modal-dialog" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="var(--accent)" /> Chỉnh Sửa Bài Viết
              </div>
              <button className="close-btn" disabled={isSavingEdit} onClick={() => setIsEditModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveEdit}>
                <div className="input-group">
                  <label className="input-label">SEO Title</label>
                  <input
                    type="text" className="input-field"
                    value={editForm.seo_title}
                    onChange={e => setEditForm(f => ({ ...f, seo_title: e.target.value }))}
                    disabled={isSavingEdit}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {editForm.seo_title.length} ký tự (khuyến nghị ≤ 60)
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Meta Description</label>
                  <textarea
                    className="input-field" rows={3}
                    value={editForm.seo_description}
                    onChange={e => setEditForm(f => ({ ...f, seo_description: e.target.value }))}
                    disabled={isSavingEdit}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {editForm.seo_description.length} ký tự (khuyến nghị ≤ 160)
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Nội Dung (Markdown)</label>
                  <textarea
                    className="input-field"
                    rows={18}
                    value={editForm.content}
                    onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                    disabled={isSavingEdit}
                    style={{ fontFamily: "'Fira Code','Consolas',monospace", fontSize: 13, resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setIsEditModalOpen(false)} disabled={isSavingEdit}>Hủy</button>
                  <button type="submit" className="btn btn-primary" disabled={isSavingEdit}>
                    {isSavingEdit
                      ? <><Loader2 className="animate-spin" size={15} /> Đang lưu...</>
                      : <><CheckCircle2 size={15} /> Lưu bài</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
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

function KwPagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '14px 0' }}>
      <button
        className="btn btn-outline btn-sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <ChevronLeft size={14} /> Trước
      </button>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '0 8px' }}>
        Trang {page} / {totalPages} · {total} từ khóa
      </span>
      <button
        className="btn btn-outline btn-sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        Tiếp <ChevronRight size={14} />
      </button>
    </div>
  );
}

export default Keywords;
