"use client";

import { ArrowRight, Clock, Eye, Play } from "lucide-react";
import { DEFAULT_VIDEOS_VISIBILITY, HOME_LIMITS, mostViewed, timeAgo, videoUrl, YOUTUBE_CHANNEL, type Video, type VideosVisibility } from "@/lib/videos";
import VideoCarousel from "@/components/home/VideoCarousel";

// Se a capa grande (maxres/oar2) sumir no YouTube, cai para a padrão, que sempre existe
const fallbackThumb = (e: React.SyntheticEvent<HTMLImageElement>, youtubeId: string) => {
  const img = e.currentTarget;
  const fallback = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  if (img.src !== fallback) img.src = fallback;
};

function RowHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h3 className="font-title text-2xl text-white flex items-center gap-3">
        <Play className="w-5 h-5 text-purple-500 fill-purple-500" /> {title}
      </h3>
      <a href={href} target="_blank" rel="noreferrer" className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
        Ver Todos <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}

// "Vídeos Mais Acessados": os vídeos e Shorts com mais visualizações entre os cadastrados no painel (aba Vídeos)
export default function VideosSection({ videos, visibility = DEFAULT_VIDEOS_VISIBILITY }: { videos: Video[]; visibility?: VideosVisibility }) {
  // Fileira desligada no painel some da home
  const longs = visibility.video ? mostViewed(videos, "video", HOME_LIMITS.video) : [];
  const shorts = visibility.short ? mostViewed(videos, "short", HOME_LIMITS.short) : [];
  if (longs.length === 0 && shorts.length === 0) return null;

  return (
    <section id="videos" className="py-20 bg-black border-t border-white/5 relative scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-bold tracking-[0.3em] text-gray-400 uppercase flex items-center justify-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Conteúdo
          </p>
          <h2 className="font-title text-4xl md:text-5xl text-white">
            Vídeos <span className="text-purple-500">Mais Acessados</span>
          </h2>
          <p className="text-gray-400 mt-4">Os conteúdos que a galera mais assistiu no canal</p>
        </div>

        {longs.length > 0 && (
          <div className={shorts.length > 0 ? "mb-16" : ""}>
            <RowHeader title="Vídeos" href={`${YOUTUBE_CHANNEL}/videos`} />
            {/* 4 por tela no computador, 2 no tablet e 1 e pouco no celular (dá a dica de arrastar) */}
            <VideoCarousel label="Vídeos">
              {longs.map((v) => (
                <a
                  key={v.id}
                  href={videoUrl(v)}
                  target="_blank"
                  rel="noreferrer"
                  className="group shrink-0 snap-start w-[85%] sm:w-[calc((100%-1rem)/2)] md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-4.5rem)/4)] rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/60 bg-[#0c0d10] transition-colors"
                >
                  <div className="relative aspect-video overflow-hidden bg-black">
                    <img
                      src={v.thumbnail_url}
                      alt={v.title}
                      loading="lazy"
                      onError={(e) => fallbackThumb(e, v.youtube_id)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {v.duration && (
                      <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 text-white text-xs font-bold not-italic">
                        {v.duration}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="text-white font-bold text-[15px] leading-snug line-clamp-2 min-h-[2.6em]">{v.title}</h4>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      {v.views && (
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {v.views}</span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {timeAgo(v.published_at)}</span>
                    </div>
                  </div>
                </a>
              ))}
            </VideoCarousel>
          </div>
        )}

        {shorts.length > 0 && (
          <div>
            <RowHeader title="Shorts" href={`${YOUTUBE_CHANNEL}/shorts`} />
            <VideoCarousel label="Shorts">
              {shorts.map((v) => (
                <a
                  key={v.id}
                  href={videoUrl(v)}
                  target="_blank"
                  rel="noreferrer"
                  className="group shrink-0 snap-start w-[42%] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/3)] lg:w-[calc((100%-7.5rem)/6)] rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/60 bg-[#0c0d10] transition-colors"
                >
                  <div className="relative aspect-[9/16] overflow-hidden bg-black">
                    <img
                      src={v.thumbnail_url}
                      alt={v.title}
                      loading="lazy"
                      onError={(e) => fallbackThumb(e, v.youtube_id)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {v.views && (
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/75 text-white text-xs font-bold flex items-center gap-1 not-italic">
                        <Eye className="w-3.5 h-3.5" /> {v.views}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="text-white font-bold text-sm leading-snug line-clamp-2 min-h-[2.6em]">{v.title}</h4>
                  </div>
                </a>
              ))}
            </VideoCarousel>
          </div>
        )}
      </div>
    </section>
  );
}
