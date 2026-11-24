import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { streamService } from "../services/streamService";

type WatchStatus = "loading" | "connecting" | "live" | "ended" | "not-found";

export function Watch() {
  const { slug } = useParams<{ slug: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<WatchStatus>("loading");

  useEffect(() => {
    if (!slug) {
      setStatus("not-found");
      return;
    }

    let pc: RTCPeerConnection | null = null;
    let ws: WebSocket | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        const stream = await streamService.getStreamBySlug(slug);
        if (cancelled) return;

        if (!stream.is_live) {
          setStatus("ended");
          return;
        }

        setStatus("connecting");
        pc = new RTCPeerConnection(streamService.getIceServers());
        ws = new WebSocket(streamService.getSignalingWsUrl(slug, "viewer"));

        pc.ontrack = (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
            setStatus("live");
          }
        };

        pc.onicecandidate = (e) => {
          if (e.candidate && ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
          }
        };

        ws.onmessage = async (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "offer" && pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws?.send(JSON.stringify({ type: "answer", sdp: answer }));
          }

          if (msg.type === "ice" && pc) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }

          if (msg.type === "stream-ended") {
            setStatus("ended");
          }
        };
      } catch {
        if (!cancelled) {
          setStatus("not-found");
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      ws?.close();
      pc?.close();
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {status === "not-found" && (
          <div className="aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
            <p className="text-zinc-400">Transmissão não encontrada.</p>
          </div>
        )}

        {status === "ended" && (
          <div className="aspect-video bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
            <p className="text-zinc-400">Esta transmissão foi encerrada.</p>
          </div>
        )}

        {(status === "loading" || status === "connecting" || status === "live") && (
          <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800">
            <video ref={videoRef} autoPlay playsInline controls className="w-full h-full object-cover" />
            {status !== "live" && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70">
                <p className="text-sm text-zinc-300">Conectando ao sinal ao vivo...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}