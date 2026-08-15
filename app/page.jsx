"use client";

import { useEffect, useRef, useState } from "react";

export default function HomePage() {
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      
      const playVideo = () => {
        video.play().catch((err) => {
          console.warn("Autoplay was prevented, attempting muted play:", err);
          video.muted = true;
          video.play().catch(() => {});
        });
      };

      if (video.readyState >= 2) {
        playVideo();
      } else {
        video.addEventListener("loadeddata", () => {
          setVideoLoaded(true);
          playVideo();
        });
      }
    }
  }, []);

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#0a0a0a" }}>
      <video
        ref={videoRef}
        className="bg-video"
        autoPlay
        muted
        loop
        playsInline
        webkit-playsinline="true"
        preload="auto"
        onCanPlay={() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        }}
      >
        <source src="/video.mp4" type="video/mp4" />
        <source src="/video.webm" type="video/webm" />
      </video>

      {/* Анимационная маска открытия */}
      <div className="ae-blur-mask"></div>

      <div className="social-links">
        <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <img src="/icones/MdiInstagram.svg" alt="Instagram" />
        </a>
        <a href="#" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
          <img src="/icones/IcBaselineTiktok.svg" alt="TikTok" />
        </a>
        <a href="#" target="_blank" rel="noopener noreferrer" aria-label="X">
          <img src="/icones/RiTwitterXFill.svg" alt="X" />
        </a>
        <a href="#" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
          <img src="/icones/SiYoutubeFill.svg" alt="YouTube" />
        </a>
        <a href="#" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
          <img src="/icones/MingcuteTelegramFill.svg" alt="Telegram" />
        </a>
        <a href="mailto:rifemotion.info@gmail.com" aria-label="Email">
          <img src="/icones/MaterialSymbolsMailOutlineRounded.svg" alt="Email" />
        </a>
      </div>
    </main>
  );
}
