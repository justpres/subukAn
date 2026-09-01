'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { UserProfile, NotificationSettings } from '@/types'
import { User, Bell, Check, X, Shield, Smartphone, MapPin, Briefcase, Laptop, AlertCircle } from 'lucide-react'

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

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'demographics' | 'notifications'>('demographics')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (profile) {
      setAgeGroup(profile.age_group || '')
      setGender(profile.gender || '')
      setLocation(profile.location || 'Metro Manila')
      setEmploymentStatus(profile.employment_status || '')
      setTechLiteracy(profile.tech_literacy || '')
      
      if (Array.isArray(profile.device_types)) {
        setDeviceTypes(profile.device_types)
      } else if (typeof profile.device_types === 'string') {
        setDeviceTypes([profile.device_types])
      } else {
        setDeviceTypes(['Android Mobile', 'Windows PC'])
      }

      setAccessibilityTags(profile.accessibility_tags || [])

      if (profile.notification_settings) {
        setNotificationSettings(profile.notification_settings)
      }
    }
  }, [profile])

  if (!isOpen || !mounted) return null

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

    try {
      await onSaveProfile({
        age_group: ageGroup || null,
        gender: gender || null,
        location: location || null,
        employment_status: employmentStatus || null,
        tech_literacy: techLiteracy || null,
        device_types: deviceTypes,
        accessibility_tags: accessibilityTags,
        notification_settings: notificationSettings
      })
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        onClose()
      }, 1000)
    } catch (error: any) {
      console.error('Failed to update profile:', error)
      setErrorMsg(error?.message || 'Failed to update profile settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 transition-all animate-fadeIn"
    >
      <div className="bg-white rounded-[16px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
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
            Demographics & Devices
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
            Notification Settings
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
      </div>
    </div>,
    document.body
  )
}
