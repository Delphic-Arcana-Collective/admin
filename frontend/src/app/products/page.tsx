"use client";

import { useState, useEffect } from "react";
import { Search, Plus, ImageIcon } from "lucide-react";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { ActionDropdown } from "@/components/ActionDropdown";
import { Modal, ConfirmModal } from "@/components/Modal";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadFile,
  fetchFileAsDataUrl,
  type Product,
} from "@/lib/api";

function ProductCoverImage({ product, className }: { product: Product; className?: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (product.cover_file_id) {
      fetchFileAsDataUrl(product.cover_file_id).then(setImgUrl);
    }
  }, [product.cover_file_id]);
  if (!imgUrl) return null;
  return <img src={imgUrl} alt={product.name} className={className} />;
}

function formatDateTimeForDisplay(dateStr: string): string {
  if (!dateStr) return "-";
  const cleaned = dateStr.replace(/[+-]\d{2}:\d{2}$/, "").replace(/\.\d{3}/, "");
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function ProductModal({
  open,
  product,
  onSave,
  onCancel,
}: {
  open: boolean;
  product?: Product;
  onSave: (data: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [tag, setTag] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(String(product.price));
      setTag(product.sku?.attrs?.tag || "");
    } else {
      setName("");
      setPrice("");
      setTag("");
      setImage(null);
    }
  }, [product, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (!price || isNaN(Number(price))) return;
    
    setSaving(true);
    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("price", price);
    if (tag) formData.append("tag", tag);
    if (image) {
      formData.append("image", image);
    }
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title={product ? "编辑商品" : "添加商品"}
      footer={
        <>
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors h-9 px-4 border border-control-border bg-control-bg hover:bg-control-bg-hover text-main active:scale-95"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !price}
            className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors h-9 px-4 bg-accent hover:bg-accent-hover text-white disabled:opacity-50 active:scale-95"
          >
            保存
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-control mb-1">
            名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-control-border rounded-xs text-control bg-control-bg"
            placeholder="商品名称"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-control mb-1">
              单价 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-control-border rounded-xs text-control bg-control-bg"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-control mb-1">标签</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full px-3 py-2 border border-control-border rounded-xs text-control bg-control-bg"
              placeholder="如：魔法道具"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-control mb-1">图片</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-control-border rounded-xs text-control bg-control-bg"
          />
        </div>
      </div>
    </Modal>
  );
}

export default function ProductsPage() {
  const { pushNotification } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      const products = await listProducts();
      setProducts(products);
    } catch {
      pushNotification({ style: "error", title: "获取商品失败" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = products.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    setEditingProduct(undefined);
    setShowModal(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleSave = async (data: FormData) => {
    try {
      let coverFileId: number | undefined;
      const imageFile = data.get("image") as File | null;
      if (imageFile && imageFile.size > 0) {
        const uploaded = await uploadFile(imageFile);
        coverFileId = uploaded.id;
      }

      const name = data.get("name") as string;
      const price = Number(data.get("price"));
      const tag = (data.get("tag") as string) || "";

      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name,
          price,
          tag,
          cover_file_id: coverFileId,
        });
      } else {
        await createProduct({
          name,
          price,
          tag,
          cover_file_id: coverFileId,
        });
      }

      pushNotification({
        style: "success",
        title: editingProduct ? "商品已更新" : "商品已添加",
      });
      setShowModal(false);
      fetchProducts();
    } catch {
      pushNotification({ style: "error", title: "保存失败" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      pushNotification({ style: "success", title: "商品已删除" });
      setShowDeleteConfirm(null);
      fetchProducts();
    } catch {
      pushNotification({ style: "error", title: "删除失败" });
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="flex flex-col h-full -mx-4 -mt-4">
      <div className="px-4 pt-4 pb-4 flex items-center justify-between gap-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-control-light" />
           <input
             type="text"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="w-full pl-9 pr-4 py-2 border border-control-border rounded-xs text-sm text-control bg-control-bg"
             placeholder="搜索商品名称..."
           />
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center justify-center gap-2 rounded-xs text-sm font-medium whitespace-nowrap cursor-pointer transition-colors focus:outline-hidden h-9 px-4 bg-accent text-accent-text hover:bg-accent-hover"
        >
          <Plus className="w-4 h-4" />
          添加商品
        </button>
      </div>

      {/* 移动端 Card 布局 */}
      <div className="flex-1 overflow-auto p-2 sm:hidden">
        <div className="grid grid-cols-1 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {search ? "未找到商品" : "暂无商品"}
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div
                key={product.id}
                className="relative border border-block-border rounded-xs bg-white p-4 hover:shadow-sm transition-shadow"
              >
                <div className="absolute top-2 right-2">
                  <ActionDropdown
                    actions={[
                      {
                        label: "编辑",
                        onClick: () => handleEdit(product),
                      },
                      {
                        label: "删除",
                        danger: true,
                        onClick: () => setShowDeleteConfirm(product.id),
                      },
                    ]}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-md flex items-center justify-center">
                    {product.cover_file_id ? (
                      <ProductCoverImage product={product} className="w-full h-full object-cover rounded-md" />
                    ) : (
                      <ImageIcon className="size-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-main truncate">{product.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-gray-400">库存: {product.sku?.inventory?.stock_quantity ?? 0}</span>
                      <span className="text-accent font-medium">¥{isNaN(Number(product.price)) ? "0.00" : Number(product.price).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 桌面端 Table 布局 */}
      <div className="hidden sm:block flex-1 overflow-auto">
        <div className="min-w-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-control-bg sticky top-0">
              <tr className="border-b border-block-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">商品</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">价格</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">标签</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">库存</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap">创建时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-main whitespace-nowrap w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {search ? "未找到商品" : "暂无商品"}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, idx) => (
                  <tr
                    key={product.id}
                    className={`border-b border-control-border ${idx % 2 === 1 ? "bg-control-bg/50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex-shrink-0 bg-gray-100 rounded-md flex items-center justify-center">
                          {product.cover_file_id ? (
                            <ProductCoverImage product={product} className="w-full h-full object-cover rounded-md" />
                          ) : (
                            <ImageIcon className="size-4 text-gray-300" />
                          )}
                        </div>
                        <span className="text-main font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-accent font-medium whitespace-nowrap">
                      ¥{isNaN(Number(product.price)) ? "0.00" : Number(product.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-control whitespace-nowrap">
                      {product.sku?.attrs?.tag || "-"}
                    </td>
                    <td className="px-4 py-3 text-control whitespace-nowrap">
                      {product.sku?.inventory?.stock_quantity ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {formatDateTimeForDisplay(product.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ActionDropdown
                        actions={[
                          {
                            label: "编辑",
                            onClick: () => handleEdit(product),
                          },
                          {
                            label: "删除",
                            danger: true,
                            onClick: () => setShowDeleteConfirm(product.id),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductModal
        open={showModal}
        product={editingProduct}
        onSave={handleSave}
        onCancel={() => setShowModal(false)}
      />

      <ConfirmModal
        isOpen={!!showDeleteConfirm}
        title="删除商品"
        description="确定要删除这个商品吗？此操作无法撤销。"
        confirmText="删除"
        onConfirm={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
        onClose={() => setShowDeleteConfirm(null)}
        danger
      />
    </div>
  );
}