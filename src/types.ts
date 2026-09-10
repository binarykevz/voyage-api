export type MediaType = "image" | "video";

export type MediaRecord = {
  id: string;
  title: string;
  description: string | null;
  country: string | null;
  file_key: string;
  file_url: string;
  mime_type: string;
  size: number;
  media_type: MediaType;
  width: number | null;
  height: number | null;
  duration: number | null;
  created_at: number;
};

export type MediaResponse = {
  id: string;
  title: string;
  description: string | null;
  country: string | null;
  media: {
    url: string;
    type: MediaType;
    mimeType: string;
    size: number;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
  };
  createdAt: string;
};

export function toResponse(r: MediaRecord): MediaResponse {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    country: r.country,
    media: {
      url: r.file_url,
      type: r.media_type,
      mimeType: r.mime_type,
      size: r.size,
      width: r.width,
      height: r.height,
      duration: r.duration,
    },
    createdAt: new Date(r.created_at * 1000).toISOString(),
  };
}
