import React from 'react';

/**
 * Full-screen branded loader for app loading states (network, auth, lazy route, etc.).
 * Mobile-responsive, app-like (safe areas, centered, works on all viewports).
 */
const AppLoader: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-dark-bg min-h-screen min-h-[100dvh] overscroll-none touch-none select-none"
      style={{
        padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <div className="flex flex-col items-center justify-center gap-6 px-6 max-w-[min(100vw,28rem)]">
        <div className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-dark-border border-t-neon-blue rounded-full animate-spin flex-shrink-0" />
        <div className="text-center">
          <p className="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono">
            tconnect-store
          </p>
          <p className="text-sm text-gray-400 mt-1.5">Loading...</p>
        </div>
      </div>
    </div>
  );
};

export default AppLoader;
