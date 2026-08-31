'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Video, 
  Image as ImageIcon, 
  Check, 
  Play, 
  Square, 
  UploadCloud, 
  AlertCircle,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { AgreementModal } from '@/components/shared/AgreementModal'
import { EscrowStatusBar } from '@/components/shared/EscrowStatusBar'
import { TimerDisplay } from '@/components/shared/TimerDisplay'
import { WorkspaceStatusCard } from '@/components/shared/WorkspaceStatusCard'
import { sanitizeDatabaseError } from '@/lib/utils/error'

interface Listing {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  rate_per_tester: number;
  slots_count: number;
  total_budget: number;
  review_window_minutes: number;
  status: string;
  variants?: any[];
}

interface Task {
  id: string;
  listing_id: string;
  order_index: number;
  question_text: string;
  requires_recording: boolean;
  requires_image: boolean;
}

interface TaskResponseState {
  answer_text: string;
  completed_successfully: boolean;
  time_on_task_seconds: number;
  difficulty_rating: number;
  recording_url?: string | null;
  image_url?: string | null;
}

const NDA_CONTENT = `subukAn Tester Agreement & NDA

By participating in this test, you agree to the following binding conditions:

1. HONEST & HIGH-EFFORT COMPLETION: You must execute all tasks exactly as described. Payment is strictly subject to the poster's review. Submission of spam, low-effort summaries, or fake proofs will result in immediate disqualification and account flag.

2. CONFIDENTIALITY: The application under test, its features, screenshots, and internal workings are strictly confidential. You may not distribute, discuss, or share any media, screenshots, recordings, or code outside the subukAn portal.

3. SCREEN RECORDING AND EVIDENCE: You agree to keep the screen recorder running for the entire duration of the test. The recording must clearly show the steps you perform.

4. ESCROW RELEASES: Funds are held safely in escrow. Upon submission, the poster has up to 30 or 60 minutes to review. If they do not take action, payment is automatically released.

Scroll down and review all terms to accept.`;

export default function TaskWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createBrowserClient();

  // Lifecycle & Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submission, setSubmission] = useState<any>(null);
  
  // Interactive Step Machine
  // 'loading' | 'unauthorized' | 'agreement' | 'active_task' | 'submitted' | 'expired' | 'error'
  const [currentStep, setCurrentStep] = useState<string>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [ipAddress, setIpAddress] = useState('127.0.0.1');

  // Input & Checklist States
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [taskResponses, setTaskResponses] = useState<Record<string, TaskResponseState>>({});
  const [taskTimes, setTaskTimes] = useState<Record<string, number>>({});
  
  // Media Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTaskIndex, setRecordingTaskIndex] = useState<number | null>(null);
  const [recordingTaskError, setRecordingTaskError] = useState<string | null>(null);
  
  // Countdown Timer state
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Post-Test Threading / Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Native media tracks refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const initStarted = useRef(false);

  // Post-Test Debrief Threading
  const fetchComments = useCallback(async (submissionId: string) => {
    if (!submissionId) return;
    try {
      const { data, error } = await supabase
        .from('submission_comments')
        .select(`
          id,
          comment_text,
          created_at,
          user_id,
          profiles (
            full_name,
            role
          )
        `)
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (err: any) {
      console.error('Failed to fetch comments:', err);
    }
  }, [supabase]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);
    if (!newCommentText.trim() || !submission) return;
    setCommentsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        setCommentError('Authentication required. Please log in again.');
        setCommentsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('submission_comments')
        .insert({
          submission_id: submission.id,
          user_id: session.user.id,
          comment_text: newCommentText.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setNewCommentText('');
      await fetchComments(submission.id);
    } catch (err: unknown) {
      setCommentError(sanitizeDatabaseError(err, 'Failed to post comment. Please try again.'));
    } finally {
      setCommentsLoading(false);
    }
  };

  // 1. Basic Fingerprint generator
  const getFingerprint = () => {
    if (typeof window === 'undefined') return '';
    return `${navigator.userAgent}|${window.screen.width}x${window.screen.height}|${navigator.language}`;
  };

  // 2. Client IP fetcher
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => {});
  }, []);

  // 3. Page initialization & Slot claiming
  useEffect(() => {
    if (!id) return;
    if (initStarted.current) return;
    initStarted.current = true;
    
    const initWorkspace = async () => {
      try {
        // Get current user session
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !session || !session.user) {
          setCurrentStep('unauthorized');
          setLoading(false);
          return;
        }
        
        const userId = session.user.id;
        
        // Fetch profile and check role
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
          
        if (profileErr || !profile) {
          setError('Failed to fetch user profile.');
          setCurrentStep('error');
          setLoading(false);
          return;
        }
        
        if (profile.role !== 'tester') {
          setCurrentStep('unauthorized');
          setLoading(false);
          return;
        }
        
        // Fetch listing
        const { data: listingData, error: listingErr } = await supabase
          .from('listings')
          .select('*')
          .eq('id', id)
          .single();
          
        if (listingErr || !listingData) {
          setError('Listing not found or failed to load.');
          setCurrentStep('error');
          setLoading(false);
          return;
        }
        
        setListing(listingData);
        
        // Fetch tasks
        const { data: tasksData, error: tasksErr } = await supabase
          .from('tasks')
          .select('*')
          .eq('listing_id', id)
          .order('order_index', { ascending: true });
          
        if (tasksErr || !tasksData) {
          setError('Failed to fetch tasks.');
          setCurrentStep('error');
          setLoading(false);
          return;
        }
        
        setTasks(tasksData);
        
        // Initialize responses state
        const initialResponses: Record<string, TaskResponseState> = {};
        tasksData.forEach(task => {
          initialResponses[task.id] = {
            answer_text: '',
            completed_successfully: false,
            time_on_task_seconds: 0,
            difficulty_rating: 3,
            recording_url: null,
            image_url: null
          };
        });
        setTaskResponses(initialResponses);
        
        // Query if user has an existing submission for this listing
        const { data: submissionData, error: subErr } = await supabase
          .from('submissions')
          .select('*')
          .eq('listing_id', id)
          .eq('tester_id', userId)
          .maybeSingle();
           
        if (subErr) {
          setError(sanitizeDatabaseError(subErr, 'Failed to query submission status.'));
          setCurrentStep('error');
          setLoading(false);
          return;
        }
        
        if (submissionData) {
          setSubmission(submissionData);
          
          if (submissionData.status === 'in_progress') {
            setCurrentStep('active_task');
            if (tasksData.length > 0) {
              setActiveTaskId(tasksData[0].id);
            }
          } else if (['pending_review', 'approved', 'rejected', 'submitted'].includes(submissionData.status)) {
            setCurrentStep(submissionData.status);
            await fetchComments(submissionData.id);
          } else if (submissionData.status === 'expired') {
            setCurrentStep('expired');
          }
        } else {
          // Verify slot availability
          const { count, error: countErr } = await supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('listing_id', id)
            .neq('status', 'expired');
             
          if (countErr) {
            setError(sanitizeDatabaseError(countErr, 'Failed to verify slot availability.'));
            setCurrentStep('error');
            setLoading(false);
            return;
          }
          
          if (count !== null && count >= listingData.slots_count) {
            setError('No slots available for this listing. All slots have been claimed.');
            setCurrentStep('error');
            setLoading(false);
            return;
          }
          
          // Show click-through NDA before claiming slot
          setCurrentStep('agreement');
          if (tasksData.length > 0) {
            setActiveTaskId(tasksData[0].id);
          }
        }
      } catch (err: any) {
        console.error('Initialization error:', err);
        setError(sanitizeDatabaseError(err, 'An unexpected error occurred during page load.'));
        setCurrentStep('error');
      } finally {
        setLoading(false);
      }
    };
    
    initWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 4. Timer Logic
  useEffect(() => {
    if (!submission || !listing || currentStep !== 'active_task') return;

    const calculateTimeLeft = () => {
      const startedAtTime = new Date(submission.started_at).getTime();
      const durationMs = listing.review_window_minutes * 60 * 1000;
      const elapsedMs = Date.now() - startedAtTime;
      const remaining = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));
      setSecondsLeft(remaining);
      
      if (remaining <= 0) {
        handleAutoSubmitOrExpire();
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission, listing, currentStep]);

  // 5. Active Task Time-on-Task tracker
  useEffect(() => {
    if (!activeTaskId || currentStep !== 'active_task') return;
    
    const interval = setInterval(() => {
      setTaskTimes(prev => ({
        ...prev,
        [activeTaskId]: (prev[activeTaskId] || 0) + 1
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [activeTaskId, currentStep]);

  // 6. Security Event Interceptors (anti-copy/right-click)
  useEffect(() => {
    if (currentStep !== 'active_task') return;
    
    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('copy', preventCopy);
    document.addEventListener('contextmenu', preventContextMenu);
    
    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [currentStep]);

  // NDA modal handlers
  const handleAcceptAgreement = async () => {
    if (submission) {
      setCurrentStep('active_task');
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || !listing) {
        setCurrentStep('unauthorized');
        return;
      }

      // Re-verify slot availability atomically
      const { count, error: countErr } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listing.id)
        .neq('status', 'expired');

      if (countErr) throw countErr;
      if (count !== null && count >= listing.slots_count) {
        setError('No slots available for this listing. All slots have been claimed.');
        setCurrentStep('error');
        return;
      }

      // Insert submission slot upon agreement acceptance
      const { data: newSubmission, error: claimErr } = await supabase
        .from('submissions')
        .insert({
          listing_id: listing.id,
          tester_id: session.user.id,
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (claimErr || !newSubmission) throw claimErr;

      setSubmission(newSubmission);
      setCurrentStep('active_task');
    } catch (err: any) {
      console.error('Failed to claim slot on agreement acceptance:', err);
      setError(sanitizeDatabaseError(err, 'Failed to claim slot. Please try again.'));
      setCurrentStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineAgreement = async () => {
    if (submission) {
      try {
        await supabase
          .from('submissions')
          .update({ status: 'expired' })
          .eq('id', submission.id);
      } catch (e) {
        console.error(e);
      }
    }
    router.push('/dashboard/tester');
  };

  // Forfeit/Release slot manually
  const handleForfeitSlot = async () => {
    if (confirm('Are you sure you want to forfeit this slot? Any draft progress will be lost.')) {
      await handleDeclineAgreement();
    }
  };

  // State Change Helper Functions
  const handleAnswerTextChange = (taskId: string, val: string) => {
    setTaskResponses(prev => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {
          answer_text: '',
          completed_successfully: false,
          time_on_task_seconds: 0,
          difficulty_rating: 3
        }),
        answer_text: val
      }
    }));
  };

  const handleDifficultyRatingChange = (taskId: string, val: number) => {
    setTaskResponses(prev => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {
          answer_text: '',
          completed_successfully: false,
          time_on_task_seconds: 0,
          difficulty_rating: 3
        }),
        difficulty_rating: val
      }
    }));
  };

  const handleRemoveAttachment = (taskId: string, field: 'recording_url' | 'image_url') => {
    setTaskResponses(prev => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {
          answer_text: '',
          completed_successfully: false,
          time_on_task_seconds: 0,
          difficulty_rating: 3
        }),
        [field]: null
      }
    }));
  };

  // MediaRecorder handlers
  const startRecording = async (taskId: string, index: number) => {
    try {
      setRecordingTaskError(null);
      chunksRef.current = [];
      
      // Screen share stream request
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Mic audio track capture
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
      } catch (e) {
        console.warn('Microphone permission not granted. Recording screen only.', e);
      }
      
      const tracks = [
        ...screenStream.getVideoTracks(),
        ...(micStream ? micStream.getAudioTracks() : []),
        ...screenStream.getAudioTracks()
      ];
      
      const combinedStream = new MediaStream(tracks);
      streamRef.current = combinedStream;
      
      let options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
      
      const mediaRecorder = new MediaRecorder(combinedStream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        
        // Enforce 100MB max limit
        const MAX_SIZE_BYTES = 100 * 1024 * 1024;
        if (blob.size > MAX_SIZE_BYTES) {
          setRecordingTaskError('Recording file exceeds the 100MB limit. Record a shorter session.');
          return;
        }
        
        await uploadMediaFile(taskId, blob, 'video/webm', `recording-${taskId}-${Date.now()}.webm`);
      };
      
      // Auto-handle stops when browser native "Stop sharing" is pressed
      screenStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };
      
      mediaRecorder.start(1000); // chunk data every second
      setIsRecording(true);
      setRecordingTaskIndex(index);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setRecordingTaskError(err.message || 'Failed to start screen recording. Make sure you allow system/screen share.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    setRecordingTaskIndex(null);
  };

  // Upload handler for both screen recordings and image files
  const uploadMediaFile = async (taskId: string, fileOrBlob: Blob | File, fileType: string, defaultFilename: string) => {
    setActionError(null);
    try {
      const fileSize = fileOrBlob.size;
      const filename = fileOrBlob instanceof File ? fileOrBlob.name : defaultFilename;
      
      const MAX_SIZE_BYTES = 100 * 1024 * 1024;
      if (fileSize > MAX_SIZE_BYTES) {
        setActionError('File size exceeds the 100MB limit. Select a smaller file.');
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setActionError('Unauthorized: Session not found. Log in again.');
        return;
      }
      
      // Fetch signed upload URL
      const apiResponse = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          filename,
          fileType,
          fileSize
        })
      });
      
      if (!apiResponse.ok) {
        const errData = await apiResponse.json();
        throw new Error(errData.error || 'Failed to generate signed upload URL');
      }
      
      const { signedUrl, path, bucket } = await apiResponse.json();
      
      // PUT stream/data upload
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: fileOrBlob,
        headers: {
          'Content-Type': fileType
        }
      });
      
      if (!uploadRes.ok) {
        throw new Error('Upload request failed.');
      }
      
      // Construct Supabase Storage public address
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const fileUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
      
      // Save URL path to taskResponses state
      setTaskResponses(prev => ({
        ...prev,
        [taskId]: {
          ...(prev[taskId] || {
            answer_text: '',
            completed_successfully: false,
            time_on_task_seconds: 0,
            difficulty_rating: 3
          }),
          [fileType.startsWith('video') ? 'recording_url' : 'image_url']: fileUrl
        }
      }));
    } catch (err: any) {
      console.error('File upload failed:', err);
      setActionError('Upload failed: ' + err.message);
    }
  };

  // Image input select handler
  const handleImageSelect = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    setActionError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setActionError('Invalid file format. Only PNG, JPEG, JPG are permitted.');
      return;
    }
    
    await uploadMediaFile(taskId, file, file.type, file.name);
  };

  // Task checklist validation helper
  const isTaskValid = (task: Task) => {
    const response = taskResponses[task.id];
    if (!response) return false;
    
    const textValid = (response.answer_text || '').trim().length >= 10;
    const ratingValid = response.difficulty_rating >= 1 && response.difficulty_rating <= 5;
    const recordingValid = !task.requires_recording || !!response.recording_url;
    const imageValid = !task.requires_image || !!response.image_url;
    const completedCheck = checkedTasks[task.id] === true;
    
    return textValid && ratingValid && recordingValid && imageValid && completedCheck;
  };

  // Checks validation rules for all questions
  const isFormValid = () => {
    if (!tasks || tasks.length === 0) return false;
    return tasks.every(task => isTaskValid(task));
  };

  // Final submission processing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;
    await submitResponses('pending_review');
  };

  const handleAutoSubmitOrExpire = async () => {
    if (currentStep !== 'active_task') return;
    
    // Check if tester has filled out any content
    const hasStartedAny = Object.values(taskResponses).some(
      resp => (resp.answer_text || '').trim().length > 0 || !!resp.recording_url || !!resp.image_url
    );
    
    if (hasStartedAny) {
      await submitResponses('pending_review');
    } else {
      if (submission) {
        await supabase
          .from('submissions')
          .update({ status: 'expired' })
          .eq('id', submission.id);
      }
      setCurrentStep('expired');
    }
  };

  const submitResponses = async (finalStatus: 'pending_review' | 'expired') => {
    if (!submission || !listing || !tasks) return;
    setActionError(null);
    
    setSubmitting(true);
    try {
      const responseRows = tasks.map(task => {
        const resp = taskResponses[task.id];
        return {
          submission_id: submission.id,
          task_id: task.id,
          answer_text: resp?.answer_text || 'Auto-submitted due to timer expiration.',
          completed_successfully: checkedTasks[task.id] || false,
          time_on_task_seconds: Math.max(1, Math.min(7200, taskTimes[task.id] || 1)),
          difficulty_rating: resp?.difficulty_rating || 3,
          recording_url: resp?.recording_url || null,
          image_url: resp?.image_url || null
        };
      });
      
      // Upsert answers to task_responses
      const { error: insertErr } = await supabase
        .from('task_responses')
        .upsert(responseRows, { onConflict: 'submission_id,task_id' });
        
      if (insertErr) {
        throw new Error('Failed to save responses: ' + insertErr.message);
      }
      
      // Update submission status and release timestamps
      const submittedAt = new Date();
      const autoReleaseAt = new Date(submittedAt.getTime() + listing.review_window_minutes * 60 * 1000);
      
      const { data: updatedSub, error: subUpdateErr } = await supabase
        .from('submissions')
        .update({
          status: finalStatus,
          submitted_at: submittedAt.toISOString(),
          auto_release_at: autoReleaseAt.toISOString(),
          device_fingerprint: getFingerprint(),
          ip_address: ipAddress
        })
        .eq('id', submission.id)
        .select()
        .single();
        
      if (subUpdateErr) {
        throw new Error('Failed to update submission records: ' + subUpdateErr.message);
      }
      
      if (updatedSub) {
        setSubmission(updatedSub);
      } else {
        setSubmission((prev: any) => ({
          ...prev,
          status: finalStatus,
          submitted_at: submittedAt.toISOString(),
          auto_release_at: autoReleaseAt.toISOString(),
        }));
      }

      if (finalStatus === 'pending_review') {
        await fetchComments(submission.id);
      }
      setCurrentStep(finalStatus === 'pending_review' ? 'pending_review' : 'expired');
    } catch (err: any) {
      console.error('Submission failed:', err);
      setActionError(err.message || 'An error occurred while saving your testing responses.');
    } finally {
      setSubmitting(false);
    }
  };

  // Base state loaders
  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-gray-500 font-mono">Securing test slot...</span>
        </div>
      </div>
    );
  }

  if (currentStep === 'unauthorized') {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-[12px] p-8 max-w-md text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Access Restricted</h2>
          <p className="text-sm text-gray-500">
            Only verified users with the Tester role are permitted to view active workspaces.
          </p>
          <Link href="/dashboard" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-[8px]">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (currentStep === 'error') {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-[12px] p-8 max-w-md text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Workspace Error</h2>
          <p className="text-sm text-gray-500">{error || 'An unexpected error occurred.'}</p>
          <Link href="/dashboard/tester" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-[8px]">
            Return to tasks
          </Link>
        </div>
      </div>
    );
  }

  if (['submitted', 'pending_review', 'approved', 'rejected'].includes(currentStep) && listing) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] py-12 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Status card (Left column, 1/3 width) */}
          <div className="md:col-span-1 space-y-6">
            <WorkspaceStatusCard submission={submission} listing={listing} />
          </div>

          {/* Post-Test Debrief Thread (Right column, 2/3 width) */}
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-[12px] p-6 shadow-sm flex flex-col h-[550px] animate-fadeIn">
            <div className="border-b border-gray-100 pb-4 mb-4">
              <h3 className="font-extrabold text-lg text-gray-900">Post-Test Debrief Thread</h3>
              <p className="text-xs text-gray-500">Discuss task details, edge cases, and clarifications directly with the poster.</p>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
                  <p className="text-xs font-semibold">No debrief comments yet.</p>
                  <p className="text-[11px] max-w-xs">Use this space to provide any extra notes or to answer the poster&apos;s clarification questions.</p>
                </div>
              ) : (
                comments.map((comment) => {
                  const isPoster = comment.profiles?.role === 'poster';
                  return (
                    <div
                      key={comment.id}
                      className={`flex flex-col max-w-[85%] rounded-[8px] p-3 text-xs leading-relaxed ${
                        isPoster
                          ? 'bg-blue-50 border border-blue-100 mr-auto text-blue-900'
                          : 'bg-purple-50 border border-purple-100 ml-auto text-purple-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        <span>{comment.profiles?.full_name || 'User'}</span>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] font-extrabold ${
                            isPoster ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {isPoster ? 'Poster' : 'Tester'}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{comment.comment_text}</p>
                      <span className="text-[9px] text-gray-400 self-end mt-1.5 font-semibold">
                        {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Form */}
            {commentError && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-[8px] mb-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{commentError}</span>
              </div>
            )}
            <form onSubmit={handlePostComment} className="border-t border-gray-100 pt-4 flex gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Type your comment/notes here..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-[8px] text-xs focus:outline-none focus:border-blue-500 bg-white text-gray-800"
                disabled={commentsLoading}
                required
              />
              <button
                type="submit"
                disabled={commentsLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-[8px] text-xs disabled:opacity-50 transition-all"
              >
                {commentsLoading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'expired') {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-[12px] p-8 max-w-md text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Slot Session Expired</h2>
          <p className="text-sm text-gray-500">
            The allotted testing time has elapsed and the slot has been automatically released.
          </p>
          <Link href="/dashboard/tester" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-[8px]">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // NDA click-through agreement step
  if (currentStep === 'agreement' && listing) {
    return (
      <AgreementModal
        title={`Acknowledge Testing Guidelines: ${listing.title}`}
        content={NDA_CONTENT}
        onAccept={handleAcceptAgreement}
        onDecline={handleDeclineAgreement}
      />
    );
  }

  // Active Workspace layout
  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] pb-16">
      {/* 1. Timer Countdown indicator */}
      {secondsLeft !== null && secondsLeft > 0 && (
        <TimerDisplay 
          initialSeconds={secondsLeft} 
          onExpire={handleAutoSubmitOrExpire} 
        />
      )}

      {/* Back navigation link */}
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <button 
          onClick={handleForfeitSlot}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-white border px-3 py-1.5 rounded-[8px] transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Forfeit Slot & Exit
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-6">
        {listing && (
          <div className="bg-white border border-gray-200 rounded-[12px] overflow-hidden shadow-sm flex flex-col">
            
            {/* 2. Escrow Status Bar */}
            <EscrowStatusBar 
              budget={listing.rate_per_tester} 
              slots={listing.slots_count} 
              status="active" 
            />

            <div className="p-8 space-y-8">
              {/* Header Title */}
              <div className="border-b border-gray-100 pb-5">
                <h1 className="text-3xl font-extrabold tracking-tight mb-2 select-none">
                  {listing.title}
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  Complete each task carefully. All responses must be completed to submit this simulation.
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-gray-50 border border-gray-100 rounded-[8px] p-5 select-none">
                <h3 className="font-bold text-sm text-gray-800 mb-2">Scenario Details & Description:</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {listing.description}
                </p>
              </div>

              {/* A/B Testing Variant URL box */}
              {listing.variants && Array.isArray(listing.variants) && listing.variants.length > 0 && submission && submission.assigned_variant_id && (
                <div className="bg-purple-50 border border-purple-200 rounded-[8px] p-5 select-none animate-fadeIn">
                  <h3 className="font-bold text-sm text-purple-800 mb-1">Assigned Variant for Testing:</h3>
                  {(() => {
                    const variant = listing.variants.find((v: any) => v.id === submission.assigned_variant_id);
                    if (variant) {
                      return (
                        <div>
                          <p className="text-sm text-purple-900 font-bold mb-2">
                            {variant.title}
                          </p>
                          <p className="text-xs text-gray-500 mb-1">Please test this specific URL for this task round:</p>
                          <a
                            href={variant.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 underline break-all"
                            id="tester-variant-link"
                          >
                            {variant.url}
                          </a>
                        </div>
                      );
                    }
                    return <p className="text-sm text-purple-700">Loading variant URL...</p>;
                  })()}
                </div>
              )}

              {/* Task Checklist form */}
              {actionError && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-[8px] mb-4">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2 select-none">
                    Required Actions Checklist
                  </h2>
                  
                  <div className="space-y-4">
                    {tasks.map((task, index) => {
                      const isCompleted = checkedTasks[task.id] || false;
                      const response = taskResponses[task.id] || {
                        answer_text: '',
                        completed_successfully: false,
                        difficulty_rating: 3,
                        recording_url: null,
                        image_url: null
                      };
                      const isActive = activeTaskId === task.id;
                      const timeOnTask = taskTimes[task.id] || 0;
                      
                      return (
                        <div 
                          key={task.id} 
                          onClick={() => setActiveTaskId(task.id)}
                          className={`border rounded-[12px] p-6 transition-all duration-200 bg-white cursor-pointer ${
                            isActive ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCheckedTasks(prev => ({ ...prev, [task.id]: !prev[task.id] }));
                                }}
                                className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${
                                  isCompleted 
                                    ? 'bg-emerald-600 border-emerald-600 text-white' 
                                    : 'border-gray-300 bg-white hover:border-gray-400'
                                }`}
                              >
                                {isCompleted && <Check className="w-4 h-4" />}
                              </button>
                              <span className="font-bold text-gray-900 select-none">Task {index + 1}</span>
                            </div>
                            
                            {/* Individual task duration */}
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border">
                              <Clock className="w-3.5 h-3.5" />
                              {Math.floor(timeOnTask / 60)}m {timeOnTask % 60}s
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-700 font-semibold mb-4 whitespace-pre-wrap select-none">
                            {task.question_text}
                          </p>
                          
                          {/* Inner task response items */}
                          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 select-none">
                                Your Response Details (minimum 10 characters)
                              </label>
                              <textarea
                                value={response.answer_text}
                                onChange={(e) => handleAnswerTextChange(task.id, e.target.value)}
                                placeholder="Explain your feedback, errors found, or layout issues..."
                                rows={3}
                                className="w-full p-3 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-600 text-sm focus:ring-1 focus:ring-blue-600"
                              />
                              <div className="flex justify-between text-[11px] text-gray-400 mt-1 select-none">
                                <span>Character count: {response.answer_text.length} / 10 required</span>
                                {response.answer_text.length > 0 && response.answer_text.length < 10 && (
                                  <span className="text-rose-500 font-semibold">Under 10 characters</span>
                                )}
                              </div>
                            </div>

                            {/* 1-5 Difficulty score */}
                            <div>
                              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 select-none">
                                Task Difficulty Rating
                              </label>
                              <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => handleDifficultyRatingChange(task.id, val)}
                                    className={`w-9 h-9 rounded-[8px] border font-bold text-xs flex items-center justify-center transition-all ${
                                      response.difficulty_rating === val
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                              <div className="flex justify-between text-[10px] text-gray-400 mt-1 max-w-[200px] select-none">
                                <span>Very Easy (1)</span>
                                <span>Very Hard (5)</span>
                              </div>
                            </div>

                            {/* Specific deliverables uploader panel */}
                            {(task.requires_recording || task.requires_image) && (
                              <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {task.requires_recording && (
                                  <div className="p-4 border border-gray-200 rounded-[8px] bg-gray-50">
                                    <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5 mb-2 select-none">
                                      <Video className="w-3.5 h-3.5 text-blue-600" /> Screen Recording File
                                    </span>
                                    
                                    {response.recording_url ? (
                                      <div className="space-y-2">
                                        <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5" /> Recording Uploaded
                                        </div>
                                        <video 
                                          src={response.recording_url} 
                                          controls 
                                          className="w-full max-h-32 rounded bg-black"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAttachment(task.id, 'recording_url')}
                                          className="text-xs text-rose-600 font-semibold hover:underline block"
                                        >
                                          Delete and re-record
                                        </button>
                                      </div>
                                    ) : (
                                      <div>
                                        {isRecording && recordingTaskIndex === index ? (
                                          <button
                                            type="button"
                                            onClick={stopRecording}
                                            className="w-full py-2.5 bg-rose-50 border border-rose-300 text-rose-600 text-xs font-semibold rounded-[8px] flex items-center justify-center gap-1.5 animate-pulse"
                                          >
                                            <Square className="w-3.5 h-3.5 fill-rose-600" /> Stop Recording
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            disabled={isRecording}
                                            onClick={() => startRecording(task.id, index)}
                                            className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-[8px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                                          >
                                            <Play className="w-3.5 h-3.5 text-emerald-600" /> Record Screen
                                          </button>
                                        )}
                                        {recordingTaskError && recordingTaskIndex === index && (
                                          <div className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            {recordingTaskError}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {task.requires_image && (
                                  <div className="p-4 border border-gray-200 rounded-[8px] bg-gray-50">
                                    <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5 mb-2 select-none">
                                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" /> Screenshot Evidence
                                    </span>
                                    
                                    {response.image_url ? (
                                      <div className="space-y-2">
                                        <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                          <Check className="w-3.5 h-3.5" /> Screenshot Uploaded
                                        </div>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img 
                                          src={response.image_url} 
                                          alt="Task screenshot"
                                          className="w-full max-h-32 object-contain rounded border bg-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAttachment(task.id, 'image_url')}
                                          className="text-xs text-rose-600 font-semibold hover:underline block"
                                        >
                                          Delete and replace
                                        </button>
                                      </div>
                                    ) : (
                                      <div>
                                        <label className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-[8px] flex items-center justify-center gap-1.5 cursor-pointer">
                                          <UploadCloud className="w-3.5 h-3.5 text-blue-500" /> Upload Image
                                          <input
                                            type="file"
                                            accept="image/png, image/jpeg, image/jpg"
                                            onChange={(e) => handleImageSelect(task.id, e)}
                                            className="hidden"
                                          />
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submission Controls */}
                <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleForfeitSlot}
                    className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-[8px] text-gray-700 transition-all"
                  >
                    Forfeit Slot
                  </button>
                  
                  <div className="flex items-center gap-3">
                    {!isFormValid() && (
                      <span className="text-xs text-gray-400 select-none">
                        All checklist checks & answers must be completed.
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={!isFormValid() || submitting}
                      className={`px-6 py-3 font-extrabold text-sm rounded-[8px] text-white shadow-sm transition-all ${
                        isFormValid() && !submitting
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {submitting ? 'Submitting Feedback...' : 'Submit Test Output'}
                    </button>
                  </div>
                </div>
              </form>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
