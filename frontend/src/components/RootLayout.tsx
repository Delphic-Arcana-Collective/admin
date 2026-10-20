"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/components/Toast";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import Image from "next/image";
import { firebaseAuth } from "@/lib/firebase";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pushNotification } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), (user) => {
      setIsLoggedIn(!!user);
      setLoading(false);
    });
  }, []);

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      pushNotification({ style: "error", title: "请输入邮箱" });
      return;
    }
    if (!password) {
      pushNotification({ style: "error", title: "请输入密码" });
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth(), email, password);
      pushNotification({ style: "success", title: "登录成功" });
    } catch (err) {
      const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        pushNotification({ style: "error", title: "邮箱或密码错误" });
      } else {
        pushNotification({ style: "error", title: "登录失败" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || isLoggedIn === null) {
    return null;
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex overflow-hidden">
        {/* 左侧图片区域：固定占 50% */}
        <div className="hidden lg:block w-1/2 flex-shrink-0 relative">
          <Image
            src="/login.jpg"
            alt="Login background"
            fill
            className="object-cover object-left-top"
          />
        </div>

        {/* 右侧登录区域：固定占 50%，内容居中 */}
        <div className="w-full lg:w-1/2 flex-shrink-0 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-16 xl:px-20">
          <div className="w-full max-w-lg flex-1 flex flex-col justify-center">
            <div className="text-center mb-10">
              <h2 className="text-5xl font-bold text-main">德尔菲秘仪社</h2>
              <p className="mt-3 text-base text-control">
                Delphic Arcana Collection
              </p>
            </div>

            <div className="border border-block-border rounded-xs p-8">
              <form onSubmit={handleSignin}>
                <div className="mb-5">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-control mb-2"
                  >
                    邮箱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-block-border rounded-xs text-control bg-white"
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div className="mb-6">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-control mb-2"
                  >
                    密码
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-block-border rounded-xs text-control bg-white pr-12"
                      placeholder="请在此输入密码"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-control text-xs cursor-pointer active:scale-95"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "隐藏" : "显示"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 text-base font-medium cursor-pointer transition-colors rounded-xs active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--color-accent)",
                    color: "var(--color-accent-text)",
                  }}
                >
                  {submitting ? "登录中..." : "登录"}
                </button>
              </form>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-control-light">
                请使用已登记的邮箱和密码登录
              </p>
            </div>
          </div>

          {/* 版权信息贴底 */}
          <div className="text-center">
            <p className="text-sm text-control-light">
              © {new Date().getFullYear()} Delphic. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      <div className="flex-1 flex overflow-hidden">
        {/* 移动端侧边栏遮罩 */}
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        <aside
          className={`shrink-0 fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto ${
            sidebarCollapsed
              ? "-translate-x-full lg:translate-x-0 w-0 lg:w-0 opacity-0"
              : "w-52 opacity-100 translate-x-0"
          } transition-all duration-300 ease-in-out lg:block`}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(true)}
          />
        </aside>

        <div className="flex flex-col min-w-0 flex-1 lg:flex">
          <Header
            sidebarCollapsed={sidebarCollapsed}
            onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <main className="flex-1 overflow-y-auto p-2 sm:p-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
