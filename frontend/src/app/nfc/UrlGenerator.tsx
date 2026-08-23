"use client";

import { useState } from "react";
import Image from "next/image";
import { useToast } from "@/components/Toast";

export default function UrlGenerator() {
  const { pushNotification } = useToast();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [toggleState, setToggleState] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [generatedUrl, setGeneratedUrl] = useState<string>("");

  const copyToClipboardFallback = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      textArea.remove();
      return true;
    } catch {
      textArea.remove();
      return false;
    }
  };

  const handleGenerate = async () => {
    if (!inputValue.trim()) {
      pushNotification({ style: "error", title: "请输入 ID" });
      return;
    }
    try {
      let urlToCopy = "";
      if (activeTab === 0) {
        const cardType = toggleState ? "group" : "person";
        urlToCopy = `mqqapi://card/show_pslcard?src_type=internal&version=1&uin=${inputValue}&card_type=${cardType}&source=qrcode`;
      } else {
        urlToCopy = `https://discord.com/users/${inputValue}`;
      }

      setGeneratedUrl(urlToCopy);

      try {
        await navigator.clipboard.writeText(urlToCopy);
        pushNotification({ style: "success", title: "已复制到剪贴板" });
      } catch {
        if (copyToClipboardFallback(urlToCopy)) {
          pushNotification({ style: "success", title: "已复制到剪贴板" });
        } else {
          pushNotification({ style: "error", title: "复制失败" });
        }
      }
    } catch (err) {
      pushNotification({
        style: "error",
        title: "生成失败",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleToggle = () => {
    setToggleState(!toggleState);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold text-main mb-4">NFC 链接生成器</h1>

      <div className="w-full max-w-2xl">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab(0)}
            className="px-4 py-2 font-medium text-sm transition-colors cursor-pointer flex items-center gap-2 rounded-xs"
            style={{
              backgroundColor: activeTab === 0 ? "var(--color-accent)" : "var(--color-control-bg)",
              color: activeTab === 0 ? "var(--color-accent-text)" : "var(--color-control)",
            }}
          >
            <Image
              src="/qq.svg"
              alt="QQ"
              width={16}
              height={16}
              className={activeTab === 0 ? "brightness-0 invert" : ""}
            />
            QQ
          </button>
          <button
            onClick={() => setActiveTab(1)}
            className="px-4 py-2 font-medium text-sm transition-colors cursor-pointer flex items-center gap-2 rounded-xs"
            style={{
              backgroundColor: activeTab === 1 ? "var(--color-accent)" : "var(--color-control-bg)",
              color: activeTab === 1 ? "var(--color-accent-text)" : "var(--color-control)",
            }}
          >
            <Image 
              src="/discord.svg" 
              alt="Discord" 
              width={16} 
              height={16}
              className={activeTab === 1 ? "brightness-0 invert" : ""} 
            />
            Discord
          </button>
        </div>

        <div
          className="border border-block-border rounded-xs p-6"
          style={{ minHeight: "300px" }}
        >
          <div className="space-y-4">
            <div>
              <label className="textlabel block mb-2">ID</label>
               <input
                 type="text"
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 placeholder="请输入您的 ID"
                 className="w-full px-4 py-3 border border-control-border rounded-xs text-sm text-control bg-control-bg"
                 onKeyDown={(e) => {
                   if (e.key === "Enter") {
                     handleGenerate();
                   }
                 }}
               />
            </div>

            {activeTab === 0 && (
              <div>
                <label className="textlabel block mb-2">群组</label>
                <button
                  className="relative w-14 h-7 bg-control-border transition-colors duration-300 cursor-pointer rounded-full"
                  style={{
                    backgroundColor: toggleState ? "var(--color-accent)" : undefined,
                  }}
                  onClick={handleToggle}
                >
                  <div
                    className="absolute top-0.5 w-6 h-6 bg-white transition-all duration-300 rounded-full shadow"
                    style={{
                      left: toggleState ? "calc(100% - 26px)" : "2px",
                    }}
                  />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-3 text-sm font-medium cursor-pointer transition-colors rounded-xs mt-6"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--color-accent-text)",
            }}
          >
            生成
          </button>

          {generatedUrl && (
            <div
              className="mt-4 px-3 py-2 text-xs font-mono break-all rounded-xs"
              style={{
                backgroundColor: "var(--color-control-bg)",
                border: "1px solid var(--color-control-border)",
              }}
            >
              {generatedUrl}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}