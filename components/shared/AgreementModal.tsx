'use client'

import React, { useState, useRef } from 'react'

interface AgreementModalProps {
  title: string;
  content: string;
  onAccept: () => void;
  onDecline: () => void;
}

export function AgreementModal({ title, content, onAccept, onDecline }: AgreementModalProps) {
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current
      if (scrollHeight - clientHeight - scrollTop <= 3) {
        setIsScrolledToBottom(true)
      }
    }
  }

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="agreement-modal-title"
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full flex flex-col max-h-[80vh]">
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
            onClick={onAccept}
            disabled={!isScrolledToBottom}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 font-semibold text-sm transition-all"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
