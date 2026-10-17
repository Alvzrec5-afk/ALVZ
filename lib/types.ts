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
