import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalOverlayProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  isOpen?: boolean;
}

export function ModalOverlay({ children, onClose, className = '', isOpen }: ModalOverlayProps) {
  const isControlled = isOpen !== undefined;
  const [shouldRender, setShouldRender] = useState(isControlled ? isOpen : true);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [active, setActive] = useState(false);

  // Sync shouldRender and animatingOut with isOpen in controlled mode
  useEffect(() => {
    if (!isControlled) return;

    if (isOpen) {
      setShouldRender(true);
      setAnimatingOut(false);

      // Prevent scrollbar layout shifting when locking body overflow
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
    } else {
      setAnimatingOut(true);
      setActive(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setAnimatingOut(false);
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, isControlled]);

  // Sync active state with shouldRender for entrance transition
  useEffect(() => {
    if (!shouldRender) {
      setActive(false);
      return;
    }

    const timer = setTimeout(() => {
      setActive(true);
    }, 10);
    return () => clearTimeout(timer);
  }, [shouldRender]);

  // Handle body overflow in uncontrolled mode
  useEffect(() => {
    if (!isControlled) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      const originalOverflow = document.body.style.overflow;
      const originalPadding = document.body.style.paddingRight;

      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPadding;
      };
    }
  }, [isControlled]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[999] bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto custom-scrollbar transition-opacity duration-300 ease-out ${
        active && !animatingOut ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform my-auto flex items-center justify-center w-full max-w-full ${
          active && !animatingOut
            ? 'scale-100 opacity-100 blur-none translate-y-0'
            : 'scale-95 opacity-0 blur-sm -translate-y-2'
        } ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
