'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { modalBackdropVariants, modalContentVariants } from '@/lib/utils/motion'
import { Maximize2 } from 'lucide-react'

interface AgreementModalProps {
  title: string;
  content: string;
  onAccept: () => void;
  onDecline: () => void;
  acceptLabel?: string;
}

export function AgreementModal({ title, content, onAccept, onDecline, acceptLabel }: AgreementModalProps) {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false)
  const [mounted, setMounted] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current
      if (scrollHeight - clientHeight - scrollTop <= 3) {
        setIsScrolledToBottom(true)
      }
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      <motion.div 
        key="agreement-backdrop"
        variants={modalBackdropVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-modal-title"
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
      >
        <motion.div 
          key="agreement-card"
          variants={modalContentVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="bg-white rounded-lg shadow-xl max-w-lg w-full flex flex-col max-h-[80vh]"
        >
          <div className="p-4 border-b">
            <h2 id="agreement-modal-title" className="font-extrabold text-lg text-gray-900">
              {title}
            </h2>
          </div>
          
          <div 
            ref={contentRef}
            onScroll={handleScroll}
            tabIndex={0}
            role="region"
            aria-label="Testing terms and conditions scrollable content"
            data-testid="agreement-modal-content"
            className="p-4 overflow-y-auto flex-1 text-sm text-gray-700 whitespace-pre-wrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset"
          >
            {content}
          </div>
          
          <div className="p-4 border-t flex justify-end gap-3 bg-gray-50">
            <button 
              type="button"
              onClick={onDecline}
              className="px-4 py-2 rounded text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 font-semibold text-sm transition-colors"
            >
              Decline
            </button>
            <button 
              type="button"
              onClick={() => {
                if (typeof document !== 'undefined' && document.documentElement?.requestFullscreen) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
                onAccept();
              }}
              disabled={!isScrolledToBottom}
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 font-semibold text-sm transition-all inline-flex items-center gap-1.5"
            >
              <Maximize2 className="w-4 h-4" />
              <span>{acceptLabel || 'Accept & Start Test (Fullscreen)'}</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
