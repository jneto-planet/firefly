import React from "react";
import splashImage from "../assets/splash.png";

interface SplashScreenProps {
  onLoadingComplete: () => void;
}

const ACCENT = "#FFD86A";

export default function SplashScreen({ onLoadingComplete }: SplashScreenProps) {
  React.useEffect(() => {
    // Simulate loading time - you can replace this with actual loading logic
    const timer = setTimeout(() => {
      onLoadingComplete();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onLoadingComplete]);

  return (
    <div className="h-screen w-screen relative">
      {/* Full-screen splash image */}
      <img 
        src={splashImage} 
        alt="Firefly" 
        className="w-full h-full object-cover"
      />
      
      {/* Overlay content - positioned below center */}
      <div className="absolute inset-0 flex items-end justify-center pb-24">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div 
              className="w-3 h-3 rounded-full animate-bounce"
              style={{ 
                backgroundColor: ACCENT,
                animationDelay: '0ms'
              }}
            />
            <div 
              className="w-3 h-3 rounded-full animate-bounce"
              style={{ 
                backgroundColor: ACCENT,
                animationDelay: '150ms' 
              }}
            />
            <div 
              className="w-3 h-3 rounded-full animate-bounce"
              style={{ 
                backgroundColor: ACCENT,
                animationDelay: '300ms'
              }}
            />
          </div>
          <p className="text-white text-lg font-medium drop-shadow-lg">Loading...</p>
        </div>
      </div>
    </div>
  );
}