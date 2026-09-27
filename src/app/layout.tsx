import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const SITE_URL = "https://libretts.is-an.org/";
const TITLE = "文本转语音 | 免费在线TTS转换工具 - LibreTTS";
const DESCRIPTION =
  "LibreTTS 是一款免费的在线文本转语音工具，支持多种声音选择，可调节语速和语调，提供即时试听和下载功能。快速将文字转换成自然流畅的语音。LibreTTS是免费的文本转语音工具，提供语音合成服务，支持多种语言，包括英语、法语、德语、西班牙语、阿拉伯语、中文、日语、朝鲜语、粤语、越南语等，以及多种语音风格，提供丰富的讲述人。LibreTTS is an online text-to-speech tool, also known as a voice generator, it can convert text to audio, and you can play or download audio files. Free online text-to-speech converter supporting multiple voices, adjustable speed and pitch, with instant preview and download features.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "文本转语音", "TTS", "语音合成", "在线配音", "OpenAI 文本转语音", "OpenAI", "AI",
    "讲述人", "FREE TTS", "文字转语音", "语音生成器", "AI配音", "免费TTS", "在线朗读", "文案工具",
  ],
  authors: [{ name: "Zwei" }],
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: "LibreTTS",
    locale: "zh_CN",
    images: [{ url: "/image/TTS.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: "LibreTTS是一款免费的在线文本转语音工具,支持多种声音选择,可调节语速和语调,提供即时试听和下载功能。",
    images: ["/image/TTS.png"],
  },
  icons: {
    icon: "/image/TTS.png",
    apple: "/image/TTS.png",
    shortcut: "/image/TTS.png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "LibreTTS - 文本转语音工具",
  url: SITE_URL,
  description: "免费在线文本转语音工具,支持多种声音选择,可调节语速和语调,提供即时试听和下载功能。",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "All",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Zwei" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          defer
          src="https://umami.zwei.de.eu.org/script.js"
          data-website-id="70106ca4-d1e5-4563-b574-ba09c3b5db16"
        />
      </body>
    </html>
  );
}
