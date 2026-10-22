"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, SlidersHorizontal, Link as LinkIcon, Image as ImageIcon, Maximize2, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { ActionDropdown } from "@/components/ActionDropdown";
import { Modal, ConfirmModal, FilterModal } from "@/components/Modal";
import {
  listExhibitions,
  createExhibition,
  updateExhibition,
  deleteExhibition,
  uploadFile,
  fetchFileAsDataUrl,
  type Exhibition,
} from "@/lib/api";

const statusMap: Record<string, { label: string; color: string }> = {
  "关切": { label: "关切", color: "bg-yellow-100 text-yellow-700" },
  "不考虑": { label: "不考虑", color: "bg-red-100 text-red-700" },
  "待商榷": { label: "待商榷", color: "bg-gray-100 text-gray-700" },
  "计划前往": { label: "计划前往", color: "bg-green-100 text-green-700" },
};

const statusOptions = ["关切", "待商榷", "不考虑", "计划前往"];

function getTimeStatus(startDate: string | null, endDate: string | null): { label: string; color: string } | null {
  if (!startDate || !endDate) return null;
  const now = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const start = startDate.split("T")[0];
  const end = endDate.split("T")[0];
  if (now < start) {
    return { label: "将至矣", color: "bg-cyan-100 text-cyan-700" };
  }
  if (now >= start && now <= end) {
    return { label: "进行中", color: "bg-yellow-100 text-yellow-700" };
  }
  return { label: "已结束", color: "bg-gray-100 text-gray-700" };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return dateStr.split("T")[0];
}

function ExhibitionCoverImage({ exhibition, onLightbox }: { exhibition: Exhibition; onLightbox: (url: string) => void }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (exhibition.cover_image_id) {
      fetchFileAsDataUrl(exhibition.cover_image_id).then(setImgUrl);
    }
  }, [exhibition.cover_image_id]);
  if (!imgUrl) return null;
  return (
    <div className="relative group cursor-pointer" onClick={() => onLightbox(imgUrl)}>
      <img
        src={imgUrl}
        alt={exhibition.name}
        className="w-full max-h-80 object-contain rounded-xs bg-gray-100"
      />
      <div className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Maximize2 className="w-4 h-4 text-white" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = statusMap[status] || { label: status, color: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function ExhibitionModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "create" | "edit";
  initialData?: Exhibition;
}) {
  const { pushNotification } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    region: "",
    name: "",
    start_date: "",
    end_date: "",
    location: "",
    type: "",
    booth_fee: "",
    contact: "",
    remark: "",
    status: "待商榷",
    description: "",
    link: "",
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverFileId, setCoverFileId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [existingAttachmentIds, setExistingAttachmentIds] = useState<number[]>([]);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    // 只在modal打开时初始化/重置表单数据，关闭时保留数据
    if (isOpen && !wasOpenRef.current) {
      // 首次打开Modal
      if (mode === "edit" && initialData) {
        setFormData({
          region: initialData.region || "",
          location: initialData.location || "",
          name: initialData.name || "",
          start_date: initialData.start_date ? initialData.start_date.split("T")[0] : "",
          end_date: initialData.end_date ? initialData.end_date.split("T")[0] : "",
          type: initialData.type || "",
          booth_fee: initialData.booth_fee || "",
          contact: initialData.contact || "",
          remark: initialData.remark || "",
          status: initialData.status || "待商榷",
          description: initialData.description || "",
          link: initialData.link || "",
        });
        setCoverFileId(initialData.cover_image_id ?? null);
        setExistingAttachmentIds(initialData.attachments?.map((a) => a.file_id) || []);
        if (initialData.cover_image_id) {
          fetchFileAsDataUrl(initialData.cover_image_id).then((url) => {
            if (url) setPreviewUrl(url);
          });
        }
      } else {
        // 新建模式，初始化空表单
        setFormData({
          region: "",
          location: "",
          name: "",
          start_date: "",
          end_date: "",
          type: "",
          booth_fee: "",
          contact: "",
          remark: "",
          status: "待商榷",
          description: "",
          link: "",
        });
        setCoverImage(null);
        setCoverFileId(null);
        setPreviewUrl("");
        setAttachmentFiles([]);
        setExistingAttachmentIds([]);
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, mode, initialData]);

   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!formData.region || !formData.location || !formData.name) {
       pushNotification({ style: "error", title: "请填写必填字段" });
       return;
     }
    setSubmitting(true);
    try {
      // Upload cover image first if new file selected
      let finalCoverId = coverFileId;
      if (coverImage) {
        const uploaded = await uploadFile(coverImage);
        finalCoverId = uploaded.id;
      }

      const attachmentIds: number[] = [];
      for (const file of attachmentFiles) {
        const uploaded = await uploadFile(file);
        attachmentIds.push(uploaded.id);
      }

      const allAttachmentIds = [...existingAttachmentIds, ...attachmentIds];

      const exhibitionInput = {
        region: formData.region,
        name: formData.name,
        location: formData.location,
        type: formData.type,
        booth_fee: formData.booth_fee,
        contact: formData.contact,
        remark: formData.remark,
        status: formData.status,
        description: formData.description,
        link: formData.link,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        cover_image_id: finalCoverId,
        attachment_ids: allAttachmentIds,
      };

      if (mode === "create") {
        await createExhibition(exhibitionInput);
      } else {
        await updateExhibition(initialData!.id, exhibitionInput, {
          updateCoverImage: coverImage != null || finalCoverId != null,
          replaceAttachments: true,
        });
      }
      pushNotification({
        style: "success",
        title: mode === "create" ? "创建成功" : "更新成功",
      });
      onSuccess();
      onClose();
    } catch {
      pushNotification({
        style: "error",
        title: mode === "create" ? "创建失败" : "更新失败",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "新建活动" : "编辑活动"}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors h-9 px-4 border border-control-border bg-control-bg hover:bg-control-bg-hover text-main active:scale-95"
          >
            取消
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors h-9 px-4 bg-accent text-accent-text hover:bg-accent-hover disabled:opacity-50 active:scale-95"
          >
            {submitting ? "提交中..." : mode === "create" ? "创建" : "更新"}
          </button>
</>
      }
    >
       <form onSubmit={handleSubmit}>
         <div className="grid grid-cols-1 gap-y-4">
           <div>
             <label className="textlabel block">封面图</label>
             <div className="mt-2 flex items-center gap-4">
               <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-control-border rounded-xs text-sm bg-control-bg hover:bg-control-bg-hover text-control">
                 <ImageIcon className="w-4 h-4" />
                 选择图片
                 <input
                   type="file"
                   accept="image/*"
                   className="hidden"
                   onChange={(e) => {
                     const file = e.target.files?.[0];
                     if (file) {
                       setCoverImage(file);
                       setPreviewUrl(URL.createObjectURL(file));
                     }
                   }}
                 />
               </label>
               {previewUrl && (
                 <img src={previewUrl} alt="预览" className="w-16 h-16 object-cover rounded-xs border border-control-border" />
               )}
             </div>
           </div>
           <div>
             <label className="textlabel block">
               活动名称 <span className="text-error">*</span>
             </label>
             <input
               value={formData.name}
               onChange={(e) =>
                 setFormData({ ...formData, name: e.target.value })
               }
               placeholder="例如：香港国际灯饰展"
               className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
             />
           </div>
           <div>
             <label className="textlabel block">地区 <span className="text-error">*</span>
             </label>
             <input
               value={formData.region}
               onChange={(e) =>
                 setFormData({ ...formData, region: e.target.value })
               }
               placeholder="例如：香港"
               className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
             />
           </div>
           <div>
             <label className="textlabel block">详细地址 <span className="text-error">*</span>
             </label>
             <input
               value={formData.location}
               onChange={(e) =>
                 setFormData({ ...formData, location: e.target.value })
               }
               placeholder="例如：香港会议展览中心"
               className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
             />
           </div>
           <div>
            <label className="textlabel block">附加链接</label>
            <input
              value={formData.link}
              onChange={(e) =>
                setFormData({ ...formData, link: e.target.value })
              }
              placeholder="https://example.com"
              className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <label className="textlabel block">开始日期</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
              />
            </div>
            <div>
              <label className="textlabel block">结束日期</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
              />
            </div>
          </div>
          
          <div>
            <label className="textlabel block">类型</label>
            <input
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              placeholder="例如：国际展会"
              className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
            />
          </div>
          <div>
            <label className="textlabel block">摊位费</label>
            <input
              value={formData.booth_fee}
              onChange={(e) =>
                setFormData({ ...formData, booth_fee: e.target.value })
              }
              placeholder="例如：5000元"
              className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
            />
          </div>
          <div>
            <label className="textlabel block">联系方式</label>
            <input
              value={formData.contact}
              onChange={(e) =>
                setFormData({ ...formData, contact: e.target.value })
              }
              placeholder="例如：联系人+电话"
              className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
            />
          </div>
          <div>
            <label className="textlabel block">状态</label>
            <div className="textlabel flex items-center gap-x-4 mt-2">
              {statusOptions.map((s) => (
                <label key={s} className="flex items-center gap-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={formData.status === s}
                    onChange={() => setFormData({ ...formData, status: s })}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="textlabel block">备注</label>
            <textarea
              value={formData.remark}
              onChange={(e) =>
                setFormData({ ...formData, remark: e.target.value })
              }
              placeholder="可选填写备注信息"
              rows={3}
              className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg resize-none"
            />
          </div>
          <div>
            <label className="textlabel block">详细描述</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="可选填写详细描述"
              rows={3}
              className="mt-2 w-full px-3 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg resize-none"
            />
          </div>
          <div>
            <label className="textlabel block">附件</label>
            <div className="mt-2">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-control-border rounded-xs text-sm bg-control-bg hover:bg-control-bg-hover text-control">
                <ImageIcon className="w-4 h-4" />
                添加附件
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAttachmentFiles((prev) => [...prev, ...files]);
                  }}
                />
              </label>
              {attachmentFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachmentFiles.map((file, i) => (
                    <div key={i} className="relative">
                      <img src={URL.createObjectURL(file)} alt="" className="w-12 h-12 object-cover rounded-xs border border-control-border" />
                      <button
                        type="button"
                        onClick={() => setAttachmentFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-error text-white rounded-full text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
</Modal>
  );
}

export default function ActivitiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Exhibition | null>(null);
  const [, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exhibition | null>(null);
  const { pushNotification } = useToast();
  const [showFilter, setShowFilter] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["进行中", "将至矣"]);
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 15;
  const [detailExhibition, setDetailExhibition] = useState<Exhibition | null>(null);
  const [cachedDetailExhibition, setCachedDetailExhibition] = useState<Exhibition | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // 当 detailExhibition 打开时，缓存数据以避免关闭动画时出现空 modal
  useEffect(() => {
    if (detailExhibition) {
      setCachedDetailExhibition(detailExhibition);
    }
  }, [detailExhibition]);

  useEffect(() => {
    let cancelled = false;
    async function fetchExhibitions() {
      try {
        const exhibitions = await listExhibitions();
        setData(exhibitions);
        pushNotification({
          style: "success",
          title: "数据同步成功",
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        pushNotification({
          style: "error",
          title: "数据同步失败",
          description: "请检查后端服务是否运行",
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchExhibitions();
    return () => {
      cancelled = true;
    };
  }, [pushNotification]);

  const filteredData = data.filter((e) => {
    const timeStatus = getTimeStatus(e.start_date, e.end_date);
    const timeLabel = timeStatus?.label || "";
    return (
      (e.name.includes(searchQuery) ||
      e.location.includes(searchQuery) ||
      e.status.includes(searchQuery)) &&
      (selectedRegions.length === 0 || selectedRegions.includes(e.region)) &&
      (selectedStatuses.length === 0 || selectedStatuses.includes(timeLabel))
    );
  });

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const allRegions = Array.from(new Set(data.map((e) => e.region).filter(Boolean))).sort();
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const paginatedData = filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full relative">
        <LoadingOverlay />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">
<div className="px-4 pt-4 pb-4 flex items-center justify-between gap-x-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-control-light" />
           <input
             type="text"
             placeholder="搜索活动名称、地区..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="w-full pl-9 pr-4 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
           />
        </div>
        <div className="flex items-center gap-x-3">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors focus:outline-hidden h-9 px-4 border border-control-border bg-control-bg hover:bg-control-bg-hover text-main active:scale-95"
            onClick={() => setShowFilter(true)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            筛选{selectedRegions.length > 0 || selectedStatuses.filter(s => s !== "进行中" && s !== "将至矣").length > 0 ? ` (${selectedRegions.length + selectedStatuses.filter(s => s !== "进行中" && s !== "将至矣").length})` : ""}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors focus:outline-hidden h-9 px-4 bg-accent text-accent-text hover:bg-accent-hover active:scale-95"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4" />
            新建活动
          </button>
        </div>
      </div>

      <FilterModal
        isOpen={showFilter}
        onClose={() => setShowFilter(false)}
        title="筛选"
        onClear={() => { setSelectedRegions([]); setSelectedStatuses(["进行中", "将至矣"]); }}
        onConfirm={() => setShowFilter(false)}
        hasSelection={selectedRegions.length + selectedStatuses.filter(s => s !== "进行中" && s !== "将至矣").length}
      >
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-control mb-2">活动状态</div>
            <div className="flex flex-wrap gap-2">
              {["进行中", "将至矣", "已结束"].map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`px-3 py-1.5 rounded-xs text-sm font-medium border transition-colors active:scale-95 ${
                    selectedStatuses.includes(status)
                      ? "border-accent bg-accent text-accent-text"
                      : "border-control-border bg-control-bg text-control hover:bg-control-bg-hover"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-control mb-2">目标地区</div>
            <div className="flex flex-wrap gap-2">
              {allRegions.map((region) => (
                <button
                  key={region}
                  onClick={() => toggleRegion(region)}
                  className={`px-3 py-1.5 rounded-xs text-sm font-medium border transition-colors active:scale-95 ${
                    selectedRegions.includes(region)
                      ? "border-accent bg-accent text-accent-text"
                      : "border-control-border bg-control-bg text-control hover:bg-control-bg-hover"
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FilterModal>

      {/* 移动端 Card 布局 */}
      <div className="flex-1 overflow-auto p-2 sm:hidden">
        <div className="grid grid-cols-1 gap-4">
          {filteredData.map((e) => {
            const timeStatus = getTimeStatus(e.start_date, e.end_date);
            const boothFeeMatch = e.booth_fee?.match(/\d+/);
            const boothFee = boothFeeMatch ? `${boothFeeMatch[0]}元摊位费` : null;
            
            return (
              <div
                key={e.id}
                className="relative border border-block-border rounded-xs bg-white p-4 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => setDetailExhibition(e)}
              >
                <div className="absolute top-2 right-2">
                  <ActionDropdown
                    actions={[
                      {
                        label: "编辑",
                        onClick: () => setEditTarget(e),
                      },
                      {
                        label: "删除",
                        danger: true,
                        onClick: () => setDeleteTarget(e),
                      },
                    ]}
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {timeStatus && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${timeStatus.color}`}>
                      {timeStatus.label}
                    </span>
                  )}
                  <StatusBadge status={e.status} />
                  {e.type && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {e.type}
                    </span>
                  )}
                </div>
                
                <h3 className="text-base font-medium text-main mb-3 pr-8">{e.name}</h3>
                
                <div className="space-y-1.5 text-sm">
                  <p className="text-control">
                    {e.region}{e.location ? ` · ${e.location}` : ""}
                  </p>
                  
                  {boothFee && (
                    <p className="text-control">{boothFee}</p>
                  )}
                  
                  {e.contact && (
                    <p className="text-control">{e.contact}</p>
                  )}
                  
                  <p className="text-control">
                    {formatDate(e.start_date)} - {formatDate(e.end_date)}
                  </p>
                  
                  {e.remark && (
                    <div className="pt-2 border-t border-block-border">
                      <p className="text-control-light text-xs line-clamp-2">{e.remark}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 桌面端 Table 布局 */}
      <div className="hidden sm:block flex-1 overflow-auto">
        <div className="min-w-[900px]">
          <table className="w-full text-sm">
            <thead className="bg-control-bg sticky top-0">
              <tr className="border-b border-block-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">活动名称</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">地区</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">日期</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">类型</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">状态</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">备注</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap w-10"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((e, idx) => {
                const timeStatus = getTimeStatus(e.start_date, e.end_date);
                return (
<tr
                    key={e.id}
                    className={idx % 2 === 1 ? "border-b border-block-border bg-control-bg/50 group" : "border-b border-block-border group"}
                  >
                    <td className="px-4 py-3 text-control whitespace-nowrap cursor-pointer" onClick={() => setDetailExhibition(e)}>
                      {timeStatus && (
                        <span className={`mr-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${timeStatus.color}`}>
                          {timeStatus.label}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        {e.name}
                        <LinkIcon className="w-3.5 h-3.5 text-accent cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity ml-1 align-middle" />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-control whitespace-nowrap">
                      {e.region}{e.location ? ` · ${e.location}` : ""}
                    </td>
                    <td className="px-4 py-3 text-control whitespace-nowrap">
                      {formatDate(e.start_date)} - {formatDate(e.end_date)}
                    </td>
                    <td className="px-4 py-3 text-control whitespace-nowrap">{e.type || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3 text-control max-w-xs">
                      {e.remark ? (e.remark.length > 20 ? e.remark.slice(0, 20) + "..." : e.remark) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <ActionDropdown
                        actions={[
                          {
                            label: "编辑",
                            onClick: () => setEditTarget(e),
                          },
                          {
                            label: "删除",
                            danger: true,
                            onClick: () => setDeleteTarget(e),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4 border-t border-block-border">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-control-border rounded-xs text-sm bg-control-bg hover:bg-control-bg-hover disabled:opacity-50 active:scale-95"
              >
                上一页
              </button>
              <span className="text-sm text-control">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-control-border rounded-xs text-sm bg-control-bg hover:bg-control-bg-hover disabled:opacity-50 active:scale-95"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </div>
      <ExhibitionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          const refreshData = async () => {
            try {
              const exhibitions = await listExhibitions();
              setData(exhibitions);
            } catch (err) {
              console.error("Failed to refresh:", err);
            }
          };
          refreshData();
        }}
        mode="create"
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="确认删除"
        description={`确定要删除 "${deleteTarget?.name}" 吗？此操作不可撤销。`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteExhibition(deleteTarget.id);
            pushNotification({ style: "success", title: "删除成功" });
            const exhibitions = await listExhibitions();
            setData(exhibitions);
          } catch {
            pushNotification({ style: "error", title: "删除失败" });
          }
          setDeleteTarget(null);
        }}
        danger
      />
      <ExhibitionModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          const refreshData = async () => {
            try {
              const exhibitions = await listExhibitions();
              setData(exhibitions);
            } catch (err) {
              console.error("Failed to refresh:", err);
            }
          };
          refreshData();
        }}
        mode="edit"
        initialData={editTarget!}
      />
      <Modal
        isOpen={!!detailExhibition}
        onClose={() => setDetailExhibition(null)}
        title="活动详情"
      >
        <div className="space-y-4">
          {cachedDetailExhibition && (
            <ExhibitionCoverImage
              exhibition={cachedDetailExhibition}
              onLightbox={setLightboxImage}
            />
          )}
          <div>
            <h3 className="text-lg font-medium text-main">{cachedDetailExhibition?.name}</h3>
            {cachedDetailExhibition?.link && (
              <a
                href={cachedDetailExhibition.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline flex items-center gap-1 mt-1 cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                {cachedDetailExhibition.link}
              </a>
            )}
          </div>
          {cachedDetailExhibition?.description && (
            <div>
              <label className="textlabel block mb-1">详细描述</label>
              <p className="text-sm text-control whitespace-pre-wrap">{cachedDetailExhibition.description}</p>
            </div>
          )}
          {cachedDetailExhibition?.booth_fee && (
            <div>
              <label className="textlabel block mb-1">摊位费</label>
              <p className="text-sm text-control">{cachedDetailExhibition.booth_fee}</p>
            </div>
          )}
          {cachedDetailExhibition?.contact && (
            <div>
              <label className="textlabel block mb-1">联系方式</label>
              <p className="text-sm text-control">{cachedDetailExhibition.contact}</p>
            </div>
          )}
          {cachedDetailExhibition?.remark && (
            <div>
              <label className="textlabel block mb-1">备注</label>
              <p className="text-sm text-control whitespace-pre-wrap">{cachedDetailExhibition.remark}</p>
            </div>
          )}
        </div>
      </Modal>
      {/* 图片全屏预览 */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="预览"
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}