export type Collection = { id: string; name: string; position: number };

export type PhotoRow = {
  id: string;
  gallery_id: string;
  collection_id: string;
  filename: string;
  original_ext: string;
  width: number;
  height: number;
  taken_at: string | null;
  position: number;
};

/** Ce que reçoit le navigateur : uniquement des URL temporaires, jamais de clé. */
export type PhotoView = {
  id: string;
  collectionId: string;
  filename: string;
  width: number;
  height: number;
  thumb: string;
  web: string;
};

export type Rendition = { h: number; w: number; bytes: number };

export type VideoRow = {
  id: string;
  gallery_id: string;
  title: string;
  filename: string;
  original_ext: string;
  size_bytes: number;
  renditions: Rendition[];
  duration: number;
  width: number;
  height: number;
  watermarked: boolean;
  downloads_enabled: boolean;
  position: number;
  created_at: string;
};

export type VideoDownload = { quality: string; label: string; bytes: number };

/** Ce que reçoit le lecteur : URL temporaires des différentes qualités, jamais de clé. */
export type VideoView = {
  id: string;
  title: string;
  duration: number;
  width: number;
  height: number;
  poster: string;
  /** `url` vide sur les pages clients : le lecteur les demande à `stream` (jamais écrites dans la page). */
  sources: { h: number; url: string; bytes: number }[];
  stream?: string;
  downloads: VideoDownload[];
  /** Filigrane affiché par-dessus le lecteur quand il n'est pas incrusté dans la vidéo. */
  overlayWatermark: boolean;
  downloadsEnabled: boolean;
  watermarked: boolean;
};

export type VideoComment = { id: string; time_sec: number; author: string; body: string; resolved: boolean; created_at: string };
