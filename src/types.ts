export interface User {
  uid: string;
  email: string;
  role: 'admin' | 'moderator' | 'user';
  displayName?: string;
  photoURL?: string;
  bio?: string;
  createdAt: any;
}

export interface Board {
  id: string; // e.g. "b"
  name: string;
  description: string;
  category: string;
  createdAt: any;
  rules?: string;
}

export interface Thread {
  id: string;
  boardId: string;
  title: string;
  createdAt: any;
  lastBump: any;
  isArchived: boolean;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  imageCount: number;
}

export interface Post {
  id: string;
  threadId: string;
  boardId: string;
  authorName: string;
  authorUid?: string; // Link to user profile if logged in
  authorRole?: string;
  content: string;
  createdAt: any;
  image?: {
    url: string;
    filename: string;
    width: number;
    height: number;
    size: number;
  };
  ip?: string;
  isOp: boolean;
}

export interface Ban {
  id: string;
  ip: string;
  reason: string;
  expiresAt: any;
  createdAt: any;
  createdBy: string;
}

export interface IpAction {
  id: string;
  type: 'ban' | 'mute';
  ip: string;
  reason: string;
  expiresAt: any;
  createdAt: any;
  createdBy?: string | null;
  active: boolean;
}

export interface Report {
  id: string;
  postId: string;
  threadId: string;
  boardId: string;
  reason: string;
  createdAt: any;
  status: 'pending' | 'resolved';
}
