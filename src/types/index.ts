export type PlaybackState = {
  playing: boolean;
  current_time: number;
  updated_at?: string;

};

export type Room = {
  id: string;
  room_code: string;
  name: string | null;
  video_url: string | null;
  video_title: string | null;
  playback_state: PlaybackState;
  avatar_pool: string[];
  host_session_id: string | null;
  created_at: string;
};

export type RoomMember = {
  id: number;
  room_id: string;
  session_id: string;
  display_name: string | null;
  avatar_id: string;
  is_ready: boolean;
  is_buffering: boolean;
  joined_at: string;
};

export type WatchHistoryEntry = {
  id: number;
  room_id: string | null;
  session_id: string;
  video_url: string | null;
  video_title: string | null;
  last_position: number;
  watched_at: string;
};

export type RealtimeEvent =
  | { type: "playback:play"; current_time: number; ts: number }
  | { type: "playback:pause"; current_time: number; ts: number }
  | { type: "playback:seek"; current_time: number; ts: number }
  | { type: "avatar:claim"; session_id: string; avatar_id: string; ts: number }
  | { type: "ready:toggle"; session_id: string; is_ready: boolean; ts: number }
  | { type: "buffering:state"; session_id: string; is_buffering: boolean; ts: number }
  | { type: "emoji:reaction"; emoji: string; sender_avatar: string; ts: number }
  | { type: "video:set"; video_url: string; video_title: string; ts: number };
