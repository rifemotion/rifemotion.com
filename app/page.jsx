"use client";

import { useEffect, useRef } from "react";

export default function HomePage() {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.defaultMuted = true;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <main>
      <video
        ref={videoRef}
        className="bg-video"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/video.mp4" type="video/mp4" />
        <source src="/video.webm" type="video/webm" />
      </video>

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
