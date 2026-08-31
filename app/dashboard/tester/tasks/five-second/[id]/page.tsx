'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Clock, 
  Check, 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle,
  Play,
  Eye,
  Lock,
  Loader2,
  Info,
  Send,
  Zap,
  FileText
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
  site_url?: string;
}

interface Task {
  id: string;
  listing_id: string;
  order_index: number;
  question_text: string;
  requires_recording: boolean;
  requires_image: boolean;
  type?: string;
  timed_display_seconds?: number;
  image_url?: string;
  screenshot_url?: string;
  target_screenshot_image_url?: string;
}

interface TaskResponseState {
  answer_text: string;
  completed_successfully: boolean;
  difficulty_rating: number;
  first_click_x?: number | null;
  first_click_y?: number | null;
  first_click_time_ms?: number | null;
}

const NDA_CONTENT = `subukAn Tester Agreement & NDA - Five-Second Test

By participating in this test, you agree to the following binding conditions:

1. HONEST & HIGH-EFFORT COMPLETION: You must execute all tasks exactly as described. Payment is strictly subject to the poster's review. Submission of spam, low-effort summaries, or fake proofs will result in immediate disqualification and account flag.

2. CONFIDENTIALITY: The application under test, its features, screenshots, and internal workings are strictly confidential. You may not distribute, discuss, or share any media, screenshots, recordings, or code outside the subukAn portal.

3. TIMED VISUAL IMPRESSION RULES: You will be shown a design for exactly 5 seconds. You agree not to take screenshots, recordings, photos, or note down key details using secondary devices. The test must reflect your genuine, real-time memory and first impression.

4. ESCROW RELEASES: Funds are held safely in escrow. Upon submission, the poster has up to 30 or 60 minutes to review. If they do not take action, payment is automatically released.

Scroll down and review all terms to accept.`;

export default function FiveSecondTestWorkspace() {
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

  const initStarted = useRef(false);
  const popupRef = useRef<Window | null>(null);

  // Steps: 'loading' | 'unauthorized' | 'agreement' | 'cover' | 'viewing' | 'questionnaire' | 'submitted' | 'expired' | 'error'
  const [currentStep, setCurrentStep] = useState<string>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [ipAddress, setIpAddress] = useState('127.0.0.1');

  // Five-Second Test Configuration
  const [timedDisplaySeconds, setTimedDisplaySeconds] = useState(5);
  const [targetImageUrl, setTargetImageUrl] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [viewTimeLeft, setViewTimeLeft] = useState(5);
  const [viewStartTimestamp, setViewStartTimestamp] = useState<number | null>(null);

  // Questionnaire States
  const [taskResponses, setTaskResponses] = useState<Record<string, TaskResponseState>>({});
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [questionnaireTime, setQuestionnaireTime] = useState(0);

  // Overall workspace listing time limit countdown
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Post-Test Threading / Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  // Basic Fingerprint generator
  const getFingerprint = () => {
    if (typeof window === 'undefined') return '';
    return `${navigator.userAgent}|${window.screen.width}x${window.screen.height}|${navigator.language}`;
  };

  // Client IP fetcher
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => {});
  }, []);

  // Initialize Page & Claim Slot
  useEffect(() => {
    if (!id) return;
    if (initStarted.current) return;
    initStarted.current = true;

    const initWorkspace = async () => {
      try {
        // Session Check
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !session || !session.user) {
          setCurrentStep('unauthorized');
          setLoading(false);
          return;
        }

        const userId = session.user.id;

        // Role Check
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

        // Fetch Listing
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

        // Fetch Tasks for the listing
        const { data: tasksData, error: tasksErr } = await supabase
          .from('tasks')
          .select('*')
          .eq('listing_id', id)
          .order('order_index', { ascending: true });

        if (tasksErr || !tasksData || tasksData.length === 0) {
          setError('Failed to fetch testing tasks or no tasks defined.');
          setCurrentStep('error');
          setLoading(false);
          return;
        }

        setTasks(tasksData);

        // Extract timed impression task settings
        const timedTask = tasksData.find(t => t.type === 'timed_impression' || t.timed_display_seconds || t.image_url || t.screenshot_url) || tasksData[0];
        const displaySecs = timedTask?.timed_display_seconds || 5;
        const imgUrl = timedTask?.image_url || timedTask?.screenshot_url || timedTask?.target_screenshot_image_url || '';

        setTimedDisplaySeconds(displaySecs);
        setViewTimeLeft(displaySecs);
        setTargetImageUrl(imgUrl);

        // Preload target screenshot image
        if (imgUrl) {
          const img = new Image();
          img.src = imgUrl;
          img.onload = () => {
            setImageLoaded(true);
          };
          img.onerror = () => {
            console.error('Failed to preload design screenshot.');
            setImageLoaded(true); // Proceed anyway to avoid locking out the user
          };
        } else {
          setImageLoaded(true);
        }

        // Initialize response inputs
        const initialResponses: Record<string, TaskResponseState> = {};
        tasksData.forEach(task => {
          initialResponses[task.id] = {
            answer_text: '',
            completed_successfully: false,
            difficulty_rating: 3
          };
        });
        setTaskResponses(initialResponses);

        // Check if there is an existing submission
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
            setCurrentStep('cover');
          } else if (['pending_review', 'approved', 'rejected', 'submitted'].includes(submissionData.status)) {
            setCurrentStep(submissionData.status);
            await fetchComments(submissionData.id);
          } else if (submissionData.status === 'expired') {
            setCurrentStep('expired');
          }
        } else {
          // Check slot availability
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
            setError('All testing slots for this listing have been claimed.');
            setCurrentStep('error');
            setLoading(false);
            return;
          }

          // Show click-through NDA before claiming slot
          setCurrentStep('agreement');
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

  // Overall Listing Timer countdown
  useEffect(() => {
    if (!submission || !listing || !['cover', 'questionnaire'].includes(currentStep)) return;

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

  // Questionnaire step elapsed time tracker
  useEffect(() => {
    if (currentStep !== 'questionnaire') return;

    const interval = setInterval(() => {
      setQuestionnaireTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentStep]);

  // Prevent copying, right-clicks, and F12 tools during active viewing
  useEffect(() => {
    if (currentStep !== 'viewing') return;

    const preventCopy = (e: ClipboardEvent) => e.preventDefault();
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'u') ||
        (e.metaKey && e.altKey && e.key === 'i')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('copy', preventCopy);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventKeys);

    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventKeys);
    };
  }, [currentStep]);

  // 5-Second viewing countdown timer trigger
  useEffect(() => {
    if (currentStep !== 'viewing') return;

    if (viewTimeLeft <= 0) {
      if (popupRef.current) {
        try {
          popupRef.current.close();
        } catch (e) {
          console.warn('Failed to close popup:', e);
        }
        popupRef.current = null;
      }
      setCurrentStep('questionnaire');
      return;
    }

    const timer = setTimeout(() => {
      setViewTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentStep, viewTimeLeft]);

  // Poll comments for debrief thread
  useEffect(() => {
    const interval = setInterval(() => {
      if (submission && currentStep === 'submitted') {
        fetchComments(submission.id);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [submission, currentStep, fetchComments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (popupRef.current) {
        try {
          popupRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  // NDA modal handlers
  const handleAcceptAgreement = async () => {
    if (submission) {
      setCurrentStep('cover');
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || !listing) {
        setCurrentStep('unauthorized');
        return;
      }

      // Check slot availability
      const { count, error: countErr } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listing.id)
        .neq('status', 'expired');

      if (countErr) throw countErr;
      if (count !== null && count >= listing.slots_count) {
        setError('All testing slots for this listing have been claimed.');
        setCurrentStep('error');
        return;
      }

      // Insert submission to claim slot upon agreement acceptance
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
      setCurrentStep('cover');
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
          difficulty_rating: 3
        }),
        difficulty_rating: val
      }
    }));
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const timedTask = tasks.find(t => t.type === 'timed_impression' || t.timed_display_seconds || t.image_url || t.screenshot_url) || tasks[0];
    if (!timedTask) return;

    const currentResp = taskResponses[timedTask.id];
    if (currentResp && (currentResp.first_click_x !== undefined && currentResp.first_click_x !== null)) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const clickTimeMs = viewStartTimestamp ? Date.now() - viewStartTimestamp : 0;

    setTaskResponses(prev => ({
      ...prev,
      [timedTask.id]: {
        ...(prev[timedTask.id] || {
          answer_text: '',
          completed_successfully: false,
          difficulty_rating: 3
        }),
        first_click_x: x,
        first_click_y: y,
        first_click_time_ms: clickTimeMs
      }
    }));
  };

  // Task checklist validation helper
  const isTaskValid = (task: Task) => {
    const response = taskResponses[task.id];
    if (!response) return false;

    const textValid = (response.answer_text || '').trim().length >= 10;
    const ratingValid = response.difficulty_rating >= 1 && response.difficulty_rating <= 5;
    const completedCheck = checkedTasks[task.id] === true;

    return textValid && ratingValid && completedCheck;
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
    if (currentStep !== 'questionnaire' && currentStep !== 'cover') return;

    // Check if tester has filled out any content
    const hasStartedAny = Object.values(taskResponses).some(
      resp => (resp.answer_text || '').trim().length > 0
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
          time_on_task_seconds: Math.max(1, Math.min(7200, questionnaireTime)),
          difficulty_rating: resp?.difficulty_rating || 3,
          recording_url: null,
          image_url: null,
          first_click_x: resp?.first_click_x ?? null,
          first_click_y: resp?.first_click_y ?? null,
          first_click_time_ms: resp?.first_click_time_ms ?? null,
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
                      <p className="text-gray-800 whitespace-pre-wrap">{comment.comment_text}</p>
                      <span className="text-[9px] text-gray-400 mt-1 block text-right font-medium">
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
            <form onSubmit={handlePostComment} className="flex gap-2 border-t border-gray-100 pt-3">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Type your comment/notes here..."
                disabled={commentsLoading}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-[8px] text-xs focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={commentsLoading || !newCommentText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[8px] text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {commentsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    Send
                  </>
                )}
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
          <h2 className="text-xl font-bold text-gray-900">Session Expired</h2>
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

  // 1. Cover Page Step
  if (currentStep === 'cover' && listing) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] pb-16">
        {secondsLeft !== null && secondsLeft > 0 && (
          <TimerDisplay 
            initialSeconds={secondsLeft} 
            onExpire={handleAutoSubmitOrExpire} 
          />
        )}

        <div className="max-w-3xl mx-auto px-6 pt-6">
          <button 
            onClick={handleForfeitSlot}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-white border px-3 py-1.5 rounded-[8px] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Forfeit Slot & Exit
          </button>
        </div>

        <div className="max-w-3xl mx-auto px-6 mt-6">
          <div className="bg-white border border-gray-200 rounded-[12px] overflow-hidden shadow-sm">
            <EscrowStatusBar 
              budget={listing.rate_per_tester} 
              slots={listing.slots_count} 
              status="active" 
            />

            <div className="p-8 space-y-6">
              <div className="border-b border-gray-100 pb-5">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1 mb-3">
                  <Zap className="w-3.5 h-3.5 text-blue-600" /> Five-Second Impression Test
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2 select-none">
                  {listing.title}
                </h1>
                <p className="text-sm text-gray-500">
                  Read instructions carefully. You must be focused and uninterrupted.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-[8px] p-5 select-none space-y-3">
                <h3 className="font-bold text-sm text-gray-800">Test Context & Rules:</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {listing.description}
                </p>
                <div className="pt-2 border-t border-gray-200/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>Display duration: <strong className="text-gray-700">{timedDisplaySeconds} seconds</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <span>Focus check: <strong className="text-gray-700">Immediate response required</strong></span>
                  </div>
                </div>
              </div>

              {/* A/B Testing Variant box */}
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
                          {variant.url && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Variant URL (for reference):</p>
                              <a
                                href={variant.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 underline break-all"
                                id="tester-variant-link"
                              >
                                {variant.url}
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return <p className="text-sm text-purple-700">Loading variant URL...</p>;
                  })()}
                </div>
              )}

              <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-5 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-gray-900">How it works:</h4>
                  <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                    <li>Clicking the button below will start the countdown and load the design.</li>
                    <li>You will have exactly {timedDisplaySeconds} seconds to examine the page.</li>
                    <li>Pay attention to layout, headers, branding, and who the product is for.</li>
                    <li>Key keyboard and mouse shortcut operations are blocked to prevent content leaking.</li>
                    <li>Once completed, the image is hidden permanently and the question fields appear.</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleForfeitSlot}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-[8px] text-gray-700 transition-all"
                >
                  Forfeit Slot
                </button>

                <button
                  type="button"
                  disabled={!imageLoaded}
                  onClick={() => {
                    if (listing?.site_url) {
                      try {
                        const win = window.open(listing.site_url, '_blank');
                        popupRef.current = win;
                      } catch (err) {
                        console.error('Failed to open test site:', err);
                      }
                    }
                    setViewTimeLeft(timedDisplaySeconds);
                    setCurrentStep('viewing');
                    setViewStartTimestamp(Date.now());
                  }}
                  className="px-6 py-3 font-extrabold text-sm rounded-[8px] text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {!imageLoaded ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading Image Assets...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      Start {timedDisplaySeconds}-Second Test
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Timed Display Stage (Image viewing)
  if (currentStep === 'viewing') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
        {/* Persistent Floating Header for Security & Display Timer */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur rounded-[8px] border border-white/10 text-white text-xs font-mono font-bold">
            <Lock className="w-3.5 h-3.5 text-rose-500" />
            <span>Right-click & copy actions disabled</span>
          </div>
          
          <div className="px-5 py-2.5 bg-blue-600 rounded-[8px] text-white text-lg font-mono font-extrabold shadow-lg animate-pulse flex items-center gap-2">
            <Clock className="w-5 h-5 animate-spin" />
            <span>Viewing: {viewTimeLeft}s</span>
          </div>
        </div>

        {/* Centered Image display container */}
        <div className="w-full max-w-5xl flex items-center justify-center p-4">
          {targetImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={targetImageUrl}
              alt="Design screenshot under review"
              className="max-w-full max-h-[75vh] object-contain shadow-2xl border border-white/10 rounded-[8px] select-none cursor-crosshair"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onClick={handleImageClick}
            />
          ) : (
            <div className="w-full h-80 max-w-2xl bg-gray-800 rounded-lg flex flex-col items-center justify-center text-gray-400 gap-2 border border-dashed border-gray-700">
              <Eye className="w-12 h-12 text-gray-500" />
              <p className="text-sm font-semibold">Image screenshot URL not provided for this listing.</p>
            </div>
          )}
        </div>

        {/* Security watermark footer */}
        <div className="absolute bottom-4 text-[10px] tracking-widest uppercase font-bold text-white/20 select-none">
          subukAn protected review session
        </div>
      </div>
    );
  }

  // 3. Questionnaire responses collection step
  if (currentStep === 'questionnaire' && listing) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] pb-16">
        {secondsLeft !== null && secondsLeft > 0 && (
          <TimerDisplay 
            initialSeconds={secondsLeft} 
            onExpire={handleAutoSubmitOrExpire} 
          />
        )}

        <div className="max-w-4xl mx-auto px-6 pt-6">
          <button 
            onClick={handleForfeitSlot}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-white border px-3 py-1.5 rounded-[8px] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Forfeit Slot & Exit
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-6 mt-6">
          <div className="bg-white border border-gray-200 rounded-[12px] overflow-hidden shadow-sm flex flex-col">
            <EscrowStatusBar 
              budget={listing.rate_per_tester} 
              slots={listing.slots_count} 
              status="active" 
            />

            <div className="p-8 space-y-8">
              <div className="border-b border-gray-100 pb-5">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1 mb-3">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" /> Impression Questionnaire
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight mb-2 select-none">
                  What do you remember about the design?
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  Provide detailed feedback based on your visual memory. Complete all questions below.
                </p>
              </div>

              {actionError && (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-[8px] mb-4 animate-fadeIn">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-6">
                  {tasks.map((task, index) => {
                    const isCompleted = checkedTasks[task.id] || false;
                    const response = taskResponses[task.id] || {
                      answer_text: '',
                      completed_successfully: false,
                      difficulty_rating: 3
                    };

                    return (
                      <div 
                        key={task.id} 
                        className="border border-gray-200 rounded-[12px] p-6 bg-white space-y-4 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
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
                            <span className="font-bold text-gray-900 select-none">Impression {index + 1}</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 font-semibold select-none">
                          {task.question_text}
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 select-none">
                              Your Answer details (minimum 10 characters required)
                            </label>
                            <textarea
                              value={response.answer_text}
                              onChange={(e) => {
                                handleAnswerTextChange(task.id, e.target.value);
                                // Auto-toggle completion checkbox if text is valid
                                if (e.target.value.trim().length >= 10) {
                                  setCheckedTasks(prev => ({ ...prev, [task.id]: true }));
                                }
                              }}
                              placeholder="Describe your first impression: brand, purpose, what stood out, what was confusing..."
                              rows={3}
                              className="w-full p-3 border border-gray-200 rounded-[8px] focus:outline-none focus:border-blue-600 text-sm focus:ring-1 focus:ring-blue-600"
                            />
                            <div className="flex justify-between text-[11px] text-gray-400 mt-1 select-none">
                              <span>Characters: {response.answer_text.length} / 10 required</span>
                              {response.answer_text.length > 0 && response.answer_text.length < 10 && (
                                <span className="text-rose-500 font-semibold">Too short</span>
                              )}
                            </div>
                          </div>

                          {/* 1-5 Difficulty score */}
                          <div>
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 select-none">
                              How clear was this visual element?
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
                              <span>Very Unclear (1)</span>
                              <span>Extremely Clear (5)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                        All check-boxes & answers must be completed.
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
                      {submitting ? 'Submitting Responses...' : 'Submit Test Output'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
