import { useEffect, useMemo, useRef, useState } from "react";
import { Video, VideoOff, Mic, MicOff, Copy, Check, Radio, Square, Loader2 } from "lucide-react";
import { streamService } from "../services/streamService";

export function Broadcast() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const peersMap = useMemo(() => new Map<string, RTCPeerConnection>(), []);

  const [isLive, setIsLive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Seu navegador não suporta acesso à câmera/microfone neste contexto.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      .then((mediaStream) => {
        localStream = mediaStream;
        if (!active) {
          mediaStream.getTracks?.().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch(() => {
        if (active) {
          setErrorMsg("Não foi possível acessar a webcam ou microfone. Verifique as permissões.");
        }
      });

    return () => {
      active = false;
      wsRef.current?.close();
      wsRef.current = null;

      peersMap.forEach((pc) => pc.close());
      peersMap.clear();

      localStream?.getTracks?.().forEach((t) => t.stop());
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [peersMap]);

  const startLive = async () => {
    setErrorMsg(null);
    setIsStarting(true);

    try {
      const data = await streamService.createStream();
      setShareUrl(data.shareUrl);

      const ws = new WebSocket(streamService.getSignalingWsUrl(data.slug, "broadcaster"));
      wsRef.current = ws;

      ws.onmessage = async (event) => {
        if (typeof event.data !== "string") return;

        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "viewer-joined") {
          setViewers((v) => v + 1);
          const pc = new RTCPeerConnection(streamService.getIceServers());
          peersMap.set(msg.peerId, pc);

          streamRef.current?.getTracks?.().forEach((track) => {
            if (streamRef.current) {
              pc.addTrack(track, streamRef.current);
            }
          });

          pc.onicecandidate = (e) => {
            if (e.candidate && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ice", candidate: e.candidate, targetPeerId: msg.peerId }));
            }
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "offer", sdp: offer, targetPeerId: msg.peerId }));
          }
        }

        if (msg.type === "answer") {
          const pc = peersMap.get(msg.peerId);
          if (pc && msg.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          }
        }

        if (msg.type === "ice") {
          const pc = peersMap.get(msg.peerId);
          if (pc && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
        }

        if (msg.type === "viewer-left") {
          peersMap.get(msg.peerId)?.close();
          peersMap.delete(msg.peerId);
          setViewers((v) => Math.max(0, v - 1));
        }
      };

      setIsLive(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao criar a transmissão no servidor.");
    } finally {
      setIsStarting(false);
    }
  };

  const stopLive = () => {
    wsRef.current?.close();
    wsRef.current = null;

    peersMap.forEach((pc) => pc.close());
    peersMap.clear();

    setIsLive(false);
    setShareUrl("");
    setViewers(0);
  };

  const toggleTrack = (kind: "audio" | "video") => {
    const track = streamRef.current?.getTracks?.().find((t) => t.kind === kind);
    if (!track) return;
    track.enabled = !track.enabled;
    if (kind === "audio") {
      setMicOn(track.enabled);
    } else {
      setCamOn(track.enabled);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusText = isLive ? `Ao vivo • ${viewers} assistindo` : "Pronto para transmitir";

  return (
    <div
      translate="no"
      className="notranslate min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${isLive ? "bg-red-500 animate-pulse" : "bg-zinc-600"}`}
            />
            <h1 className="text-lg font-medium tracking-tight">{statusText}</h1>
          </div>

          <button
            type="button"
            onClick={copyLink}
            disabled={!shareUrl}
            className={`flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-full text-sm transition ${
              shareUrl ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Link copiado!" : shareUrl || "link"}</span>
          </button>
        </div>

        <div
          className={`bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded-xl ${
            errorMsg ? "block" : "hidden"
          }`}
        >
          {errorMsg ?? ""}
        </div>

        <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => toggleTrack("audio")}
            className={`p-4 rounded-full transition ${
              micOn ? "bg-zinc-800 hover:bg-zinc-700" : "bg-red-500/20 text-red-400"
            }`}
          >
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => toggleTrack("video")}
            className={`p-4 rounded-full transition ${
              camOn ? "bg-zinc-800 hover:bg-zinc-700" : "bg-red-500/20 text-red-400"
            }`}
          >
            {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {!isLive ? (
            <button
              type="button"
              onClick={startLive}
              disabled={isStarting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-medium px-6 py-4 rounded-full transition shadow-lg shadow-red-600/20"
            >
              {isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radio className="w-5 h-5" />}
              <span>{isStarting ? "Gerando link..." : "Iniciar Live"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopLive}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 font-medium px-6 py-4 rounded-full transition"
            >
              <Square className="w-5 h-5" />
              <span>Encerrar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}