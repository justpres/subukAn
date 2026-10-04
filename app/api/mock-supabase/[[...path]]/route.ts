import { NextRequest, NextResponse } from 'next/server';

interface MockUser {
  id: string;
  email?: string;
  user_metadata?: {
    role?: string;
    full_name?: string;
    device_type?: string;
    device_types?: string[];
    location?: string;
    tech_comfort_level?: string;
    phone_verified?: boolean;
    age_group?: string;
    [key: string]: unknown;
  };
  created_at?: string;
}

interface MockProfile {
  id: string;
  role?: string;
  full_name?: string;
  device_type?: string;
  device_types?: string[];
  location?: string | null;
  notification_settings?: {
    email_payouts: boolean;
    email_submissions: boolean;
    email_listings: boolean;
    email_disputes: boolean;
    [key: string]: boolean;
  };
  tech_comfort_level?: string;
  phone_verified?: boolean;
  age_group?: string | null;
  gender?: string | null;
  employment_status?: string | null;
  tech_literacy?: string | null;
  accessibility_tags?: string[];
  crypto_wallet_address?: string | null;
  preferred_payout_rail?: string;
  created_at?: string;
  updated_at?: string;
}

interface MockVariant {
  id?: string;
  [key: string]: unknown;
}

interface MockListing {
  id: string;
  poster_id?: string;
  title?: string;
  description?: string;
  site_url?: string;
  rate_per_tester?: number;
  slots_count?: number;
  total_budget?: number;
  status?: string;
  submissions?: MockSubmission[];
  tasks?: MockTask[];
  variants?: MockVariant[];
  target_accessibility_tags?: string[];
  parent_listing_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface MockTask {
  id: string;
  listing_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface MockSubmission {
  id: string;
  listing_id?: string;
  tester_id?: string;
  status?: string;
  assigned_variant_id?: string | null;
  started_at?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface MockTaskResponse {
  id: string;
  submission_id?: string;
  task_id?: string;
  first_click_x?: number | null;
  first_click_y?: number | null;
  first_click_time_ms?: number | null;
  first_click_screen_width?: number | null;
  first_click_screen_height?: number | null;
  created_at?: string;
  [key: string]: unknown;
}

interface MockComment {
  id: string;
  submission_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
}

interface MockNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link_url?: string;
  created_at: string;
}

interface MockPosterPaymentSettings {
  id: string;
  payment_settings: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface MockDb {
  users: Map<string, MockUser>;
  profiles: Map<string, MockProfile>;
  listings: Map<string, MockListing>;
  tasks: Map<string, MockTask>;
  submissions: Map<string, MockSubmission>;
  taskResponses: Map<string, MockTaskResponse>;
  submissionComments: Map<string, MockComment>;
  notifications: Map<string, MockNotification>;
  posterPaymentSettings: Map<string, MockPosterPaymentSettings>;
}

const globalRef = globalThis as typeof globalThis & { mockDb?: MockDb };
if (!globalRef.mockDb) {
  const users = new Map<string, MockUser>();
  const profiles = new Map<string, MockProfile>();
  const listings = new Map<string, MockListing>();
  const tasks = new Map<string, MockTask>();
  const submissions = new Map<string, MockSubmission>();
  const taskResponses = new Map<string, MockTaskResponse>();
  const submissionComments = new Map<string, MockComment>();
  const notifications = new Map<string, MockNotification>();
  const posterPaymentSettings = new Map<string, MockPosterPaymentSettings>();

  // Auto-seed default poster user
  users.set('user_mock_poster_id', {
    id: 'user_mock_poster_id',
    email: 'test-poster@example.com',
    user_metadata: {
      role: 'poster',
      full_name: 'Test Poster',
      device_type: 'desktop',
      tech_comfort_level: 'casual_user',
      phone_verified: true,
    },
    created_at: new Date().toISOString(),
  });
  profiles.set('user_mock_poster_id', {
    id: 'user_mock_poster_id',
    role: 'poster',
    full_name: 'Test Poster',
    device_type: 'desktop',
    device_types: ['Windows PC'],
    location: 'Metro Manila',
    notification_settings: {
      email_payouts: true,
      email_submissions: true,
      email_listings: true,
      email_disputes: true,
    },
    tech_comfort_level: 'casual_user',
    phone_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  posterPaymentSettings.set('user_mock_poster_id', {
    id: 'user_mock_poster_id',
    payment_settings: {
      sandbox_mode: true,
      paymongo_public_key: 'pk_mock_key',
      paymongo_secret_key: 'sk_mock_key',
      gcash_payout_number: '0917-333-4444',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Auto-seed default tester user
  users.set('user_mock_tester_id', {
    id: 'user_mock_tester_id',
    email: 'test-tester@example.com',
    user_metadata: {
      role: 'tester',
      full_name: 'Test Tester',
      device_type: 'both',
      device_types: ['Android Mobile', 'Windows PC'],
      location: 'Metro Manila',
      tech_comfort_level: 'non_technical',
      phone_verified: true,
    },
    created_at: new Date().toISOString(),
  });
  profiles.set('user_mock_tester_id', {
    id: 'user_mock_tester_id',
    role: 'tester',
    full_name: 'Test Tester',
    device_type: 'both',
    device_types: ['Android Mobile', 'Windows PC'],
    location: 'Metro Manila',
    notification_settings: {
      email_payouts: true,
      email_submissions: true,
      email_listings: true,
      email_disputes: true,
    },
    tech_comfort_level: 'non_technical',
    phone_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  globalRef.mockDb = {
    users,
    profiles,
    listings,
    tasks,
    submissions,
    taskResponses,
    submissionComments,
    notifications,
    posterPaymentSettings,
  };
}
const db = globalRef.mockDb;

function getResponsePayload(data: unknown, prefersObject: boolean): unknown {
  if (prefersObject) {
    if (Array.isArray(data)) {
      return data.length > 0 ? data[0] : null;
    }
    return data;
  }
  if (!Array.isArray(data)) {
    return [data];
  }
  return data;
}

interface RequestBody {
  id?: string;
  email?: string;
  user_metadata?: {
    role?: string;
    full_name?: string;
    device_type?: string;
    device_types?: string[];
    location?: string;
    tech_comfort_level?: string;
    phone_verified?: boolean;
    age_group?: string;
    [key: string]: unknown;
  };
  title?: string;
  description?: string;
  rate_per_tester?: number;
  slots_count?: number;
  total_budget?: number;
  status?: string;
  started_at?: string;
  submission_id?: string;
  task_id?: string;
  parent_listing_id?: string | null;
  assigned_variant_id?: string | null;
  [key: string]: unknown;
}

export async function GET(request: NextRequest, { params }: { params: { path?: string[] } }) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  const path = params.path?.join('/') || '';
  const url = new URL(request.url);
  const acceptHeader = request.headers.get('Accept') || '';
  const prefersObject = acceptHeader.includes('vnd.pgrst.object');

  // 1. Auth GET user
  if (path === 'auth/v1/user') {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const userId = token.replace('mock-access-token-', '');
    const user = db.users.get(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  }

  // 2. Auth GET admin list users
  if (path === 'auth/v1/admin/users') {
    return NextResponse.json({ users: Array.from(db.users.values()) });
  }

  // 3. REST profiles
  if (path === 'rest/v1/profiles') {
    const idParam = url.searchParams.get('id');
    if (idParam && idParam.startsWith('eq.')) {
      const id = idParam.substring(3);
      const profile = db.profiles.get(id);
      return NextResponse.json(getResponsePayload(profile, prefersObject));
    }
    return NextResponse.json(Array.from(db.profiles.values()));
  }

  // REST poster_payment_settings
  if (path === 'rest/v1/poster_payment_settings') {
    const idParam = url.searchParams.get('id');
    if (idParam && idParam.startsWith('eq.')) {
      const id = idParam.substring(3);
      const settings = db.posterPaymentSettings.get(id);
      return NextResponse.json(getResponsePayload(settings, prefersObject));
    }
    return NextResponse.json(Array.from(db.posterPaymentSettings.values()));
  }

  // 4. REST listings
  if (path === 'rest/v1/listings') {
    const statusParam = url.searchParams.get('status');
    const posterParam = url.searchParams.get('poster_id');
    const idParam = url.searchParams.get('id');
    const parentParam = url.searchParams.get('parent_listing_id');

    let list = Array.from(db.listings.values());
    if (idParam && idParam.startsWith('eq.')) {
      const id = idParam.substring(3);
      const listing = db.listings.get(id);
      list = listing ? [listing] : [];
    } else {
      if (statusParam && statusParam.startsWith('eq.')) {
        const status = statusParam.substring(3);
        list = list.filter(l => l.status === status);
      } else if (statusParam && statusParam.startsWith('in.')) {
        const allowed = statusParam
          .replace(/^in\.\(|\)$/g, '')
          .split(',')
          .map(s => s.trim().replace(/^["']|["']$/g, ''));
        list = list.filter(l => l.status && allowed.includes(l.status));
      }
      if (posterParam && posterParam.startsWith('eq.')) {
        const posterId = posterParam.substring(3);
        list = list.filter(l => l.poster_id === posterId);
      }
      if (parentParam && parentParam.startsWith('eq.')) {
        const parentId = parentParam.substring(3);
        list = list.filter(l => l.parent_listing_id === parentId);
      }
    }

    const select = url.searchParams.get('select') || '';
    const result = list.map(listing => {
      const copy: MockListing = { ...listing };
      if (select.includes('submissions')) {
        copy.submissions = Array.from(db.submissions.values()).filter(s => s.listing_id === listing.id);
      }
      if (select.includes('tasks')) {
        copy.tasks = Array.from(db.tasks.values()).filter(t => t.listing_id === listing.id);
      }
      return copy;
    });

    const orderParam = url.searchParams.get('order');
    if (orderParam && orderParam.includes('created_at') && orderParam.includes('desc')) {
      result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } else if (orderParam && orderParam.includes('created_at')) {
      result.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    }

    return NextResponse.json(getResponsePayload(result, prefersObject));
  }

  // 5. REST tasks
  if (path === 'rest/v1/tasks') {
    const listingParam = url.searchParams.get('listing_id');
    let list = Array.from(db.tasks.values());
    if (listingParam && listingParam.startsWith('eq.')) {
      const listingId = listingParam.substring(3);
      list = list.filter(t => t.listing_id === listingId);
    }
    return NextResponse.json(getResponsePayload(list, prefersObject));
  }

  // 6. REST submissions
  if (path === 'rest/v1/submissions') {
    const listingParam = url.searchParams.get('listing_id');
    const testerParam = url.searchParams.get('tester_id');

    let list = Array.from(db.submissions.values());
    if (listingParam && listingParam.startsWith('eq.')) {
      const listingId = listingParam.substring(3);
      list = list.filter(s => s.listing_id === listingId);
    }
    if (testerParam && testerParam.startsWith('eq.')) {
      const testerId = testerParam.substring(3);
      list = list.filter(s => s.tester_id === testerId);
    }

    return NextResponse.json(getResponsePayload(list, prefersObject));
  }

  // 7. REST payouts
  if (path === 'rest/v1/payouts') {
    return NextResponse.json([]);
  }

  // 8. REST submission_comments
  if (path === 'rest/v1/submission_comments') {
    const submissionParam = url.searchParams.get('submission_id');
    let list = Array.from(db.submissionComments.values());
    if (submissionParam && submissionParam.startsWith('eq.')) {
      const subId = submissionParam.substring(3);
      list = list.filter(c => c.submission_id === subId);
    }
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const commentsWithProfiles = list.map(c => {
      const profile = db.profiles.get(c.user_id) || { full_name: 'User Tester', role: 'tester' };
      return {
        ...c,
        profiles: {
          full_name: profile.full_name || 'User Tester',
          role: profile.role || 'tester'
        }
      };
    });
    return NextResponse.json(getResponsePayload(commentsWithProfiles, prefersObject));
  }

  // 9. REST notifications
  if (path === 'rest/v1/notifications') {
    const userIdParam = url.searchParams.get('user_id');
    let list = Array.from(db.notifications.values());
    if (userIdParam && userIdParam.startsWith('eq.')) {
      const uId = userIdParam.substring(3);
      list = list.filter(n => n.user_id === uId);
    }
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json(getResponsePayload(list, prefersObject));
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export async function POST(request: NextRequest, { params }: { params: { path?: string[] } }) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  const path = params.path?.join('/') || '';
  const body = await request.json().catch(() => ({})) as RequestBody;
  const acceptHeader = request.headers.get('Accept') || '';
  const prefersObject = acceptHeader.includes('vnd.pgrst.object');

  // 1. Auth Admin Create User
  if (path === 'auth/v1/admin/users') {
    const userId = body.id || `user_${Math.random().toString(36).substring(2, 12)}`;
    const user: MockUser = {
      id: userId,
      email: body.email,
      user_metadata: body.user_metadata || {},
      created_at: new Date().toISOString(),
    };
    db.users.set(userId, user);

    const profile: MockProfile = {
      id: userId,
      role: body.user_metadata?.role || 'tester',
      full_name: body.user_metadata?.full_name || '',
      device_type: body.user_metadata?.device_type || 'desktop',
      device_types: Array.isArray(body.user_metadata?.device_types)
        ? body.user_metadata.device_types
        : ['Android Mobile', 'Windows PC'],
      location: (body.user_metadata?.location as string | undefined) || 'Metro Manila',
      notification_settings: (body.user_metadata?.notification_settings as {
        email_payouts: boolean;
        email_submissions: boolean;
        email_listings: boolean;
        email_disputes: boolean;
      } | undefined) || {
        email_payouts: true,
        email_submissions: true,
        email_listings: true,
        email_disputes: true,
      },
      tech_comfort_level: body.user_metadata?.tech_comfort_level || 'casual_user',
      phone_verified: body.user_metadata?.phone_verified || true,
      age_group: body.user_metadata?.age_group || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.profiles.set(userId, profile);

    if (body.user_metadata?.role === 'poster') {
      const settings: MockPosterPaymentSettings = {
        id: userId,
        payment_settings: {
          sandbox_mode: true,
          paymongo_public_key: '',
          paymongo_secret_key: '',
          gcash_payout_number: ''
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.posterPaymentSettings.set(userId, settings);
    }

    return NextResponse.json({ user });
  }

  // 2. Auth Sign In with password
  if (path === 'auth/v1/token') {
    const email = body.email;
    const user = Array.from(db.users.values()).find(u => u.email === email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 });
    }
    const session = {
      access_token: `mock-access-token-${user.id}`,
      refresh_token: 'mock-refresh-token',
      user,
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    return NextResponse.json(session);
  }

  // 3. REST profiles upsert
  if (path === 'rest/v1/profiles') {
    const data = body;
    const profileId = String(data.id || '');
    const existing = db.profiles.get(profileId);
    const profile: MockProfile = {
      id: profileId,
      role: String(data.role || existing?.role || 'tester'),
      full_name: String(data.full_name || existing?.full_name || ''),
      device_type: data.device_type !== undefined ? String(data.device_type) : (existing?.device_type || 'desktop'),
      device_types: Array.isArray(data.device_types)
        ? data.device_types
        : (existing?.device_types || ['Android Mobile', 'Windows PC']),
      location: data.location !== undefined ? (data.location ? String(data.location) : null) : (existing?.location ?? 'Metro Manila'),
      notification_settings: (data.notification_settings as {
        email_payouts: boolean;
        email_submissions: boolean;
        email_listings: boolean;
        email_disputes: boolean;
      } | undefined) || existing?.notification_settings || {
        email_payouts: true,
        email_submissions: true,
        email_listings: true,
        email_disputes: true,
      },
      tech_comfort_level: String(data.tech_comfort_level || existing?.tech_comfort_level || 'casual_user'),
      phone_verified: Boolean(data.phone_verified ?? existing?.phone_verified ?? true),
      age_group: data.age_group !== undefined ? (data.age_group ? String(data.age_group) : null) : (existing?.age_group || null),
      gender: data.gender !== undefined ? (data.gender ? String(data.gender) : null) : (existing?.gender || null),
      employment_status: data.employment_status !== undefined ? (data.employment_status ? String(data.employment_status) : null) : (existing?.employment_status || null),
      tech_literacy: data.tech_literacy !== undefined ? (data.tech_literacy ? String(data.tech_literacy) : null) : (existing?.tech_literacy || null),
      accessibility_tags: Array.isArray(data.accessibility_tags)
        ? data.accessibility_tags
        : (existing?.accessibility_tags || []),
      crypto_wallet_address: data.crypto_wallet_address !== undefined ? (data.crypto_wallet_address ? String(data.crypto_wallet_address) : null) : (existing?.crypto_wallet_address || null),
      preferred_payout_rail: data.preferred_payout_rail !== undefined ? String(data.preferred_payout_rail) : (existing?.preferred_payout_rail || 'gcash'),
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.profiles.set(profileId, profile);
    return NextResponse.json(getResponsePayload(profile, prefersObject));
  }

  // REST poster_payment_settings upsert
  if (path === 'rest/v1/poster_payment_settings') {
    const isArray = Array.isArray(body);
    const items = isArray ? (body as Record<string, unknown>[]) : [body as Record<string, unknown>];
    const results = items.map(item => {
      const id = String(item.id || '');
      const existing = db.posterPaymentSettings.get(id);
      const payment_settings = (item.payment_settings as Record<string, unknown> | undefined) || existing?.payment_settings || {
        sandbox_mode: true,
        paymongo_public_key: '',
        paymongo_secret_key: '',
        gcash_payout_number: ''
      };
      const settings: MockPosterPaymentSettings = {
        id,
        payment_settings,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.posterPaymentSettings.set(id, settings);
      return settings;
    });
    return NextResponse.json(getResponsePayload(isArray ? results : results[0], prefersObject));
  }

  // 4. REST listings insert
  if (path === 'rest/v1/listings') {
    const listingId = body.id || `listing_${Math.random().toString(36).substring(2, 12)}`;
    const listing: MockListing = {
      id: listingId,
      ...body,
      variants: Array.isArray(body.variants) ? (body.variants as MockVariant[]) : [],
      target_accessibility_tags: Array.isArray(body.target_accessibility_tags) ? body.target_accessibility_tags : [],
      parent_listing_id: body.parent_listing_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.listings.set(listingId, listing);
    return NextResponse.json(getResponsePayload(listing, prefersObject));
  }

  // 5. REST tasks insert
  if (path === 'rest/v1/tasks') {
    const isArray = Array.isArray(body);
    const data = isArray ? (body as unknown as MockTask[]) : [body as unknown as MockTask];
    const inserted = data.map(t => {
      const taskId = String(t.id || `task_${Math.random().toString(36).substring(2, 12)}`);
      const task: MockTask = {
        ...t,
        id: taskId,
        created_at: new Date().toISOString(),
      };
      db.tasks.set(taskId, task);
      return task;
    });
    return NextResponse.json(getResponsePayload(inserted, prefersObject));
  }

  // 6. REST submissions insert
  if (path === 'rest/v1/submissions') {
    const listingId = body.listing_id ? String(body.listing_id) : '';
    const listing = db.listings.get(listingId);
    let assignedVariantId = body.assigned_variant_id || null;
    if (!assignedVariantId && listing && Array.isArray(listing.variants) && listing.variants.length > 0) {
      const idx = Math.floor(Math.random() * listing.variants.length);
      assignedVariantId = listing.variants[idx].id || String(idx);
    }

    const submissionId = body.id || `submission_${Math.random().toString(36).substring(2, 12)}`;
    const submission: MockSubmission = {
      id: submissionId,
      ...body,
      assigned_variant_id: assignedVariantId,
      started_at: body.started_at || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    db.submissions.set(submissionId, submission);
    return NextResponse.json(getResponsePayload(submission, prefersObject));
  }

  // 7. REST task_responses upsert
  if (path === 'rest/v1/task_responses') {
    const isArray = Array.isArray(body);
    const data = isArray ? (body as unknown as MockTaskResponse[]) : [body as unknown as MockTaskResponse];
    const inserted = data.map(tr => {
      const key = `${tr.submission_id}_${tr.task_id}`;
      const responseId = String(tr.id || `response_${Math.random().toString(36).substring(2, 12)}`);
      const response: MockTaskResponse = {
        ...tr,
        id: responseId,
        created_at: new Date().toISOString(),
      };
      db.taskResponses.set(key, response);
      return response;
    });
    return NextResponse.json(getResponsePayload(inserted, prefersObject));
  }

  // 8. REST submission_comments insert
  if (path === 'rest/v1/submission_comments') {
    const commentId = body.id || `comment_${Math.random().toString(36).substring(2, 12)}`;
    const comment: MockComment = {
      id: commentId,
      submission_id: String(body.submission_id || ''),
      user_id: String(body.user_id || ''),
      comment_text: String(body.comment_text || ''),
      created_at: new Date().toISOString(),
    };
    db.submissionComments.set(commentId, comment);
    return NextResponse.json(getResponsePayload(comment, prefersObject));
  }

  // 9. REST notifications insert
  if (path === 'rest/v1/notifications') {
    const notifId = body.id || `notif_${Math.random().toString(36).substring(2, 12)}`;
    const notif: MockNotification = {
      id: notifId,
      user_id: String(body.user_id || ''),
      title: String(body.title || ''),
      message: String(body.message || ''),
      type: String(body.type || 'submission_update'),
      is_read: Boolean(body.is_read || false),
      link_url: body.link_url ? String(body.link_url) : undefined,
      created_at: new Date().toISOString(),
    };
    db.notifications.set(notifId, notif);
    return NextResponse.json(getResponsePayload(notif, prefersObject));
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export async function PATCH(request: NextRequest, { params }: { params: { path?: string[] } }) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  const path = params.path?.join('/') || '';
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({})) as RequestBody;
  const acceptHeader = request.headers.get('Accept') || '';
  const prefersObject = acceptHeader.includes('vnd.pgrst.object');

  // 1. REST submissions update
  if (path === 'rest/v1/submissions') {
    const idParam = url.searchParams.get('id');
    if (idParam && idParam.startsWith('eq.')) {
      const id = idParam.substring(3);
      const sub = db.submissions.get(id);
      if (sub) {
        const updated: MockSubmission = {
          ...sub,
          ...body,
          updated_at: new Date().toISOString(),
        };
        db.submissions.set(id, updated);
        return NextResponse.json(getResponsePayload(updated, prefersObject));
      }
    }
  }

  // 2. REST profiles update
  if (path === 'rest/v1/profiles') {
    const idParam = url.searchParams.get('id');
    if (idParam && idParam.startsWith('eq.')) {
      const id = idParam.substring(3);
      const profile = db.profiles.get(id);
      if (profile) {
        const updated: MockProfile = {
          ...profile,
          ...body,
          updated_at: new Date().toISOString(),
        };

        // Explicitly preserve empty array for device_types if provided in body
        if (Array.isArray(body.device_types)) {
          updated.device_types = body.device_types;
        }
        if (body.location !== undefined) {
          updated.location = body.location ? String(body.location) : null;
        }
        if (body.notification_settings !== undefined) {
          updated.notification_settings = {
            ...(profile.notification_settings || {
              email_payouts: true,
              email_submissions: true,
              email_listings: true,
              email_disputes: true,
            }),
            ...(body.notification_settings as Record<string, boolean>),
          };
        }

        db.profiles.set(id, updated);
        return NextResponse.json(getResponsePayload(updated, prefersObject));
      }
    }
  }

  // REST poster_payment_settings update
  if (path === 'rest/v1/poster_payment_settings') {
    const idParam = url.searchParams.get('id');
    if (idParam && idParam.startsWith('eq.')) {
      const id = idParam.substring(3);
      const settings = db.posterPaymentSettings.get(id);
      if (settings) {
        const updated: MockPosterPaymentSettings = {
          ...settings,
          ...body,
          updated_at: new Date().toISOString(),
        };
        db.posterPaymentSettings.set(id, updated);
        return NextResponse.json(getResponsePayload(updated, prefersObject));
      }
    }
  }

  // 3. REST notifications update
  if (path === 'rest/v1/notifications') {
    const idParam = url.searchParams.get('id');
    const userIdParam = url.searchParams.get('user_id');
    if (idParam && idParam.startsWith('eq.')) {
      const id = idParam.substring(3);
      const notif = db.notifications.get(id);
      if (notif) {
        const updated: MockNotification = {
          ...notif,
          ...body,
        };
        db.notifications.set(id, updated);
        return NextResponse.json(getResponsePayload(updated, prefersObject));
      }
    } else if (userIdParam && userIdParam.startsWith('eq.')) {
      const uId = userIdParam.substring(3);
      db.notifications.forEach((n, id) => {
        if (n.user_id === uId) {
          db.notifications.set(id, { ...n, ...body });
        }
      });
      return NextResponse.json([]);
    }
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: { params: { path?: string[] } }) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  return POST(request, { params });
}

export async function DELETE(request: NextRequest, { params }: { params: { path?: string[] } }) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  const path = params.path?.join('/') || '';
  const url = new URL(request.url);

  if (path === 'rest/v1/listings') {
    const titleParam = url.searchParams.get('title');
    if (titleParam && titleParam.startsWith('eq.')) {
      const title = titleParam.substring(3);
      db.listings.forEach((listing, id) => {
        if (listing.title === title) {
          db.listings.delete(id);
        }
      });
    }
    return new NextResponse(null, { status: 204 });
  }

  if (path === 'rest/v1/notifications') {
    const idParam = url.searchParams.get('id');
    const userIdParam = url.searchParams.get('user_id');
    if (idParam && idParam.startsWith('eq.')) {
      const id = idParam.substring(3);
      db.notifications.delete(id);
    } else if (userIdParam && userIdParam.startsWith('eq.')) {
      const uId = userIdParam.substring(3);
      db.notifications.forEach((n, id) => {
        if (n.user_id === uId) {
          db.notifications.delete(id);
        }
      });
    }
    return new NextResponse(null, { status: 204 });
  }

  if (path === 'rest/v1/poster_payment_settings') {
    const idParam = url.searchParams.get('id');
    if (idParam && idParam.startsWith('eq.')) {
      const id = idParam.substring(3);
      db.posterPaymentSettings.delete(id);
    }
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}
