'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { UserProfile, NotificationSettings } from '@/types'
import { mapDeviceTypesToDeviceType, resolveInitialDeviceTypes, resolveInitialNotificationSettings } from '@/lib/utils/profile'
import { User, Check, X, Shield, Smartphone, MapPin, Briefcase, Laptop, AlertCircle, Lock, FileText, ExternalLink, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalBackdropVariants, modalContentVariants } from '@/lib/utils/motion'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  profile: Partial<UserProfile> | null
  onSaveProfile: (updatedData: Partial<UserProfile>) => Promise<void> | void
}

export function ProfileModal({ isOpen, onClose, profile, onSaveProfile }: ProfileModalProps) {
  const [ageGroup, setAgeGroup] = useState('')
  const [gender, setGender] = useState('')
  const [location, setLocation] = useState('')
  const [employmentStatus, setEmploymentStatus] = useState('')
  const [techLiteracy, setTechLiteracy] = useState('')
  const [deviceTypes, setDeviceTypes] = useState<string[]>([])
  const [accessibilityTags, setAccessibilityTags] = useState<string[]>([])

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_payouts: true,
    email_submissions: true,
    email_listings: true,
    email_disputes: true
  })

  // Dual-rail payout preferences
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState('')
  const [preferredPayoutRail, setPreferredPayoutRail] = useState<'gcash' | 'maya' | 'crypto_wallet'>('gcash')

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'demographics' | 'payout' | 'notifications' | 'privacy'>('demographics')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const initializedRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false
      return
    }

    // Only initialize form state when the modal transitions to open (or when profile first arrives while open)
    // Background polling and refetches while the modal is open will not overwrite user edits
    if (!initializedRef.current && profile) {
      setAgeGroup(profile.age_group || '')
      setGender(profile.gender || '')
      setLocation(profile.location || 'Metro Manila')
      setEmploymentStatus(profile.employment_status || '')
      setTechLiteracy(profile.tech_literacy || '')
      
      setDeviceTypes(resolveInitialDeviceTypes(profile))
      setAccessibilityTags(Array.isArray(profile.accessibility_tags) ? profile.accessibility_tags : [])
      setCryptoWalletAddress(profile.crypto_wallet_address || '')
      setPreferredPayoutRail(profile.preferred_payout_rail || 'gcash')
      setNotificationSettings(resolveInitialNotificationSettings(profile))

      setErrorMsg(null)
      setSaveSuccess(false)
      initializedRef.current = true
    }
  }, [isOpen, profile])

  if (!mounted) return null

  const handleDeviceToggle = (device: string) => {
    setDeviceTypes(prev => 
      prev.includes(device) ? prev.filter(d => d !== device) : [...prev, device]
    )
  }

  const handleAccessibilityToggle = (tag: string) => {
    setAccessibilityTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveSuccess(false)
    setErrorMsg(null)

    const mappedDeviceType = mapDeviceTypesToDeviceType(deviceTypes)

    try {
      await onSaveProfile({
        age_group: ageGroup || null,
        gender: gender || null,
        location: location || null,
        employment_status: employmentStatus || null,
        tech_literacy: techLiteracy || null,
        device_types: deviceTypes,
        device_type: mappedDeviceType,
        accessibility_tags: accessibilityTags,
        crypto_wallet_address: cryptoWalletAddress || null,
        preferred_payout_rail: preferredPayoutRail,
        notification_settings: notificationSettings
      })
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        onClose()
      }, 1000)
    } catch (error: unknown) {
      console.error('Failed to update profile:', error)
      const err = error as { message?: string }
      setErrorMsg(err?.message || 'Failed to update profile settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="profile-modal-backdrop"
          variants={modalBackdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div 
            key="profile-modal-card"
            variants={modalContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="bg-white rounded-[16px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 id="profile-modal-title" className="font-extrabold text-xl text-gray-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" aria-hidden="true" /> Tester Profile Settings
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  Configure demographic details and notification preferences.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close profile settings modal"
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 bg-white" role="tablist" aria-label="Profile Sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'demographics'}
                aria-controls="demographics-panel"
                id="demographics-tab"
                onClick={() => setActiveTab('demographics')}
                className={`flex-1 py-3 text-xs font-bold text-center transition-all border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
                  activeTab === 'demographics'
                    ? 'border-purple-600 text-purple-700 bg-purple-50/40'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Demographics
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'payout'}
                aria-controls="payout-panel"
                id="payout-tab"
                onClick={() => setActiveTab('payout')}
                className={`flex-1 py-3 text-xs font-bold text-center transition-all border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
                  activeTab === 'payout'
                    ? 'border-purple-600 text-purple-700 bg-purple-50/40'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Payout &amp; Web3
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'notifications'}
                aria-controls="notifications-panel"
                id="notifications-tab"
                onClick={() => setActiveTab('notifications')}
                className={`flex-1 py-3 text-xs font-bold text-center transition-all border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
                  activeTab === 'notifications'
                    ? 'border-purple-600 text-purple-700 bg-purple-50/40'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Notifications
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'privacy'}
                aria-controls="privacy-panel"
                id="privacy-tab"
                onClick={() => setActiveTab('privacy')}
                className={`flex-1 py-3 text-xs font-bold text-center transition-all border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${
                  activeTab === 'privacy'
                    ? 'border-purple-600 text-purple-700 bg-purple-50/40'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Privacy &amp; Legal
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {errorMsg && (
                <div role="alert" className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-[8px]">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {activeTab === 'demographics' && (
                <div id="demographics-panel" role="tabpanel" aria-labelledby="demographics-tab" className="space-y-4">
                  {/* Age Range & Gender */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="profile-age-group" className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" /> Age Group
                      </label>
                      <select
                        id="profile-age-group"
                        value={ageGroup}
                        onChange={e => setAgeGroup(e.target.value)}
                        className="w-full p-2.5 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus:border-purple-600 focus-visible:ring-2 focus-visible:ring-purple-600"
                      >
                        <option value="">Not Specified</option>
                        <option value="18-24">18 - 24 years old</option>
                        <option value="25-34">25 - 34 years old</option>
                        <option value="35-44">35 - 44 years old</option>
                        <option value="45+">45+ years old</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="profile-gender" className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" /> Gender
                      </label>
                      <select
                        id="profile-gender"
                        value={gender}
                        onChange={e => setGender(e.target.value)}
                        className="w-full p-2.5 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus:border-purple-600 focus-visible:ring-2 focus-visible:ring-purple-600"
                      >
                        <option value="">Not Specified</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer Not to Say</option>
                      </select>
                    </div>
                  </div>

                  {/* Location & Employment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="profile-location" className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" /> Location / Region
                      </label>
                      <select
                        id="profile-location"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="w-full p-2.5 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus:border-purple-600 focus-visible:ring-2 focus-visible:ring-purple-600"
                      >
                        <option value="Metro Manila">Metro Manila (NCR)</option>
                        <option value="Luzon">Luzon (Provincial)</option>
                        <option value="Visayas">Visayas (Cebu/Iloilo/etc.)</option>
                        <option value="Mindanao">Mindanao (Davao/CDO/etc.)</option>
                        <option value="Overseas">Overseas (OFW / Foreign)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="profile-employment" className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" /> Employment Status
                      </label>
                      <select
                        id="profile-employment"
                        value={employmentStatus}
                        onChange={e => setEmploymentStatus(e.target.value)}
                        className="w-full p-2.5 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus:border-purple-600 focus-visible:ring-2 focus-visible:ring-purple-600"
                      >
                        <option value="">Not Specified</option>
                        <option value="employed">Employed (Full/Part-Time)</option>
                        <option value="unemployed">Unemployed</option>
                        <option value="student">Student</option>
                        <option value="self-employed">Self-Employed / Freelancer</option>
                      </select>
                    </div>
                  </div>

                  {/* Tech Literacy */}
                  <div>
                    <label htmlFor="profile-tech-literacy" className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <Laptop className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" /> Tech Literacy Level
                    </label>
                    <select
                      id="profile-tech-literacy"
                      value={techLiteracy}
                      onChange={e => setTechLiteracy(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-[8px] bg-white text-xs focus:outline-none focus:border-purple-600 focus-visible:ring-2 focus-visible:ring-purple-600"
                    >
                      <option value="">Not Specified</option>
                      <option value="non_technical">Non-Technical (Casual Smartphone User)</option>
                      <option value="casual_user">Intermediate (Daily App Power User)</option>
                      <option value="student_dev">Advanced / Software Developer</option>
                    </select>
                  </div>

                  {/* Devices Owned */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-gray-400" /> Testing Devices Available
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Android Mobile', 'iOS Mobile', 'Windows PC', 'Mac Desktop'].map(device => (
                        <label
                          key={device}
                          className={`p-2.5 border rounded-[8px] flex items-center gap-2 text-xs font-medium cursor-pointer transition-all ${
                            deviceTypes.includes(device)
                              ? 'border-purple-500 bg-purple-50 text-purple-900 font-bold'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={deviceTypes.includes(device)}
                            onChange={() => handleDeviceToggle(device)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          {device}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Accessibility Accommodations */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">
                      Accessibility Specialty Accommodations
                    </label>
                    <div className="space-y-2 bg-gray-50 p-3 rounded-[8px] border border-gray-200">
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={accessibilityTags.includes('screen_reader')}
                          onChange={() => handleAccessibilityToggle('screen_reader')}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span>I actively use a Screen Reader (TalkBack / VoiceOver / NVDA)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={accessibilityTags.includes('keyboard_only')}
                          onChange={() => handleAccessibilityToggle('keyboard_only')}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span>I navigate websites using Keyboard-Only controls</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={accessibilityTags.includes('color_blind')}
                          onChange={() => handleAccessibilityToggle('color_blind')}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span>I have a Color Blindness visual profile</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'payout' && (
                <div id="payout-panel" role="tabpanel" aria-labelledby="payout-tab" className="space-y-4">
                  <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-xl space-y-1">
                    <span className="text-xs font-bold text-purple-900 block">Dual-Rail Payout Configuration</span>
                    <p className="text-[11px] text-purple-700 leading-relaxed">
                      Choose how you receive earnings from completed testing campaigns. GCash is default, with optional USDC crypto wallet payouts.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Primary Payout Method
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPreferredPayoutRail('gcash')}
                        className={`p-3 rounded-lg border text-left font-semibold transition-all ${
                          preferredPayoutRail === 'gcash'
                            ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-1 ring-blue-600'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-bold">🇵🇭 GCash</div>
                        <div className="text-[10px] text-gray-500 font-normal mt-0.5">Direct to Phone</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreferredPayoutRail('maya')}
                        className={`p-3 rounded-lg border text-left font-semibold transition-all ${
                          preferredPayoutRail === 'maya'
                            ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 ring-1 ring-emerald-600'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-bold">💚 Maya</div>
                        <div className="text-[10px] text-gray-500 font-normal mt-0.5">Direct to Wallet</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreferredPayoutRail('crypto_wallet')}
                        className={`p-3 rounded-lg border text-left font-semibold transition-all ${
                          preferredPayoutRail === 'crypto_wallet'
                            ? 'border-purple-600 bg-purple-50/60 text-purple-900 ring-1 ring-purple-600'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-bold">🌐 Web3 Wallet</div>
                        <div className="text-[10px] text-gray-500 font-normal mt-0.5">USDC on Base L2</div>
                      </button>
                    </div>
                  </div>

                  {preferredPayoutRail === 'crypto_wallet' && (
                    <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <label htmlFor="crypto-wallet-input" className="block text-xs font-bold text-slate-800">
                        Base / EVM Wallet Address (0x...)
                      </label>
                      <input
                        id="crypto-wallet-input"
                        type="text"
                        value={cryptoWalletAddress}
                        onChange={e => setCryptoWalletAddress(e.target.value)}
                        placeholder="0x71C...3a9"
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                      />
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Compatible with MetaMask, Coinbase Wallet, Phantom (EVM), or any Base-supported wallet.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 mb-2">
                    Choose which events send instant notifications to your account and email.
                  </p>

                  <div className="space-y-3">
                    <label className="p-3 border border-gray-200 rounded-[10px] flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">Payout Approval Alerts</span>
                        <span className="text-[11px] text-gray-500">Notify when GCash withdrawal requests pass verification.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.email_payouts}
                        onChange={e => setNotificationSettings(prev => ({ ...prev, email_payouts: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </label>

                    <label className="p-3 border border-gray-200 rounded-[10px] flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">Submission Status Updates</span>
                        <span className="text-[11px] text-gray-500">Notify when posters approve or review your submitted tests.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.email_submissions}
                        onChange={e => setNotificationSettings(prev => ({ ...prev, email_submissions: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </label>

                    <label className="p-3 border border-gray-200 rounded-[10px] flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">New Listing & Task Alerts</span>
                        <span className="text-[11px] text-gray-500">Notify when new high-reward testing jobs match your profile.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.email_listings}
                        onChange={e => setNotificationSettings(prev => ({ ...prev, email_listings: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </label>

                    <label className="p-3 border border-gray-200 rounded-[10px] flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">Dispute Updates & Debrief</span>
                        <span className="text-[11px] text-gray-500">Notify when support team or posters reply to disputed tasks.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationSettings.email_disputes}
                        onChange={e => setNotificationSettings(prev => ({ ...prev, email_disputes: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50/80 border border-blue-100 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#2955E3]">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Data Privacy &amp; Legal Compliance</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      SubukAn complies with the <strong>Data Privacy Act of 2012 (RA 10173)</strong> and the <strong>Internet Transactions Act (RA 11967)</strong>. Your data is encrypted and protected.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                      Platform Legal Agreements
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <Link
                        href="/terms"
                        target="_blank"
                        className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg flex items-center justify-between text-slate-800 font-semibold transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span>Terms of Service</span>
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>

                      <Link
                        href="/privacy"
                        target="_blank"
                        className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg flex items-center justify-between text-slate-800 font-semibold transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Privacy Policy</span>
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>

                      <Link
                        href="/nda"
                        target="_blank"
                        className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg flex items-center justify-between text-slate-800 font-semibold transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Tester NDA</span>
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>

                      <Link
                        href="/refund-policy"
                        target="_blank"
                        className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg flex items-center justify-between text-slate-800 font-semibold transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Refund Policy</span>
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </Link>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                    <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                      Right to Erasure &amp; Account Deletion
                    </span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      You have the right to request permanent deletion of your profile and demographic records under Philippine data privacy regulations.
                    </p>
                    <a
                      href="mailto:dpo@subukan.com?subject=Account%20and%20Data%20Deletion%20Request"
                      className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline"
                    >
                      <span>Request Account &amp; Data Deletion (dpo@subukan.com) →</span>
                    </a>
                  </div>
                </div>
              )}

              {saveSuccess && (
                <div role="status" aria-live="polite" className="p-3 bg-emerald-50 border border-emerald-200 rounded-[8px] text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <span>Profile settings saved successfully!</span>
                </div>
              )}

              {/* Footer Controls */}
              <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-[8px] hover:bg-gray-100 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-[8px] text-xs font-extrabold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
                >
                  {saving ? 'Saving...' : 'Save Profile & Settings'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
