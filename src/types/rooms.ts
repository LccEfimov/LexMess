export type RoomItem = {
  id: string;
  title: string;
  type: 'public' | 'my' | 'open';
  members: number;
  online?: number;
  isPrivate?: boolean;
  isPersistent?: boolean;
  lastMessage?: string | null;
  lastMessageTs?: number | null;
  unreadCount?: number | null;
  role?: 'owner' | 'moderator' | 'member';
};
