"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ShoppingCart, Minus, Plus, ImageIcon, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { LoadingOverlay } from "@/components/LoadingSpinner";
import { ConfirmModal } from "@/components/Modal";
import {
  listProducts,
  createOrder,
  fetchFileAsDataUrl,
  type Product,
} from "@/lib/api";

interface CartItem extends Product {
  quantity: number;
}

function ProductCoverImage({ fileId, alt, className }: { fileId: number; alt: string; className: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    fetchFileAsDataUrl(fileId).then(setImgUrl);
  }, [fileId]);
  if (!imgUrl) return null;
  return <img src={imgUrl} alt={alt} className={className} />;
}

export default function StorePage() {
  const { pushNotification } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTag, setActiveTag] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [loading, setLoading] = useState(true);

  const tags = useMemo(() => {
    const uniqueTags = Array.from(new Set(products.map(p => p.sku?.attrs?.tag || "未分类")));
    return [...uniqueTags.filter(t => t !== "未分类"), "未分类"];
  }, [products]);
  
  const [flyingKey, setFlyingKey] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const cartButtonRef = useRef<HTMLButtonElement>(null);
  const tagRefs = useRef<{ [key: string]: HTMLDivElement }>({});

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    listProducts()
      .then((productsData) => {
        console.log("Products API response:", productsData);
        setProducts(productsData);
        if (productsData.length > 0) {
          const tagSet = new Set<string>();
          productsData.forEach((p: Product) => tagSet.add(p.sku?.attrs?.tag || "未分类"));
          const sortedTags = Array.from(tagSet);
          const tags = [...sortedTags.filter(t => t !== "未分类"), "未分类"];
          setActiveTag(tags[0] || "未分类");
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch products:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main || isMobile === false) return;

    const handleScroll = () => {
      const pos = main.scrollTop;
      const h = main.clientHeight;
      const scrollH = main.scrollHeight;
      
      if (pos < 50) {
        setActiveTag(tags[0] || "未分类");
        return;
      }
      
      if (pos + h >= scrollH - 100) {
        const lastTag = tags[tags.length - 1];
        if (lastTag) setActiveTag(lastTag);
        return;
      }
      
      const dynamicTags = tags;
      for (const tag of dynamicTags) {
        const el = tagRefs.current[tag];
        if (el) {
          const tagTop = el.offsetTop - main.offsetTop;
          if (tagTop <= pos + h / 3) {
            setActiveTag(tag);
          }
        }
      }
    };

    main.addEventListener("scroll", handleScroll);
    return () => main.removeEventListener("scroll", handleScroll);
  }, [isMobile, tags]);

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const getItemQuantity = (id: string) => {
    return cart.find(item => item.id === id)?.quantity || 0;
  };

  const scrollToTag = (tag: string) => {
    if (tag === "全部") {
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const el = tagRefs.current[tag];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    setActiveTag(tag);
  };

  const addToCart = (product: Product) => {
    console.log("Adding to cart:", product);
    setFlyingKey(Date.now());
    
    setTimeout(() => setFlyingKey(0), 500);
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        console.log("Updating existing item quantity:", existing.quantity + 1);
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      console.log("Adding new item to cart:", product.name);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCart(prev => {
      const newCart = prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter((item): item is CartItem => item !== null);
      return newCart;
    });
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      pushNotification({ style: "warning", title: "购物车为空" });
      return;
    }
    setShowCart(false);
    setShowCheckoutConfirm(true);
  };

  const confirmCheckout = async () => {
    setShowCheckoutConfirm(false);
    
    const orderItems = cart.map(item => ({
      product_id: item.id,
      product_name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    try {
      await createOrder({
        user_id: 1,
        total: totalPrice,
        order_items: orderItems,
      });
    } catch (e) {
      console.error("Failed to save order:", e);
    }

    setCart([]);
    pushNotification({ style: "success", title: "下单成功！", description: "感谢您的惠顾" });
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  if (isMobile) {
    return <MobileLayout {...{ products, tags, activeTag, setActiveTag, tagRefs, mainRef, scrollToTag, getItemQuantity, addToCart, cart, showCart, setShowCart, totalPrice, totalCount, updateQuantity, handleCheckout, showCheckoutConfirm, setShowCheckoutConfirm, confirmCheckout, flyingKey, cartButtonRef }} />;
  }

  return (
    <PCLayout {...{ products, tags, cart, showCart, setShowCart, totalPrice, totalCount, updateQuantity, handleCheckout, showCheckoutConfirm, setShowCheckoutConfirm, confirmCheckout, getItemQuantity, addToCart }} />
  );
}

function MobileLayout({ products, tags, activeTag, tagRefs, mainRef, scrollToTag, getItemQuantity, addToCart, cart, showCart, setShowCart, totalPrice, totalCount, updateQuantity, handleCheckout, showCheckoutConfirm, setShowCheckoutConfirm, confirmCheckout, flyingKey, cartButtonRef }: { products: Product[]; tags: string[]; activeTag: string; tagRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement }>; mainRef: React.RefObject<HTMLDivElement | null>; scrollToTag: (tag: string) => void; getItemQuantity: (id: string) => number; addToCart: (product: Product) => void; cart: CartItem[]; showCart: boolean; setShowCart: (v: boolean) => void; totalPrice: number; totalCount: number; updateQuantity: (id: string, delta: number, e: React.MouseEvent) => void; handleCheckout: () => void; showCheckoutConfirm: boolean; setShowCheckoutConfirm: (v: boolean) => void; confirmCheckout: () => void; flyingKey: number; cartButtonRef: React.RefObject<HTMLButtonElement | null> }) {
  const renderProducts = (productList: Product[]) => {
    return productList.map(product => {
      const quantity = getItemQuantity(product.id);
      return (
        <ProductCard key={product.id} product={product} quantity={quantity} onAdd={() => addToCart(product)} onUpdateQty={updateQuantity} />
      );
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      <style jsx>{`
        @keyframes flyToCart {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.2); }
        }
        .flying-item { animation: flyToCart 0.5s ease-in-out forwards; }
      `}</style>

      {flyingKey !== 0 && (
        <div className="flying-item fixed right-8 bottom-24 w-12 h-12 z-50 pointer-events-none">
          <div className="w-full h-full bg-accent rounded-full flex items-center justify-center shadow-lg">
            <ImageIcon className="w-6 h-6 text-white" />
          </div>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30" onClick={() => setShowCart(false)} />
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-16 flex-shrink-0 overflow-y-auto bg-gray-50 border-r border-gray-200 py-3">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => scrollToTag(tag)}
              className={`w-full py-3 px-1 text-xs text-center border-l-2 transition-colors ${
                activeTag === tag
                  ? "border-accent text-accent font-medium bg-gray-100"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tag}
            </button>
          ))}
        </aside>

        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden pb-16">
          {tags.map(tag => (
            <div key={tag}>
              <div ref={(el) => { if (el) tagRefs.current[tag] = el; }} className="bg-gray-100 px-3 py-2 border-b border-gray-200 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">{tag}</span>
              </div>
              {renderProducts(products.filter(p => (p.sku?.attrs?.tag || "未分类") === tag))}
            </div>
          ))}
        </main>
      </div>

      <CartPanelMobile cart={cart} showCart={showCart} setShowCart={setShowCart} totalPrice={totalPrice} totalCount={totalCount} updateQuantity={updateQuantity} handleCheckout={handleCheckout} cartButtonRef={cartButtonRef} />
      
      <ConfirmModal
        isOpen={showCheckoutConfirm}
        title="确认下单"
        description={`确定要结算吗？共计 ¥${totalPrice}`}
        confirmText="确定"
        onConfirm={confirmCheckout}
        onClose={() => setShowCheckoutConfirm(false)}
      />
    </div>
  );
}



function PCLayout({ products, cart, showCart, setShowCart, totalPrice, totalCount, updateQuantity, handleCheckout, showCheckoutConfirm, setShowCheckoutConfirm, confirmCheckout, getItemQuantity, addToCart }: { products: Product[]; cart: CartItem[]; showCart: boolean; setShowCart: (v: boolean) => void; totalPrice: number; totalCount: number; updateQuantity: (id: string, delta: number, e: React.MouseEvent) => void; handleCheckout: () => void; showCheckoutConfirm: boolean; setShowCheckoutConfirm: (v: boolean) => void; confirmCheckout: () => void; getItemQuantity: (id: string) => number; addToCart: (product: Product) => void }) {
  const uniqueTags = Array.from(new Set(products.map(p => p.sku?.attrs?.tag || "未分类")));
  const tagList: string[] = [...uniqueTags.filter((t: string) => t !== "未分类"), "未分类"];
  const [activeTag, setActiveTag] = useState(tagList[0] || "未分类");
  
  const filteredProducts: Product[] = products.filter((p: Product) => (p.sku?.attrs?.tag || "未分类") === activeTag);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-main">商店</h1>
        <div className="flex items-center gap-4">
          <div className="text-lg font-medium text-accent">¥{totalPrice.toFixed(2)}</div>
          <button 
            onClick={() => setShowCart(!showCart)}
            className="relative p-2 hover:bg-gray-100 rounded-lg"
          >
            <ShoppingCart className="w-6 h-6 text-accent" />
            {totalCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                {totalCount}
              </div>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-48 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-500 mb-3">商品分类</h2>
          <div className="space-y-1">
            {tagList.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTag === tag
                    ? "bg-accent text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredProducts.map(product => {
              const quantity = getItemQuantity(product.id);
              return (
                <ProductCardPC key={product.id} product={product} quantity={quantity} onAdd={() => addToCart(product)} onUpdateQty={updateQuantity} />
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-400">暂无商品</div>
          )}
        </main>

        <CartPanelPC cart={cart} showCart={showCart} setShowCart={setShowCart} totalPrice={totalPrice} totalCount={totalCount} updateQuantity={updateQuantity} handleCheckout={handleCheckout} />
      </div>

      <ConfirmModal
        isOpen={showCheckoutConfirm}
        title="确认下单"
        description={`确定要结算吗？共计 ¥${totalPrice}`}
        confirmText="确定"
        onConfirm={confirmCheckout}
        onClose={() => setShowCheckoutConfirm(false)}
      />
    </div>
  );
}

function ProductCard({ product, quantity, onAdd, onUpdateQty }: { product: Product; quantity: number; onAdd: () => void; onUpdateQty: (id: string, delta: number, e: React.MouseEvent) => void }) {
  return (
    <div className="product-item w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer">
      <div className="w-[40%] aspect-square flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center">
        {product.cover_file_id ? (
          <ProductCoverImage fileId={product.cover_file_id} alt={product.name} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <ImageIcon className="w-10 h-10 text-gray-300" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-1">
        <div className="text-base font-medium text-main truncate">{product.name}</div>
        <div className="flex items-end justify-between">
          <span className="text-lg text-accent font-medium">¥{isNaN(Number(product.price)) ? "0.00" : Number(product.price).toFixed(2)}</span>
          {quantity > 0 ? (
            <div className="flex items-center gap-2">
              <div onClick={(e) => onUpdateQty(product.id, -1, e)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 cursor-pointer select-none">
                <Minus className="w-4 h-4" />
              </div>
              <span className="w-8 text-center text-sm font-medium select-none">{quantity}</span>
              <div onClick={(e) => { e.stopPropagation(); onAdd(); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-accent text-white cursor-pointer select-none">
                <Plus className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <div onClick={() => onAdd()} className="w-7 h-7 flex items-center justify-center rounded-full bg-accent text-white">
              <Plus className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCardPC({ product, quantity, onAdd, onUpdateQty }: { product: Product; quantity: number; onAdd: () => void; onUpdateQty: (id: string, delta: number, e: React.MouseEvent) => void }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-3">
        {product.cover_file_id ? (
          <ProductCoverImage fileId={product.cover_file_id} alt={product.name} className="w-full h-full object-cover rounded-lg" />
        ) : (
          <ImageIcon className="w-12 h-12 text-gray-300" />
        )}
      </div>
      <div className="mb-2">
        <h3 className="font-medium text-main truncate">{product.name}</h3>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-lg text-accent font-medium">¥{isNaN(Number(product.price)) ? "0.00" : Number(product.price).toFixed(2)}</span>
        {quantity > 0 ? (
          <div className="flex items-center gap-2">
            <div onClick={(e) => onUpdateQty(product.id, -1, e)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 cursor-pointer select-none">
              <Minus className="w-4 h-4" />
            </div>
            <span className="w-8 text-center text-sm font-medium select-none">{quantity}</span>
            <div onClick={() => onAdd()} className="w-7 h-7 flex items-center justify-center rounded-full bg-accent text-white cursor-pointer select-none">
              <Plus className="w-4 h-4" />
            </div>
          </div>
        ) : (
          <button onClick={() => onAdd()} className="w-7 h-7 flex items-center justify-center rounded-full bg-accent text-white">
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function CartPanelMobile({ cart, showCart, setShowCart, totalPrice, totalCount, updateQuantity, handleCheckout, cartButtonRef }: { cart: CartItem[]; showCart: boolean; setShowCart: (v: boolean) => void; totalPrice: number; totalCount: number; updateQuantity: (id: string, delta: number, e: React.MouseEvent) => void; handleCheckout: () => void; cartButtonRef: React.RefObject<HTMLButtonElement | null> }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div 
        className={`bg-white border-t border-gray-200 transition-all duration-300 ease-out overflow-hidden ${showCart ? "max-h-56" : "max-h-0"}`}
      >
        <div className="px-3 py-2 overflow-y-auto max-h-56">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">已选商品</span>
            <button onClick={() => setShowCart(false)} className="text-sm text-accent">收起</button>
          </div>
          <div>
            {cart.length === 0 ? (
              <div className="h-12 flex items-center justify-center text-gray-400">购物车为空</div>
            ) : (
              <>
                {cart.slice(0, 7).map(item => (
                  <div key={item.id} className="flex items-center gap-2 py-2 border-b border-gray-100">
                    <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded-md flex items-center justify-center">
                      {item.cover_file_id ? (
                        <ProductCoverImage fileId={item.cover_file_id} alt={item.name} className="w-full h-full object-cover rounded-md" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                      <div className="text-sm text-gray-500">¥{item.price}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div onClick={(e) => updateQuantity(item.id, -1, e)} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 cursor-pointer select-none">
                        <Minus className="w-3 h-3" />
                      </div>
                      <span className="w-6 text-center text-sm font-medium select-none">{item.quantity}</span>
                      <div onClick={(e) => updateQuantity(item.id, 1, e)} className="w-6 h-6 flex items-center justify-center rounded-full bg-accent text-white cursor-pointer select-none">
                        <Plus className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                ))}
                {cart.length > 7 && (
                  <div className="py-2 text-center text-sm text-gray-500">
                    还有 {cart.length - 7} 件商品
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="h-16 flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.1)]">
        <button ref={cartButtonRef} onClick={() => setShowCart(!showCart)} className="flex items-center gap-2">
          <div className="relative">
            <ShoppingCart className="w-6 h-6 text-accent" />
            {totalCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">{totalCount}</div>
            )}
          </div>
          <span className="text-base font-medium text-accent">¥{totalPrice}</span>
        </button>
        <button onClick={handleCheckout} className="px-6 py-2 bg-accent text-white font-medium rounded-lg">结账</button>
      </div>
    </div>
  );
}

function CartPanelPC({ cart, showCart, setShowCart, totalPrice, totalCount, updateQuantity, handleCheckout }: { cart: CartItem[]; showCart: boolean; setShowCart: (v: boolean) => void; totalPrice: number; totalCount: number; updateQuantity: (id: string, delta: number, e: React.MouseEvent) => void; handleCheckout: () => void }) {
  return (
    <>
      <div className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-30 transition-opacity ${showCart ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setShowCart(false)} />
      <div className={`w-80 bg-white border-l border-gray-200 flex flex-col transition-transform duration-300 z-40 ${showCart ? "translate-x-0" : "translate-x-full"} fixed right-0 top-0 bottom-0`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-main">购物车</h2>
          <button onClick={() => setShowCart(false)} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 max-h-[400px]">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">购物车为空</div>
          ) : (
            <div className="space-y-3">
              {cart.slice(0, 7).map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-14 h-14 flex-shrink-0 bg-gray-200 rounded-md flex items-center justify-center">
                    {item.cover_file_id ? (
                        <ProductCoverImage fileId={item.cover_file_id} alt={item.name} className="w-full h-full object-cover rounded-md" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                      <div className="text-sm text-gray-500">¥{item.price} × {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => updateQuantity(item.id, -1, e)} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 cursor-pointer">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={(e) => updateQuantity(item.id, 1, e)} className="w-6 h-6 flex items-center justify-center rounded-full bg-accent text-white cursor-pointer">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length > 7 && (
                <div className="py-2 text-center text-sm text-gray-500">
                  还有 {cart.length - 7} 件商品
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-600">合计</span>
            <span className="text-xl font-medium text-accent">¥{totalPrice.toFixed(2)}</span>
          </div>
          <button onClick={handleCheckout} disabled={cart.length === 0} className="w-full py-3 bg-accent text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
            结账 ({totalCount})
          </button>
        </div>
      </div>
    </>
  );
}